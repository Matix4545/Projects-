import { randomUUID } from "node:crypto";
import { z } from "zod";
import { dentroDeCajeme } from "@/lib/constantes";
import { limpiarFoto } from "@/lib/fotos";
import { sesionPanelValida } from "@/lib/panel";
import { sesionVoluntarioValida } from "@/lib/voluntarios";
import { error, ok } from "@/lib/respuestas";
import { supabaseServidor } from "@/lib/supabase/servidor";

export const runtime = "nodejs";

// POST /api/baches-camara — baches que detectó la cámara del parabrisas en /medir.
// Solo el equipo (sesión del panel) o voluntarios con el código vigente: estos baches se publican
// en el mapa sin pasar por los límites de los vecinos, así que no puede usarlo cualquiera.
// Los de voluntarios quedan marcados (detecciones_bache.voluntario) para revisarlos o quitarlos.
// Llega como multipart: "datos" (JSON) y una foto por bache ("foto_0", "foto_1"…): un recorte
// del bache, que el servidor vuelve a codificar (sin metadatos).

const MAX_POR_LOTE = 10;

const Num = (min: number, max: number) => z.number().finite().min(min).max(max);
const Bache = z.object({
  lat: z.number().finite(),
  lng: z.number().finite(),
  area_m2: Num(0, 100).nullable(),
  area_sd: Num(0, 100).nullable(),
  largo_m: Num(0, 30).nullable(),
  ancho_m: Num(0, 30).nullable(),
  confianza: Num(0, 1),
  confianza_max: Num(0, 1),
  cuadros: z.number().int().min(1).max(10_000),
  medidas: z.number().int().min(0).max(10_000),
  distancia_m: Num(0, 200),
  rumbo: Num(0, 360).nullable().optional(),
  precision_m: Num(0, 200).nullable().optional(),
  foto: z.string().regex(/^foto_\d{1,2}$/).nullable(),
});
const Lote = z.object({
  sesion: z.uuid(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  modelo: z.string().max(80),
  plataforma: z.enum(["android", "ios", "otro"]),
  altura_m: Num(0.3, 5),
  fov: Num(20, 140),
  /** Recorrido de prueba: la nota; los baches se guardan pero no se publican en el mapa */
  prueba: z.string().trim().max(60).nullable().optional(),
  baches: z.array(Bache).min(1).max(MAX_POR_LOTE),
});

export async function POST(req: Request) {
  const equipo = await sesionPanelValida();
  const voluntario = !equipo && (await sesionVoluntarioValida());
  if (!equipo && !voluntario) return error("Necesitas entrar con la contraseña del equipo o tu código de voluntario.", 401);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return error("Datos inválidos.");
  }
  let json: unknown;
  try {
    json = JSON.parse(String(form.get("datos") ?? ""));
  } catch {
    return error("Datos inválidos.");
  }
  const r = Lote.safeParse(json);
  if (!r.success) return error("Datos inválidos.");
  const lote = r.data;

  const db = supabaseServidor();
  // Tope generoso por día (protege la base de datos si algo se cicla)
  const { data: hayCupo, error: errCupo } = await db.rpc("consumir_cupo_ip", {
    p_ip_hash: voluntario ? "voluntarios:baches-camara" : "equipo:baches-camara",
    p_max: voluntario ? 5_000 : 20_000,
  });
  if (errCupo) return error("Error al guardar. Intenta más tarde.", 500);
  if (!hayCupo) return error("Se llegó al límite de baches de hoy.", 429);

  const resultados: { pin_id: number | null; nuevo: boolean; calle?: string | null; prueba?: boolean; error?: string }[] = [];
  for (const b of lote.baches) {
    if (!dentroDeCajeme(b.lat, b.lng)) {
      resultados.push({ pin_id: null, nuevo: false, error: "fuera de Cajeme" });
      continue;
    }
    let fotoRuta: string | null = null;
    const archivo = b.foto ? form.get(b.foto) : null;
    if (archivo instanceof File && archivo.size > 0 && archivo.size <= 2_000_000 && archivo.type.startsWith("image/")) {
      try {
        const limpia = await limpiarFoto(Buffer.from(await archivo.arrayBuffer()));
        const hoy = new Date();
        fotoRuta = `camara/${hoy.getUTCFullYear()}/${String(hoy.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.jpg`;
        const { error: errFoto } = await db.storage.from("fotos").upload(fotoRuta, limpia, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
        if (errFoto) {
          console.error("foto cámara:", errFoto.message);
          fotoRuta = null;
        }
      } catch {
        fotoRuta = null; // sin foto, pero el bache sí se guarda
      }
    }
    const { data, error: err } = await db.rpc("registrar_bache_camara", {
      p: {
        sesion: lote.sesion,
        fecha: lote.fecha,
        lat: b.lat,
        lng: b.lng,
        area_m2: b.area_m2,
        area_sd_m2: b.area_sd,
        largo_m: b.largo_m,
        ancho_m: b.ancho_m,
        confianza: b.confianza,
        confianza_max: b.confianza_max,
        cuadros: b.cuadros,
        medidas: b.medidas,
        distancia_m: b.distancia_m,
        rumbo: b.rumbo ?? null,
        precision_m: b.precision_m ?? null,
        foto_ruta: fotoRuta,
        modelo: lote.modelo,
        altura_m: lote.altura_m,
        fov: lote.fov,
        plataforma: lote.plataforma,
        prueba: lote.prueba || null,
        voluntario,
      },
    });
    if (err) {
      console.error("registrar_bache_camara:", err.message);
      if (fotoRuta) await db.storage.from("fotos").remove([fotoRuta]);
      return error("Error al guardar. ¿Ya corriste los .sql nuevos?", 500);
    }
    // pin_id null: no se pudo medir y no había un bache ahí, así que no se publica (solo queda la detección)
    const d = data as { pin_id: number | null; nuevo: boolean; calle: string | null; prueba?: boolean };
    resultados.push({ pin_id: d.pin_id, nuevo: d.nuevo, calle: d.calle, prueba: !!d.prueba });
  }
  return ok({ resultados });
}
