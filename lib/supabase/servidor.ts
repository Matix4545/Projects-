import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cliente: SupabaseClient | null = null;

/**
 * Cliente con la clave service_role. SOLO se usa en el servidor (rutas /api).
 * Puede escribir en las tablas, así que nunca debe llegar al navegador.
 */
export function supabaseServidor(): SupabaseClient {
  if (cliente) return cliente;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en las variables de entorno.");
  }
  cliente = createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });
  return cliente;
}
