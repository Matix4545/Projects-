"use server";

import { limpiarCv, type Cv } from "@/lib/cv";
import { supabaseSesion } from "@/lib/supabase/servidor";

/** Guarda el CV en la cuenta de quien tiene la sesión abierta. */
export async function guardarCv(datos: Cv): Promise<{ ok: boolean; error?: string }> {
  const sb = await supabaseSesion();
  const { error } = await sb.rpc("guardar_cv", { p_datos: limpiarCv(datos) });
  return error ? { ok: false, error: error.message.slice(0, 140) } : { ok: true };
}
