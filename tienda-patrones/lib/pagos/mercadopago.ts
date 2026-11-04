import "server-only";
// Mercado Pago Checkout Pro: el comprador paga en la página de Mercado Pago
// (tarjeta, OXXO, SPEI, saldo, meses) y regresa a /gracias.
import { TIENDA, urlSitio } from "../config";
import type { Linea } from "../precios";
import type { ResultadoPago } from "./tipos";

const API = "https://api.mercadopago.com";
const token = () => process.env.MP_ACCESS_TOKEN;

export const mercadoPagoConfigurado = () => Boolean(token());

export async function crearPreferencia(lineas: Linea[], referencia: string): Promise<string> {
  const base = urlSitio();
  const publico = base.startsWith("https://"); // MP rechaza ligas de regreso a localhost
  const cuerpo = {
    items: lineas.map((l) => ({
      id: l.patron.slug,
      title: `Patrón ${l.patron.nombre} · ${l.patron.tipo} (licencia ${l.licencia})`,
      quantity: 1,
      unit_price: l.precio,
      currency_id: TIENDA.monedaCobro,
    })),
    external_reference: referencia,
    back_urls: {
      success: `${base}/gracias?proveedor=mp`,
      pending: `${base}/gracias?proveedor=mp`,
      failure: `${base}/carrito?pago=fallido`,
    },
    ...(publico ? { auto_return: "approved", notification_url: `${base}/api/webhooks/mercadopago` } : {}),
    statement_descriptor: TIENDA.nombre.slice(0, 22),
  };
  const r = await fetch(`${API}/checkout/preferences`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Mercado Pago respondió ${r.status}: ${await r.text()}`);
  const datos = (await r.json()) as { init_point?: string };
  if (!datos.init_point) throw new Error("Mercado Pago no devolvió la liga de pago");
  return datos.init_point;
}

export async function consultarPago(id: string): Promise<ResultadoPago> {
  if (!/^\d{1,20}$/.test(id)) return { estado: "invalido" };
  const r = await fetch(`${API}/v1/payments/${id}`, {
    headers: { Authorization: `Bearer ${token()}` },
    cache: "no-store",
  });
  if (!r.ok) return { estado: "invalido" };
  const p = (await r.json()) as {
    id: number;
    status: string;
    external_reference?: string;
    transaction_amount?: number;
    currency_id?: string;
    payer?: { email?: string };
  };
  const estado = p.status === "approved" ? "aprobado" : p.status === "pending" || p.status === "in_process" || p.status === "authorized" ? "pendiente" : "rechazado";
  return {
    estado,
    id: `mp:${p.id}`,
    referencia: p.external_reference ?? null,
    correo: p.payer?.email ?? null,
    total: p.transaction_amount ?? null,
    moneda: p.currency_id ?? null,
    liga: `${urlSitio()}/gracias?proveedor=mp&payment_id=${p.id}`,
  };
}
