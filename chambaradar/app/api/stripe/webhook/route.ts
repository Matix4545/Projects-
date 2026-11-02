import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { planPorMonto } from "@/lib/planes";

// Solo se usa para verificar la firma del webhook (no llama a la API de Stripe),
// así que no necesita la clave secreta de la cuenta.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_solo_para_verificar_firmas");

/**
 * Stripe avisa aquí cuando se paga un enlace de pago.
 * - Tarjeta: llega "checkout.session.completed" ya pagado.
 * - OXXO: primero llega "completed" sin pagar y, cuando pagan en tienda,
 *   "checkout.session.async_payment_succeeded".
 */
export async function POST(request: NextRequest) {
  const secreto = process.env.STRIPE_WEBHOOK_SECRET;
  const clave = process.env.CHAMBARADAR_CLAVE;
  const firma = request.headers.get("stripe-signature");
  if (!secreto || !clave || !firma) return NextResponse.json({ error: "Webhook sin configurar o sin firma" }, { status: 400 });

  let evento: Stripe.Event;
  try {
    evento = stripe.webhooks.constructEvent(await request.text(), firma, secreto);
  } catch {
    return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
  }

  const pagado =
    (evento.type === "checkout.session.completed" && evento.data.object.payment_status === "paid") ||
    evento.type === "checkout.session.async_payment_succeeded";
  if (!pagado) return NextResponse.json({ ok: true });

  const sesion = evento.data.object as Stripe.Checkout.Session;
  const usuario = sesion.client_reference_id;
  const plan = planPorMonto(sesion.amount_total);
  // Sin usuario no hay a quién darle acceso (p. ej. alguien abrió el enlace directo): se avisa a Stripe
  if (!usuario || !plan) return NextResponse.json({ error: "Pago sin usuario o con monto desconocido" }, { status: 422 });

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { error } = await sb.rpc("registrar_pago", {
    p_clave: clave,
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
