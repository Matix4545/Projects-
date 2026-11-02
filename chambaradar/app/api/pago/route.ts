import { NextResponse, type NextRequest } from "next/server";
import { buscarPlan } from "@/lib/planes";
import { metodosDePago, stripe, stripeConfigurado } from "@/lib/stripe";
import { usuarioActual } from "@/lib/supabase/servidor";
import { urlSitio } from "@/lib/sitio";

/** Crea una sesión de Stripe Checkout (tarjeta u OXXO) y manda al usuario a pagar. */
export async function POST(request: NextRequest) {
  const sitio = urlSitio();
  const formulario = await request.formData();
  const plan = buscarPlan(String(formulario.get("plan") ?? ""));
  if (!plan) return NextResponse.redirect(`${sitio}/precios`, 303);

  const usuario = await usuarioActual();
  if (!usuario) return NextResponse.redirect(`${sitio}/entrar?siguiente=${encodeURIComponent(`/precios?plan=${plan.id}`)}`, 303);
  if (!stripeConfigurado()) return NextResponse.redirect(`${sitio}/precios?error=pagos`, 303);

  const sesion = await stripe().checkout.sessions.create({
    mode: "payment",
    allowed_payment_method_types: metodosDePago(),
    payment_method_options: { oxxo: { expires_after_days: 3 } },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "mxn",
          unit_amount: plan.precio * 100,
          product_data: { name: `ChambaRadar · Acceso por ${plan.nombre}`, description: "Empresas y enlaces de todas las vacantes" },
        },
      },
    ],
    customer_email: usuario.email || undefined,
    client_reference_id: usuario.id,
    metadata: { usuario: usuario.id, plan: plan.id },
    locale: "es-419",
    success_url: `${sitio}/cuenta?pago=ok`,
    cancel_url: `${sitio}/precios`,
  });

  return NextResponse.redirect(sesion.url!, 303);
}
