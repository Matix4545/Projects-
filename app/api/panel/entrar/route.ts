import { NextResponse } from "next/server";
import { obtenerIdentidad } from "@/lib/identidad";
import { COOKIE_AVISO_EQUIPO, COOKIE_PANEL, claveCorrecta, panelConfigurado, tokenPanel } from "@/lib/panel";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { COOKIE_VOLUNTARIO, tokenSiCodigoCorrecto } from "@/lib/voluntarios";

export const runtime = "nodejs";

const INTENTOS_POR_DIA = 10;
/** Páginas a las que se puede regresar después de entrar (lista cerrada: nada de redirecciones abiertas) */
const DESTINOS = new Set(["/panel", "/medir"]);

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const pedido = form?.get("volver");
  const destino = typeof pedido === "string" && DESTINOS.has(pedido) ? pedido : "/panel";
  const volver = (error: string) => NextResponse.redirect(new URL(`${destino}?error=${error}`, req.url), 303);
  if (!process.env.HASH_SECRET) return volver("sin-configurar");

  // Límite de intentos por IP para evitar que adivinen la contraseña
  const { ipHash } = await obtenerIdentidad();
  const { data: hayCupo } = await supabaseServidor().rpc("consumir_cupo_ip", {
    p_ip_hash: `${ipHash}:panel`,
    p_max: INTENTOS_POR_DIA,
  });
  if (!hayCupo) return volver("demasiados-intentos");

  const clave = form?.get("clave");
  if (typeof clave !== "string" || !clave) return volver("clave");

  // El mismo campo sirve para el código de voluntario: solo puede medir, así que regresa a /medir
  if (!(panelConfigurado() && claveCorrecta(clave))) {
    const token = await tokenSiCodigoCorrecto(clave);
    if (!token) return volver("clave");
    const res = NextResponse.redirect(new URL("/medir", req.url), 303);
    res.cookies.set(COOKIE_VOLUNTARIO, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 90,
    });
    return res;
  }

  const res = NextResponse.redirect(new URL(destino, req.url), 303);
  res.cookies.set(COOKIE_PANEL, tokenPanel(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  res.cookies.set(COOKIE_AVISO_EQUIPO, "1", {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
