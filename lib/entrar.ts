import "server-only";
import { NextResponse } from "next/server";
import { obtenerIdentidad } from "@/lib/identidad";
import { COOKIE_AVISO_EQUIPO, COOKIE_PANEL, claveCorrecta, panelConfigurado, tokenPanel } from "@/lib/panel";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { COOKIE_VOLUNTARIO, tokenSiCodigoCorrecto } from "@/lib/voluntarios";

// Entrar con la contraseña del equipo o el código de voluntario (el mismo campo sirve para los dos).
// Lo usan /api/panel/entrar (desde /panel) y /medir/entrar (desde /medir: dentro del alcance de la app
// instalada "Medir baches", para que en iPhone no se abra afuera y la sesión quede en la app).

const INTENTOS_FALLIDOS_POR_DIA = 10;
/** Páginas a las que se puede regresar después de entrar (lista cerrada: nada de redirecciones abiertas) */
const DESTINOS = new Set(["/panel", "/medir"]);

export async function entrar(req: Request, destinoPredeterminado: "/panel" | "/medir") {
  const form = await req.formData().catch(() => null);
  const pedido = form?.get("volver");
  const destino = typeof pedido === "string" && DESTINOS.has(pedido) ? pedido : destinoPredeterminado;
  const volver = (error: string) => NextResponse.redirect(new URL(`${destino}?error=${error}`, req.url), 303);
  if (!process.env.HASH_SECRET) return volver("sin-configurar");

  // Solo cuentan los intentos FALLIDOS (10 por día y conexión): entrar bien no gasta intentos,
  // así varios celulares en el mismo wifi pueden entrar sin bloquearse
  const db = supabaseServidor();
  const { ipHash } = await obtenerIdentidad();
  const llave = `${ipHash}:panel`;
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Hermosillo" });
  const { data: usados } = await db.from("limite_ip").select("total").eq("ip_hash", llave).eq("dia", hoy).maybeSingle();
  if ((usados?.total ?? 0) >= INTENTOS_FALLIDOS_POR_DIA) return volver("demasiados-intentos");
  const fallo = async () => {
    await db.rpc("consumir_cupo_ip", { p_ip_hash: llave, p_max: INTENTOS_FALLIDOS_POR_DIA });
    return volver("clave");
  };

  const clave = form?.get("clave");
  if (typeof clave !== "string" || !clave) return fallo();

  if (panelConfigurado() && claveCorrecta(clave)) {
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

  // Código de voluntario: solo puede medir, así que siempre regresa a /medir
  let token: string | null;
  try {
    token = await tokenSiCodigoCorrecto(clave);
  } catch {
    return volver("servidor");
  }
  if (!token) return fallo();
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
