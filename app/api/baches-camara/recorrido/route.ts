import { z } from "zod";
import { sesionPanelValida } from "@/lib/panel";
import { error, ok } from "@/lib/respuestas";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { sesionVoluntarioValida } from "@/lib/voluntarios";

export const runtime = "nodejs";

// POST /api/baches-camara/recorrido — resumen de un recorrido con la cámara (al tocar Terminar):
// cuadros analizados, apariciones seguidas y por qué se descartaron. Solo diagnóstico interno.

const Entero = z.number().int().min(0).max(10_000_000);
const Real = (max: number) => z.number().finite().min(0).max(max);
const Resumen = z.object({
  sesion: z.uuid(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  plataforma: z.enum(["android", "ios", "otro"]),
  proveedor: z.enum(["webgpu", "wasm"]),
  modelo: z.string().max(80),
  altura_m: Real(5),
  fov: Real(180),
  prueba: z.string().trim().max(60).nullable(),
  duracion_s: Real(86_400),
  cuadros: Entero,
  cuadros_s: Real(120),
  candidatos: Entero,
  confirmados: Entero,
  descartados_pocos: Entero,
  descartados_confianza: Entero,
  sin_gps_s: Real(86_400),
  sin_inclinacion_s: Real(86_400),
});

export async function POST(req: Request) {
  const equipo = await sesionPanelValida();
  const voluntario = !equipo && (await sesionVoluntarioValida().catch(() => false));
  if (!equipo && !voluntario) return error("Sin sesión.", 401);
  const r = Resumen.safeParse(await req.json().catch(() => null));
  if (!r.success) return error("Datos inválidos.");
  const { error: err } = await supabaseServidor()
    .from("recorridos_camara")
    .upsert({ ...r.data, voluntario }, { onConflict: "sesion" });
  if (err) return error("No se pudo guardar.", 500);
  return ok({});
}
