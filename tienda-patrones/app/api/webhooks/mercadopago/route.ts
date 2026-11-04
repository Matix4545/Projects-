import { NextResponse } from "next/server";
import { entregarPedido } from "@/lib/entrega";
import { verificarPago } from "@/lib/pagos";

// Aviso de Mercado Pago cuando cambia un pago (sirve sobre todo para OXXO y SPEI,
// que se acreditan horas después). No confiamos en el contenido del aviso: solo
// tomamos el número de pago y lo consultamos directo a Mercado Pago.
export async function POST(req: Request) {
  const url = new URL(req.url);
  const cuerpo = (await req.json().catch(() => ({}))) as { type?: string; topic?: string; data?: { id?: string | number } };
  const tipo = cuerpo.type ?? cuerpo.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
  const id = String(cuerpo.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "");

  if (tipo === "payment" && /^\d{1,20}$/.test(id)) {
    try {
      const { resultado, articulos } = await verificarPago({ proveedor: "mp", payment_id: id });
      await entregarPedido(resultado, articulos);
    } catch (e) {
      console.error("Webhook Mercado Pago", e);
      return NextResponse.json({ ok: false }, { status: 500 }); // Mercado Pago reintenta
    }
  }
  return NextResponse.json({ ok: true });
}
