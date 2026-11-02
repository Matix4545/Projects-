import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refresca la sesión de Supabase en cada visita (las páginas no pueden
 * escribir cookies, el proxy sí). Sin Supabase configurado no hace nada.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let respuesta = NextResponse.next({ request });
  if (!url || !clave) return respuesta;

  const sb = createServerClient(url, clave, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista) => {
        for (const { name, value } of lista) request.cookies.set(name, value);
        respuesta = NextResponse.next({ request });
        for (const { name, value, options } of lista) respuesta.cookies.set(name, value, options);
      },
    },
  });
  await sb.auth.getUser();
  return respuesta;
}

export const config = {
  // Todo menos archivos estáticos y el webhook de Stripe
  matcher: ["/((?!_next/static|_next/image|favicon|icono|api/stripe|.*\\.(?:svg|png|jpg|ico|webmanifest)$).*)"],
};
