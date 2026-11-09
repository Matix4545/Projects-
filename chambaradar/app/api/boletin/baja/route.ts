import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { urlSitio } from "@/lib/sitio";

/**
 * Baja del boletín semanal. Recibe POST desde el botón de /boletin/baja y desde
 * Gmail/Outlook con "baja con un clic" (List-Unsubscribe-Post).
 */
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("t") ?? "";
  const esFormulario = (request.headers.get("content-type") ?? "").includes("form") && !(await request.clone().text()).includes("List-Unsubscribe");
  let ok = false;
  if (/^[0-9a-f-]{36}$/i.test(token) && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { data, error } = await sb.rpc("baja_boletin", { p_token: token });
    ok = !error && data === true;
  }
  if (esFormulario) return NextResponse.redirect(`${urlSitio()}/boletin/baja?t=${encodeURIComponent(token)}&hecho=${ok ? 1 : 0}`, 303);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
