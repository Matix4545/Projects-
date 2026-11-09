import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseSesion } from "@/lib/supabase/servidor";
import { rutaSegura, urlSitio } from "@/lib/sitio";

/** El enlace del correo llega aquí: inicia la sesión y manda al usuario a donde iba. */
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const siguiente = rutaSegura(p.get("siguiente"));
  const sb = await supabaseSesion();

  const code = p.get("code");
  const tokenHash = p.get("token_hash");
  const tipo = p.get("type") as EmailOtpType | null;

  const { error } = code
    ? await sb.auth.exchangeCodeForSession(code)
    : tokenHash && tipo
      ? await sb.auth.verifyOtp({ token_hash: tokenHash, type: tipo })
      : { error: new Error("Enlace incompleto") };

  if (error) return NextResponse.redirect(`${urlSitio()}/entrar?error=enlace&siguiente=${encodeURIComponent(siguiente)}`);
  return NextResponse.redirect(`${urlSitio()}${siguiente}`);
}
