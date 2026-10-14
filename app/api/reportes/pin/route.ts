import { randomUUID } from "node:crypto";
import { z } from "zod";
import { LIMITE_DIARIO_IP, MAX_COMENTARIO, MAX_FOTO_BYTES, TAMANOS_BACHE, TIPOS_DRENAJE, dentroDeCajeme } from "@/lib/constantes";
import { limpiarFoto } from "@/lib/fotos";
import { limpiarComentario, revisarComentario } from "@/lib/groserias";
import { obtenerIdentidad } from "@/lib/identidad";
import { error, ok } from "@/lib/respuestas";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { verificarTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";

const Esquema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("bache"), subtipo: z.enum(TAMANOS_BACHE) }),
  z.object({ tipo: z.literal("drenaje"), subtipo: z.enum(TIPOS_DRENAJE) }),
]).and(
  z.object({
    lat: z.coerce.number().finite(),
    lng: z.coerce.number().finite(),
    comentario: z.string().max(MAX_COMENTARIO * 2).optional(),
    token: z.string(),
  }),
);

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return error("Datos del reporte inválidos.");
  }

  const campos = Object.fromEntries(
    ["tipo", "subtipo", "lat", "lng", "comentario", "token"].map((k) => [k, form.get(k) ?? undefined]),
  );
  const resultado = Esquema.safeParse(campos);
  if (!resultado.success) return error("Datos del reporte incompletos o inválidos.");
  const cuerpo = resultado.data;

  if (!dentroDeCajeme(cuerpo.lat, cuerpo.lng)) return error("La ubicación está fuera de Cajeme.");

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

  const { data: hayCupo, error: errCupo } = await db.rpc("consumir_cupo_ip", { p_ip_hash: ipHash, p_max: LIMITE_DIARIO_IP });
  if (errCupo) return error("Error al guardar. Intenta más tarde.", 500);
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

  return ok({ id: pin.id });
}
