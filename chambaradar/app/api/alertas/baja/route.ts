import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { urlSitio } from "@/lib/sitio";

/**
 * Baja de una alerta. Recibe POST desde:
 * - el botón de /alertas/baja (formulario), y
 * - Gmail/Outlook con "baja con un clic" (encabezado List-Unsubscribe-Post).
 * No se hace con GET porque los filtros de correo abren los enlaces solos.
 */
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("t") ?? "";
  const esFormulario = (request.headers.get("content-type") ?? "").includes("form") && !(await request.clone().text()).includes("List-Unsubscribe");
  let ok = false;
  if (/^[0-9a-f-]{36}$/i.test(token) && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { error } = await sb.rpc("baja_alerta", { p_token: token });
    ok = !error;
  }
  if (esFormulario) return NextResponse.redirect(`${urlSitio()}/alertas/baja?t=${encodeURIComponent(token)}&hecho=${ok ? 1 : 0}`, 303);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
