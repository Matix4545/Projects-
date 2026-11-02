import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function supabaseConfigurado(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

let admin: SupabaseClient | null = null;

/**
 * Cliente con la clave service_role: lee vacantes completas y registra pagos.
 * SOLO en el servidor; nunca debe llegar al navegador.
 */
export function supabaseAdmin(): SupabaseClient {
  if (admin) return admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  admin = createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}

/** Cliente con la sesión del usuario (cookies). Para login y para saber quién es. */
export async function supabaseSesion() {
  const tienda = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => tienda.getAll(),
      setAll: (lista) => {
        try {
          for (const { name, value, options } of lista) tienda.set(name, value, options);
        } catch {
          // En páginas (Server Components) no se pueden escribir cookies; el proxy las refresca.
        }
      },
    },
  });
}

export interface Usuario {
  id: string;
  email: string;
  accesoHasta: Date | null;
  conAcceso: boolean;
}

/** Usuario con sesión iniciada (o null), con la fecha hasta la que tiene acceso. */
export async function usuarioActual(): Promise<Usuario | null> {
  if (!supabaseConfigurado()) return null;
  const sb = await supabaseSesion();
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  const { data: perfil } = await supabaseAdmin().from("perfiles").select("acceso_hasta").eq("id", data.user.id).maybeSingle();
  const accesoHasta = perfil?.acceso_hasta ? new Date(perfil.acceso_hasta) : null;
  return {
    id: data.user.id,
    email: data.user.email ?? "",
    accesoHasta,
    conAcceso: Boolean(accesoHasta && accesoHasta > new Date()),
  };
}

/**
 * ¿Quien ve la página puede ver empresas y enlaces?
 * En desarrollo se puede forzar con DEMO_ACCESO_TOTAL=1 (nunca en producción).
 */
export async function tieneAcceso(usuario: Usuario | null): Promise<boolean> {
  if (process.env.NODE_ENV !== "production" && process.env.DEMO_ACCESO_TOTAL === "1") return true;
  return Boolean(usuario?.conAcceso);
}
