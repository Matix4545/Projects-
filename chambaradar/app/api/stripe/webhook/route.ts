import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { buscarPlan } from "@/lib/planes";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/servidor";

/**
 * Stripe avisa aquí cuando se paga.
 * - Tarjeta: llega "checkout.session.completed" ya pagado.
 * - OXXO: primero llega "completed" sin pagar y, cuando pagan en tienda,
 *   "checkout.session.async_payment_succeeded".
 */
export async function POST(request: NextRequest) {
  const secreto = process.env.STRIPE_WEBHOOK_SECRET;
  const firma = request.headers.get("stripe-signature");
  if (!secreto || !firma) return NextResponse.json({ error: "Sin firma" }, { status: 400 });

  let evento: Stripe.Event;
  try {
    evento = stripe().webhooks.constructEvent(await request.text(), firma, secreto);
  } catch {
    return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
  }

  const pagado =
    (evento.type === "checkout.session.completed" && evento.data.object.payment_status === "paid") ||
    evento.type === "checkout.session.async_payment_succeeded";
  if (!pagado) return NextResponse.json({ ok: true });

  const sesion = evento.data.object as Stripe.Checkout.Session;
  const usuario = sesion.metadata?.usuario ?? sesion.client_reference_id;
  const plan = buscarPlan(sesion.metadata?.plan);
  if (!usuario || !plan) return NextResponse.json({ error: "Sesión sin usuario o plan" }, { status: 400 });

  const { error } = await supabaseAdmin().rpc("registrar_pago", {
    p_sesion: sesion.id,
    p_usuario: usuario,
    p_plan: plan.id,
    p_dias: plan.dias,
    p_monto: sesion.amount_total ?? plan.precio * 100,
    p_moneda: sesion.currency ?? "mxn",
  });
  // Si falla, Stripe reintenta el webhook más tarde
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
