import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cliente: SupabaseClient | null = null;

/** Cliente con la clave pública "anon": solo puede llamar funciones de lectura agregada. */
export function supabaseNavegador(): SupabaseClient {
  if (cliente) return cliente;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !clave) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  cliente = createClient(url, clave, { auth: { persistSession: false } });
  return cliente;
}

/** URL pública de una foto guardada en el bucket "fotos". */
export function urlFoto(ruta: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/fotos/${ruta}`;
}
