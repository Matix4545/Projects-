import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { guardarIntentoPago } from "@/lib/pagos";
import { buscarPlan, enlaceDePago } from "@/lib/planes";
import { usuarioActual } from "@/lib/supabase/servidor";
import { urlSitio } from "@/lib/sitio";

/**
 * Manda directo al enlace de pago de Stripe del plan elegido (tarjeta u OXXO).
 * Con sesión, el id del usuario viaja como client_reference_id; sin sesión va un
 * id de "intento" (i_…) y Stripe pide el correo; el webhook da el acceso a ese correo.
 * El intento guarda las cookies del píxel de Meta (_fbp/_fbc), ip y navegador
 * para que la compra confirmada se atribuya al anuncio (lib/meta.ts).
 */
export async function POST(request: NextRequest) {
  const sitio = urlSitio();
  const formulario = await request.formData();
  const plan = buscarPlan(String(formulario.get("plan") ?? ""));
  if (!plan) return NextResponse.redirect(`${sitio}/precios`, 303);

  const usuario = await usuarioActual();
  const enlace = enlaceDePago(plan);
  if (!enlace) return NextResponse.redirect(`${sitio}/precios?error=pagos`, 303);

  const intento = `i_${randomBytes(12).toString("base64url")}`;
  await guardarIntentoPago({
    id: intento,
    usuario: usuario?.id ?? null,
    fbp: request.cookies.get("_fbp")?.value ?? null,
    fbc: request.cookies.get("_fbc")?.value ?? null,
    ip: request.headers.get("x-nf-client-connection-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    ua: request.headers.get("user-agent"),
  });

  const url = new URL(enlace);
  if (usuario) {
    url.searchParams.set("client_reference_id", usuario.id);
    if (usuario.email) url.searchParams.set("prefilled_email", usuario.email);
  } else {
    url.searchParams.set("client_reference_id", intento);
  }
  url.searchParams.set("locale", "es-419");
  return NextResponse.redirect(url.toString(), 303);
}
