import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { z } from "zod";
import {
  LARGO_MAX_TRAMO,
  LARGO_MIN_TRAMO,
  MAX_COMENTARIO,
  MAX_FOTO_BYTES,
  SUBTIPOS,
  TIPOS_PIN,
  dentroDeCajeme,
  esLinea,
} from "@/lib/constantes";
import { limpiarFoto } from "@/lib/fotos";
import { avisarSiHayHito } from "@/lib/notificaciones";
import { limpiarComentario, revisarComentario } from "@/lib/groserias";
import { obtenerIdentidad } from "@/lib/identidad";
import { error, ok } from "@/lib/respuestas";
import { consumirCupo } from "@/lib/limites";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { largoM, limpiarTrazo, puntoMedio, trazoAWkt, type Punto } from "@/lib/tramos";
import { verificarTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";

const Esquema = z
  .object({
    tipo: z.enum(TIPOS_PIN),
    subtipo: z.string(),
    lat: z.coerce.number().finite(),
    lng: z.coerce.number().finite(),
    comentario: z.string().max(MAX_COMENTARIO * 2).optional(),
    // Calles cerradas / con baches: el tramo como JSON [[lat, lng], ...]
    trazo: z.string().max(40_000).optional(),
    token: z.string(),
  })
  .refine((d) => SUBTIPOS[d.tipo].includes(d.subtipo));

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return error("Datos del reporte inválidos.");
  }

  const campos = Object.fromEntries(
    ["tipo", "subtipo", "lat", "lng", "comentario", "trazo", "token"].map((k) => [k, form.get(k) ?? undefined]),
  );
  const resultado = Esquema.safeParse(campos);
  if (!resultado.success) return error("Datos del reporte incompletos o inválidos.");
  const cuerpo = resultado.data;

  if (!dentroDeCajeme(cuerpo.lat, cuerpo.lng)) return error("La ubicación está fuera de Cajeme.");

  // Tramo de calle: obligatorio solo en calles cerradas / con baches
  let trazo: Punto[] | null = null;
  if (esLinea(cuerpo.tipo)) {
    trazo = leerTrazo(cuerpo.trazo);
    if (!trazo) return error("Marca en el mapa dónde empieza y dónde termina la calle.");
    const largo = largoM(trazo);
    if (largo < LARGO_MIN_TRAMO) return error("El tramo es muy corto. Marca dónde empieza y dónde termina la calle.");
    if (largo > LARGO_MAX_TRAMO * 1.8) return error("El tramo es muy largo (máximo 3 km). Márcalo por partes.");
    // El punto del reporte es la mitad del tramo
    [cuerpo.lat, cuerpo.lng] = puntoMedio(trazo);
  }

  const comentario = limpiarComentario(cuerpo.comentario);
  if (comentario && comentario.length > MAX_COMENTARIO) return error(`El comentario debe tener máximo ${MAX_COMENTARIO} caracteres.`);
  const problema = revisarComentario(comentario);
  if (problema) return error(problema);

  const foto = form.get("foto");
  const hayFoto = foto instanceof File && foto.size > 0;
  if (hayFoto && foto.size > MAX_FOTO_BYTES * 1.5) return error("La foto pesa demasiado (máximo 1 MB).", 413);
  if (hayFoto && !foto.type.startsWith("image/")) return error("El archivo no es una imagen.");

  const { ip, dispositivoHash, ipHash } = await obtenerIdentidad();
  if (!(await verificarTurnstile(cuerpo.token, ip))) {
    return error("No pudimos verificar que eres una persona. Intenta de nuevo.", 403);
  }

  // Procesar la foto ANTES de consumir el cupo, por si no es válida
  let fotoLimpia: Buffer | null = null;
  if (hayFoto) {
    try {
      fotoLimpia = await limpiarFoto(Buffer.from(await foto.arrayBuffer()));
    } catch {
      return error("No pudimos leer la foto. Intenta con otra.");
    }
  }

  const db = supabaseServidor();

  const hayCupo = await consumirCupo(db, { ipHash, dispositivoHash }, "reportes");
  if (hayCupo === null) return error("Error al guardar. Intenta más tarde.", 500);
  if (!hayCupo) return error("Llegaste al límite de reportes de hoy. Gracias por participar; vuelve mañana.", 429);

  let fotoRuta: string | null = null;
  if (fotoLimpia) {
    const hoy = new Date();
    fotoRuta = `pins/${hoy.getUTCFullYear()}/${String(hoy.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.jpg`;
    const { error: errFoto } = await db.storage
      .from("fotos")
      .upload(fotoRuta, fotoLimpia, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
    if (errFoto) {
      console.error(errFoto);
      return error("No se pudo subir la foto. Intenta de nuevo o envía el reporte sin foto.", 500);
    }
  }

  const { data: zona } = await db.rpc("zona_de_punto", { p_lng: cuerpo.lng, p_lat: cuerpo.lat });

  const { data: pin, error: errInsert } = await db
    .from("reportes_pin")
    .insert({
      tipo: cuerpo.tipo,
      subtipo: cuerpo.subtipo,
      ubicacion: `SRID=4326;POINT(${cuerpo.lng} ${cuerpo.lat})`,
      ...(trazo ? { trazo: trazoAWkt(trazo) } : {}),
      zona_id: zona?.id ?? null,
      foto_ruta: fotoRuta,
      comentario,
      dispositivo_hash: dispositivoHash,
      ip_hash: ipHash,
    })
    .select("id")
    .single();
  if (errInsert) {
    console.error(errInsert);
    if (fotoRuta) await db.storage.from("fotos").remove([fotoRuta]);
    return error("Error al guardar. Intenta más tarde.", 500);
  }

  // El aviso se manda después de responder, para no hacer esperar a quien reporta
  after(() => avisarSiHayHito(db));
  return ok({ id: pin.id });
}

function leerTrazo(texto: string | undefined): Punto[] | null {
  if (!texto) return null;
  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch {
    return null;
  }
  const valido = z
    .array(z.tuple([z.number().finite(), z.number().finite()]))
    .min(2)
    .max(500)
    .safeParse(datos);
  if (!valido.success || !valido.data.every(([lat, lng]) => dentroDeCajeme(lat, lng))) return null;
  const puntos = limpiarTrazo(valido.data);
  return puntos.length >= 2 ? puntos : null;
}
