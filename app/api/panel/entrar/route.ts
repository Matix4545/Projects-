import { NextResponse } from "next/server";
import { obtenerIdentidad } from "@/lib/identidad";
import { COOKIE_PANEL, claveCorrecta, panelConfigurado, tokenPanel } from "@/lib/panel";
import { supabaseServidor } from "@/lib/supabase/servidor";

export const runtime = "nodejs";

const INTENTOS_POR_DIA = 10;

export async function POST(req: Request) {
  const volver = (error: string) => NextResponse.redirect(new URL(`/panel?error=${error}`, req.url), 303);
  if (!panelConfigurado()) return volver("sin-configurar");

  // Límite de intentos por IP para evitar que adivinen la contraseña
  const { ipHash } = await obtenerIdentidad();
  const { data: hayCupo } = await supabaseServidor().rpc("consumir_cupo_ip", {
    p_ip_hash: `${ipHash}:panel`,
    p_max: INTENTOS_POR_DIA,
  });
  if (!hayCupo) return volver("demasiados-intentos");

  const form = await req.formData().catch(() => null);
  const clave = form?.get("clave");
  if (typeof clave !== "string" || !claveCorrecta(clave)) return volver("clave");

  const res = NextResponse.redirect(new URL("/panel", req.url), 303);
  res.cookies.set(COOKIE_PANEL, tokenPanel(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
