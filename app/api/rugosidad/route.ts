import { z } from "zod";
import { dentroDeCajeme } from "@/lib/constantes";
import { obtenerIdentidad } from "@/lib/identidad";
import { error, ok } from "@/lib/respuestas";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { verificarTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";

// POST /api/rugosidad — tramos ya calculados en el celular ("Medir mi recorrido").
// Llegan en lotes cada ~5 minutos durante el recorrido. No se guarda nada que identifique
// a la persona: ni hora, ni IP, ni el celular (solo una sesión al azar por recorrido;
// del teléfono solo si es Android o iPhone, porque sus sensores miden distinto).

// Envíos al día: generoso, porque un repartidor manda un lote cada 5 minutos toda la jornada
const LOTES_DIA_DISPOSITIVO = 400;
const LOTES_DIA_IP = 3000;

const Punto = z.tuple([z.number().finite(), z.number().finite()]).refine(([lat, lng]) => dentroDeCajeme(lat, lng));
const Tramo = z.object({
  puntos: z.array(Punto).min(2).max(30),
  largo_m: z.number().min(30).max(400),
  vel_kmh: z.number().min(5).max(120),
  rms: z.number().min(0).max(50),
  rms_baja: z.number().min(0).max(50).optional(),
  p95: z.number().min(0).max(25).optional(),
  vel_sd: z.number().min(0).max(100).optional(),
  golpes: z.array(Punto).max(20),
});
const Lote = z.object({
  sesion: z.uuid(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  vehiculo: z.enum(["auto", "camioneta", "pickup", "moto", "otro"]),
  hz: z.number().min(0).max(1000).optional(),
  soporte: z.enum(["rejilla", "parabrisas", "tablero", "portavasos", "otro"]).optional(),
  plataforma: z.enum(["android", "ios", "otro"]).optional(),
  nota: z.string().trim().max(60).optional(),
  tramos: z.array(z.unknown()).min(1).max(200),
  token: z.string(),
});

const linea = (p: [number, number][]) => `SRID=4326;LINESTRING(${p.map(([lat, lng]) => `${lng} ${lat}`).join(",")})`;
const multipunto = (p: [number, number][]) => `SRID=4326;MULTIPOINT(${p.map(([lat, lng]) => `(${lng} ${lat})`).join(",")})`;

export async function POST(req: Request) {
  const r = Lote.safeParse(await req.json().catch(() => null));
  if (!r.success) return error("Datos inválidos.");
  const lote = r.data;
  // Los tramos con algún dato raro se descartan uno por uno, sin tirar todo el lote
  const tramos = lote.tramos.map((t) => Tramo.safeParse(t)).flatMap((x) => (x.success ? [x.data] : []));
  if (tramos.length === 0) return error("Ningún tramo válido.");

  const { ip, dispositivoHash, ipHash } = await obtenerIdentidad();
  if (!(await verificarTurnstile(lote.token, ip))) return error("No pudimos verificar que eres una persona.", 403);

  const db = supabaseServidor();
  for (const [clave, max] of [
    [`d:${dispositivoHash}:rugosidad`, LOTES_DIA_DISPOSITIVO],
    [`${ipHash}:rugosidad`, LOTES_DIA_IP],
  ] as const) {
    const { data, error: err } = await db.rpc("consumir_cupo_ip", { p_ip_hash: clave, p_max: max });
    if (err) return error("Error al guardar. Intenta más tarde.", 500);
    if (!data) return error("Llegaste al límite de envíos de hoy.", 429);
  }

  const { error: err } = await db.from("tramos_rugosidad").insert(
    tramos.map((t) => ({
      sesion: lote.sesion,
      fecha: lote.fecha,
      vehiculo: lote.vehiculo,
      trazo: linea(t.puntos),
      largo_m: t.largo_m,
      vel_kmh: t.vel_kmh,
      rms: t.rms,
      rms_baja: t.rms_baja ?? null,
      p95: t.p95 ?? null,
      vel_sd: t.vel_sd ?? null,
      golpes: t.golpes.length ? multipunto(t.golpes) : null,
      n_golpes: t.golpes.length,
      hz: lote.hz ?? null,
      soporte: lote.soporte ?? null,
      plataforma: lote.plataforma ?? null,
      nota: lote.nota || null,
    })),
  );
  if (err) {
    console.error("rugosidad:", err.message);
    return error("Error al guardar. Intenta más tarde.", 500);
  }
  return ok({ guardados: tramos.length });
}
