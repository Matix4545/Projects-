import { z } from "zod";
import { obtenerIdentidad } from "@/lib/identidad";
import { error, ok } from "@/lib/respuestas";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { verificarTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";

const Esquema = z.object({
  tipo: z.enum(["agua", "pin"]),
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

  const { ip, dispositivoHash } = await obtenerIdentidad();
  if (!(await verificarTurnstile(cuerpo.token, ip))) {
    return error("No pudimos verificar que eres una persona. Intenta de nuevo.", 403);
  }

  const db = supabaseServidor();
  const tabla = cuerpo.tipo === "agua" ? "reportes_agua" : "reportes_pin";
  const { data: existe } = await db.from(tabla).select("id").eq("id", cuerpo.id).not("comentario", "is", null).maybeSingle();
  if (!existe) return error("Ese comentario ya no existe.", 404);

  const { error: errDenuncia } = await db
    .from("denuncias")
    .insert({ objetivo_tipo: cuerpo.tipo, objetivo_id: cuerpo.id, dispositivo_hash: dispositivoHash });
  if (errDenuncia) {
    if (errDenuncia.code === "23505") return error("Ya denunciaste este comentario.", 409);
    console.error(errDenuncia);
    return error("Error al guardar. Intenta más tarde.", 500);
  }
  return ok();
}
