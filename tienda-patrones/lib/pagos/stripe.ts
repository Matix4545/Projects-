import "server-only";
// Stripe Checkout: tarjetas de cualquier país (y OXXO en México si lo activas en
// tu panel de Stripe). Con "Adaptive Pricing" el comprador ve el total en su moneda.
import { TIENDA, urlSitio } from "../config";
import type { Linea } from "../precios";
import type { ResultadoPago } from "./tipos";

const API = "https://api.stripe.com/v1";
const llave = () => process.env.STRIPE_SECRET_KEY;

export const stripeConfigurado = () => Boolean(llave());

export async function crearSesion(lineas: Linea[], referencia: string): Promise<string> {
  const base = urlSitio();
  const f = new URLSearchParams();
  f.set("mode", "payment");
  f.set("locale", "es-419");
  f.set("success_url", `${base}/gracias?proveedor=stripe&session_id={CHECKOUT_SESSION_ID}`);
  f.set("cancel_url", `${base}/carrito`);
  f.set("metadata[ref]", referencia);
  f.set("payment_intent_data[metadata][ref]", referencia);
  lineas.forEach((l, i) => {
    f.set(`line_items[${i}][quantity]`, "1");
    f.set(`line_items[${i}][price_data][currency]`, TIENDA.monedaCobro.toLowerCase());
    f.set(`line_items[${i}][price_data][unit_amount]`, String(Math.round(l.precio * 100)));
    f.set(`line_items[${i}][price_data][product_data][name]`, `Patrón ${l.patron.nombre} · ${l.patron.tipo}`);
    f.set(`line_items[${i}][price_data][product_data][description]`, `Licencia ${l.licencia}. Archivos digitales, descarga inmediata.`);
  });
  const r = await fetch(`${API}/checkout/sessions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${llave()}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: f,
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Stripe respondió ${r.status}: ${await r.text()}`);
  const datos = (await r.json()) as { url?: string };
  if (!datos.url) throw new Error("Stripe no devolvió la liga de pago");
  return datos.url;
}

export async function consultarSesion(id: string): Promise<ResultadoPago> {
  if (!/^cs_[A-Za-z0-9_]{10,200}$/.test(id)) return { estado: "invalido" };
  const r = await fetch(`${API}/checkout/sessions/${id}`, {
    headers: { Authorization: `Bearer ${llave()}` },
    cache: "no-store",
  });
  if (!r.ok) return { estado: "invalido" };
  const s = (await r.json()) as {
    id: string;
    status: string;
    payment_status: string;
    metadata?: { ref?: string };
    customer_details?: { email?: string };
    amount_total?: number;
    currency?: string;
  };
  const estado =
    s.payment_status === "paid" || s.payment_status === "no_payment_required"
      ? "aprobado"
      : s.status === "complete"
        ? "pendiente" // p. ej. ficha OXXO generada pero aún no pagada
        : "rechazado";
  return {
    estado,
    id: `stripe:${s.id}`,
    referencia: s.metadata?.ref ?? null,
    correo: s.customer_details?.email ?? null,
    total: typeof s.amount_total === "number" ? s.amount_total / 100 : null,
    moneda: s.currency?.toUpperCase() ?? null,
    liga: `${urlSitio()}/gracias?proveedor=stripe&session_id=${s.id}`,
  };
}
