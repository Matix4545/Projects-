import "server-only";
import Stripe from "stripe";

let cliente: Stripe | null = null;

export function stripeConfigurado(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function stripe(): Stripe {
  if (cliente) return cliente;
  const clave = process.env.STRIPE_SECRET_KEY;
  if (!clave) throw new Error("Falta STRIPE_SECRET_KEY.");
  cliente = new Stripe(clave);
  return cliente;
}

/** Métodos de pago de Checkout. OXXO hay que activarlo en el panel de Stripe. */
export function metodosDePago(): Stripe.Checkout.SessionCreateParams.AllowedPaymentMethodType[] {
  const lista = (process.env.STRIPE_METODOS || "card,oxxo").split(",").map((m) => m.trim()).filter(Boolean);
  return lista as Stripe.Checkout.SessionCreateParams.AllowedPaymentMethodType[];
}
