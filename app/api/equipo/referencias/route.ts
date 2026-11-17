import { z } from "zod";
import { dentroDeCajeme } from "@/lib/constantes";
import { sesionPanelValida } from "@/lib/panel";
import { error, ok } from "@/lib/respuestas";
import { supabaseServidor } from "@/lib/supabase/servidor";

export const runtime = "nodejs";

// POST /api/equipo/referencias — guarda una medida de referencia (bache medido a pie con una hoja
// de tamaño conocido) para compararla con lo que mida la cámara en ese lugar. Solo equipo.
const Num = (min: number, max: number) => z.number().finite().min(min).max(max);
const Medida = z.object({
  lat: z.number().finite(),
  lng: z.number().finite(),
  precision_m: Num(0, 500).nullable().optional(),
  area_m2: Num(0.001, 100),
  largo_m: Num(0, 30).nullable().optional(),
  ancho_m: Num(0, 30).nullable().optional(),
  perimetro_m: Num(0, 100).nullable().optional(),
  referencia: z.enum(["carta", "carta4", "otra"]),
  nota: z.string().trim().max(60).optional(),
});

export async function POST(req: Request) {
  if (!(await sesionPanelValida())) return error("Necesitas entrar con la contraseña del equipo.", 401);
  const r = Medida.safeParse(await req.json().catch(() => null));
  if (!r.success) return error("Datos inválidos.");
  const m = r.data;
  if (!dentroDeCajeme(m.lat, m.lng)) return error("La ubicación está fuera de Cajeme.");
  const { data, error: err } = await supabaseServidor()
    .from("mediciones_referencia")
    .insert({
      fecha: new Date().toLocaleDateString("en-CA", { timeZone: "America/Hermosillo" }),
      ubicacion: `SRID=4326;POINT(${m.lng} ${m.lat})`,
      precision_m: m.precision_m ?? null,
      area_m2: m.area_m2,
      largo_m: m.largo_m ?? null,
      ancho_m: m.ancho_m ?? null,
      perimetro_m: m.perimetro_m ?? null,
      referencia: m.referencia,
      nota: m.nota || null,
    })
    .select("id")
    .single();
  if (err) {
    console.error("mediciones_referencia:", err.message);
    return error("No se pudo guardar. ¿Ya corriste los .sql nuevos?", 500);
  }
  return ok({ id: data.id });
}
