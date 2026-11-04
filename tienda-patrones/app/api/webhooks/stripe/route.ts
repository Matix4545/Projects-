import { NextResponse } from "next/server";
import { entregarPedido } from "@/lib/entrega";
import { firmaStripeValida } from "@/lib/firma";
import { verificarPago } from "@/lib/pagos";

// Eventos a activar en Stripe → Webhooks:
//   checkout.session.completed  y  checkout.session.async_payment_succeeded (OXXO)
export async function POST(req: Request) {
  const secreto = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secreto) return NextResponse.json({ error: "Webhook sin configurar" }, { status: 503 });

  const cuerpo = await req.text();
  if (!firmaStripeValida(cuerpo, req.headers.get("stripe-signature"), secreto)) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
  }

  const evento = JSON.parse(cuerpo) as { type: string; data: { object: { id: string } } };
  if (evento.type === "checkout.session.completed" || evento.type === "checkout.session.async_payment_succeeded") {
    try {
      const { resultado, articulos } = await verificarPago({ proveedor: "stripe", session_id: evento.data.object.id });
      await entregarPedido(resultado, articulos);
    } catch (e) {
      console.error("Webhook Stripe", e);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}
