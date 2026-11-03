import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { escaparHtml } from "@/lib/alertas";
import { enviarUno } from "@/lib/correo";
import { planPorMonto } from "@/lib/planes";
import { urlSitio } from "@/lib/sitio";

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
  // Si Stripe le cobró en otra moneda (p. ej. USD a alguien fuera de México),
  // el monto original en pesos viene en currency_conversion
  const conversion = sesion.currency_conversion;
  const montoMxn = conversion?.source_currency === "mxn" ? conversion.amount_total : sesion.currency === "mxn" ? sesion.amount_total : null;
  const plan = planPorMonto(montoMxn);
  // Sin sesión al pagar: el acceso va al correo que puso en Stripe
  const correo = sesion.customer_details?.email ?? sesion.customer_email ?? null;
  if ((!usuario && !correo) || !plan) return NextResponse.json({ error: "Pago sin usuario ni correo, o con monto desconocido" }, { status: 422 });

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const comun = {
    p_clave: clave,
    p_sesion: sesion.id,
    p_plan: plan.id,
    p_dias: plan.dias,
    p_monto: montoMxn ?? plan.precio * 100,
    p_moneda: "mxn",
  };
  const { data: resultado, error } = usuario
    ? await sb.rpc("registrar_pago", { ...comun, p_usuario: usuario })
    : await sb.rpc("registrar_pago_por_correo", { ...comun, p_correo: correo });
  // Si falla, Stripe reintenta el webhook más tarde
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Pagó sin cuenta: le mandamos cómo entrar
  if (!usuario && correo && resultado === "pendiente") {
    const entrar = `${urlSitio()}/entrar?siguiente=%2Fvacantes`;
    const correoHtml = escaparHtml(correo);
    await enviarUno({
      para: correo,
      asunto: "Tu acceso a ChambaRadar está listo",
      texto: `¡Gracias por tu pago! Tu plan de ${plan.nombre} ya está listo. Entra con este mismo correo (${correo}) aquí: ${entrar}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a"><p style="font-size:22px;font-weight:800;margin:0 0 16px">Chamba<span style="color:#2563eb">Radar</span></p><p style="font-size:16px;margin:0 0 12px">¡Gracias por tu pago! Tu plan de <strong>${plan.nombre}</strong> ya está listo.</p><p style="font-size:16px;margin:0 0 20px">Entra con este mismo correo (<strong>${correoHtml}</strong>) para ver las empresas y aplicar:</p><p style="margin:0 0 24px"><a href="${entrar}" style="display:inline-block;background:#2563eb;color:#ffffff;font-weight:700;padding:12px 24px;border-radius:999px;text-decoration:none">Entrar a ChambaRadar</a></p><p style="font-size:13px;color:#64748b;margin:0">Te pediremos tu correo y te llegará un enlace para entrar, sin contraseña.</p></div>`,
    });
  }
  return NextResponse.json({ ok: true });
}
