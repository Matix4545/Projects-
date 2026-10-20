import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  LIMITE_DIARIO_DISPOSITIVO,
  LIMITE_DIARIO_INTERACCIONES_DISPOSITIVO,
  LIMITE_DIARIO_INTERACCIONES_IP,
  LIMITE_DIARIO_IP,
} from "./constantes";

/**
 * Cupo diario por teléfono (cookie) y por conexión (IP).
 * El de IP es amplio porque en datos móviles muchos vecinos comparten la misma IP pública;
 * el de teléfono es el estricto. Devuelve null si falló la base de datos.
 */
export async function consumirCupo(
  db: SupabaseClient,
  { ipHash, dispositivoHash }: { ipHash: string; dispositivoHash: string },
  tipo: "reportes" | "interacciones",
): Promise<boolean | null> {
  const sufijo = tipo === "reportes" ? "" : ":interacciones";
  const cupos: [string, number][] = [
    [`d:${dispositivoHash}${sufijo}`, tipo === "reportes" ? LIMITE_DIARIO_DISPOSITIVO : LIMITE_DIARIO_INTERACCIONES_DISPOSITIVO],
    [`${ipHash}${sufijo}`, tipo === "reportes" ? LIMITE_DIARIO_IP : LIMITE_DIARIO_INTERACCIONES_IP],
  ];
  for (const [clave, max] of cupos) {
    const { data, error } = await db.rpc("consumir_cupo_ip", { p_ip_hash: clave, p_max: max });
    if (error) return null;
    if (!data) return false;
  }
  return true;
}
