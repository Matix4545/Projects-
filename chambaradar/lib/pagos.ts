import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfigurado } from "./supabase/servidor.ts";

// Compras confirmadas por Stripe (webhook) y "quién fue a pagar", para medir
// la venta en Meta con el mismo id en el navegador y en el servidor.

/** Cliente sin sesión, solo para funciones que piden la clave de la app. */
function clienteApp() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
}

/** Id de sesión de Stripe Checkout válido (cs_live_… / cs_test_…). */
export function sesionStripeValida(s: string | undefined | null): s is string {
  return typeof s === "string" && /^cs_(live|test)_[A-Za-z0-9]{10,120}$/.test(s);
}

export interface CompraConfirmada {
  plan: string;
  /** En pesos (no centavos) */
  valor: number;
  moneda: string;
}

/** ¿Stripe ya avisó por el webhook que esta sesión se pagó? */
export async function compraConfirmada(sesion: string): Promise<CompraConfirmada | null> {
  if (!supabaseConfigurado() || !sesionStripeValida(sesion)) return null;
  const { data } = await clienteApp().rpc("pago_confirmado", { p_sesion: sesion });
  const r = data as { plan: string; monto: number; moneda: string } | null;
  return r ? { plan: r.plan, valor: r.monto / 100, moneda: (r.moneda || "mxn").toUpperCase() } : null;
}

export interface IntentoPago {
  id: string;
  usuario?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  ip?: string | null;
  ua?: string | null;
}

/** Guarda quién fue a pagar (cookies del píxel, ip, navegador). Nunca falla: medir no debe romper el pago. */
export async function guardarIntentoPago(i: IntentoPago): Promise<void> {
  const clave = process.env.CHAMBARADAR_CLAVE;
  if (!supabaseConfigurado() || !clave) return;
  try {
    await clienteApp().rpc("guardar_intento_pago", { p_clave: clave, p_id: i.id, p_usuario: i.usuario ?? null, p_fbp: i.fbp ?? null, p_fbc: i.fbc ?? null, p_ip: i.ip ?? null, p_ua: i.ua ?? null });
  } catch {
    /* sin registro */
  }
}

export async function leerIntentoPago(id: string | null, usuario: string | null): Promise<IntentoPago | null> {
  const clave = process.env.CHAMBARADAR_CLAVE;
  if (!supabaseConfigurado() || !clave || (!id && !usuario)) return null;
  try {
    const { data } = await clienteApp().rpc("leer_intento_pago", { p_clave: clave, p_id: id, p_usuario: usuario });
    return (data as IntentoPago | null) ?? null;
  } catch {
    return null;
  }
}
