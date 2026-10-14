import { z } from "zod";
import { LIMITE_DIARIO_INTERACCIONES_IP } from "@/lib/constantes";
import { obtenerIdentidad } from "@/lib/identidad";
import { error, ok } from "@/lib/respuestas";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { verificarTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";

const Esquema = z.object({
  tipo: z.enum(["confirmo", "arreglado"]),
  token: z.string(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const pinId = Number((await params).id);
  if (!Number.isSafeInteger(pinId) || pinId <= 0) return error("Reporte no válido.");

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
  const { data: pin, error: errPin } = await db
    .from("reportes_pin")
    .select("id, estado, dispositivo_hash")
    .eq("id", pinId)
    .maybeSingle();
  if (errPin) return error("Error al guardar. Intenta más tarde.", 500);
  if (!pin) return error("Ese reporte ya no existe.", 404);
  if (pin.estado !== "activo") return error("Este reporte ya está marcado como arreglado.", 409);
  if (cuerpo.tipo === "confirmo" && pin.dispositivo_hash === dispositivoHash) {
    return error("No puedes confirmar tu propio reporte.", 409);
  }

  const { data: hayCupo, error: errCupo } = await db.rpc("consumir_cupo_ip", {
    p_ip_hash: `${ipHash}:interacciones`,
    p_max: LIMITE_DIARIO_INTERACCIONES_IP,
  });
  if (errCupo) return error("Error al guardar. Intenta más tarde.", 500);
  if (!hayCupo) return error("Llegaste al límite de votos de hoy. Vuelve mañana.", 429);

  const { error: errVoto } = await db
    .from("votos_pin")
    .insert({ pin_id: pinId, tipo: cuerpo.tipo, dispositivo_hash: dispositivoHash, ip_hash: ipHash });
  if (errVoto) {
    if (errVoto.code === "23505") {
      if (errVoto.message.includes("una_ip")) {
        return error("Ya se marcó este reporte como arreglado desde esta conexión. Hace falta que lo confirmen otros vecinos.", 409);
      }
      return error(cuerpo.tipo === "confirmo" ? "Ya confirmaste este reporte." : "Ya marcaste este reporte como arreglado.", 409);
    }
    console.error(errVoto);
    return error("Error al guardar. Intenta más tarde.", 500);
  }

  const { data: actualizado } = await db
    .from("reportes_pin")
    .select("confirmaciones, votos_arreglado, estado")
    .eq("id", pinId)
    .single();

  return ok({ pin: actualizado });
}
