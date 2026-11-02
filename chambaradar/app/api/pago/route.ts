import { NextResponse, type NextRequest } from "next/server";
import { buscarPlan, enlaceDePago } from "@/lib/planes";
import { usuarioActual } from "@/lib/supabase/servidor";
import { urlSitio } from "@/lib/sitio";

/**
 * Manda al usuario al enlace de pago de Stripe del plan elegido (tarjeta u OXXO).
 * El id del usuario viaja como client_reference_id para que el webhook sepa a
 * quién darle el acceso.
 */
export async function POST(request: NextRequest) {
  const sitio = urlSitio();
  const formulario = await request.formData();
  const plan = buscarPlan(String(formulario.get("plan") ?? ""));
  if (!plan) return NextResponse.redirect(`${sitio}/precios`, 303);

  const usuario = await usuarioActual();
  if (!usuario) return NextResponse.redirect(`${sitio}/entrar?siguiente=${encodeURIComponent(`/precios?plan=${plan.id}`)}`, 303);

  const enlace = enlaceDePago(plan);
  if (!enlace) return NextResponse.redirect(`${sitio}/precios?error=pagos`, 303);

  const url = new URL(enlace);
  url.searchParams.set("client_reference_id", usuario.id);
  if (usuario.email) url.searchParams.set("prefilled_email", usuario.email);
  url.searchParams.set("locale", "es-419");
  return NextResponse.redirect(url.toString(), 303);
}
