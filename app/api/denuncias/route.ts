import { z } from "zod";
import { LIMITE_DIARIO_INTERACCIONES_IP } from "@/lib/constantes";
import { obtenerIdentidad } from "@/lib/identidad";
import { error, ok } from "@/lib/respuestas";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { verificarTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";

const Esquema = z.object({
  tipo: z.enum(["agua", "pin", "foto"]),
  id: z.number().int().positive(),
  token: z.string(),
});

export async function POST(req: Request) {
  let cuerpo: z.infer<typeof Esquema>;
  try {
    cuerpo = Esquema.parse(await req.json());
  } catch {
    return error("Datos inválidos.");
  }

  const { ip, dispositivoHash, ipHash } = await obtenerIdentidad();
  if (!(await verificarTurnstile(cuerpo.token, ip))) {
    return error("No pudimos verificar que eres una persona. Intenta de nuevo.", 403);
  }

  const db = supabaseServidor();
  const tabla = cuerpo.tipo === "agua" ? "reportes_agua" : "reportes_pin";
  const columna = cuerpo.tipo === "foto" ? "foto_ruta" : "comentario";
  const { data: existe } = await db.from(tabla).select("id").eq("id", cuerpo.id).not(columna, "is", null).maybeSingle();
  if (!existe) return error(cuerpo.tipo === "foto" ? "Esa foto ya no existe." : "Ese comentario ya no existe.", 404);

  const { data: hayCupo, error: errCupo } = await db.rpc("consumir_cupo_ip", {
    p_ip_hash: `${ipHash}:interacciones`,
    p_max: LIMITE_DIARIO_INTERACCIONES_IP,
  });
  if (errCupo) return error("Error al guardar. Intenta más tarde.", 500);
  if (!hayCupo) return error("Llegaste al límite de denuncias de hoy. Vuelve mañana.", 429);

  const { error: errDenuncia } = await db
    .from("denuncias")
    .insert({ objetivo_tipo: cuerpo.tipo, objetivo_id: cuerpo.id, dispositivo_hash: dispositivoHash, ip_hash: ipHash });
  if (errDenuncia) {
    if (errDenuncia.code === "23505") return error("Ya se denunció esto desde tu dispositivo o conexión.", 409);
    console.error(errDenuncia);
    return error("Error al guardar. Intenta más tarde.", 500);
  }
  return ok();
}
