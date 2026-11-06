import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { visitanteLocal } from "@/lib/ubicacion";

// La app solo usa la clave PÚBLICA de Supabase. Las tablas no se pueden leer
// directo: todo pasa por funciones de la base que revisan quién pregunta
// (ver supabase/01_esquema.sql). Por eso no hace falta la clave service_role.

export function supabaseConfigurado(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * Cliente con la sesión del usuario (cookies): la base sabe quién es y si pagó.
 * Si el visitante está en Sonora, se manda la clave privada de la app en el
 * encabezado "x-chambaradar-local" y la base le da acceso completo gratis
 * (tiene_acceso() en supabase/07_gratis_obregon.sql). La clave nunca llega al navegador.
 */
export async function supabaseSesion() {
  const tienda = await cookies();
  const clave = process.env.CHAMBARADAR_CLAVE;
  const local = clave && (await visitanteLocal());
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: local ? { headers: { "x-chambaradar-local": clave } } : undefined,
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
  /** Puede usar el panel de captura (/panel) */
  esAdmin: boolean;
}

/** Usuario con sesión iniciada (o null), con la fecha hasta la que tiene acceso. */
export async function usuarioActual(): Promise<Usuario | null> {
  if (!supabaseConfigurado()) return null;
  const sb = await supabaseSesion();
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  // La política de la tabla solo deja ver el perfil propio
  const { data: perfil } = await sb.from("perfiles").select("acceso_hasta, es_admin").eq("id", data.user.id).maybeSingle();
  const accesoHasta = perfil?.acceso_hasta ? new Date(perfil.acceso_hasta) : null;
  return {
    id: data.user.id,
    email: data.user.email ?? "",
    accesoHasta,
    conAcceso: Boolean(accesoHasta && accesoHasta > new Date()),
    esAdmin: Boolean(perfil?.es_admin),
  };
}

/**
 * Solo para el modo local (sin Supabase): ¿mostrar empresas y enlaces?
 * Con Supabase, quien decide es la base de datos.
 * En desarrollo se puede forzar con DEMO_ACCESO_TOTAL=1 (nunca en producción).
 */
export async function accesoLocal(usuario: Usuario | null): Promise<boolean> {
  if (process.env.NODE_ENV !== "production" && process.env.DEMO_ACCESO_TOTAL === "1") return true;
  return Boolean(usuario?.conAcceso) || (await visitanteLocal());
}
