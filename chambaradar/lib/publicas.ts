import "server-only";
import type { Vacante } from "./tipos.ts";
import { supabaseConfigurado, supabaseSesion } from "./supabase/servidor.ts";

/**
 * Vacantes que publican los negocios en ChambaRadar: se ven completas para
 * todos y cada una tiene su página (/vacante/<id>). Si la función de la base
 * todavía no existe, devuelve [] en lugar de romper la página.
 */
export async function vacantesPublicas(id?: string): Promise<Vacante[]> {
  if (!supabaseConfigurado()) return [];
  const { data, error } = await (await supabaseSesion()).rpc("vacantes_publicas", { p_id: id ?? null });
  if (error) {
    console.error("vacantes_publicas:", error.message);
    return [];
  }
  return (data ?? []) as Vacante[];
}

/** "directa:5a60…" ↔ "/vacante/5a60…" */
export const rutaVacante = (id: string) => `/vacante/${id.replace(/^directa:/, "")}`;
export const idDeRuta = (parte: string) => (/^[0-9a-f-]{36}$/i.test(parte) ? `directa:${parte.toLowerCase()}` : null);
