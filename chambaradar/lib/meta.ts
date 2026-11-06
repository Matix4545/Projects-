import "server-only";
import { createHash } from "node:crypto";

// API de conversiones de Meta: la compra se manda desde el servidor cuando
// Stripe la confirma (webhook), con el id de la sesión de Stripe como event_id.
// El navegador manda el mismo evento con el mismo id al volver a /cuenta, y
// Meta los junta en uno. Necesita META_CAPI_TOKEN (Administrador de eventos →
// el píxel → Configuración → API de conversiones → Generar token).

const PIXEL = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "";
const TOKEN = process.env.META_CAPI_TOKEN ?? "";

const sha256 = (s: string) => createHash("sha256").update(s.trim().toLowerCase()).digest("hex");

export interface CompraMeta {
  /** Sesión de Stripe Checkout (event_id) */
  sesion: string;
  valor: number;
  moneda: string;
  correo?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  ip?: string | null;
  ua?: string | null;
  url?: string;
}

export function conversionesActivas(): boolean {
  return Boolean(PIXEL && TOKEN);
}

/** Manda "Purchase" a Meta. Nunca lanza: medir no debe romper el webhook. Devuelve si se mandó. */
export async function enviarCompraAMeta(c: CompraMeta): Promise<boolean> {
  if (!conversionesActivas()) return false;
  const user_data: Record<string, unknown> = {};
  if (c.correo) user_data.em = [sha256(c.correo)];
  if (c.fbp) user_data.fbp = c.fbp;
  if (c.fbc) user_data.fbc = c.fbc;
  if (c.ip) user_data.client_ip_address = c.ip;
  if (c.ua) user_data.client_user_agent = c.ua;
  const cuerpo = {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: c.sesion,
        action_source: "website",
        event_source_url: c.url,
        user_data,
        custom_data: { currency: c.moneda.toUpperCase(), value: Number(c.valor.toFixed(2)) },
      },
    ],
  };
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${PIXEL}/events?access_token=${encodeURIComponent(TOKEN)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(8000),
    });
    return r.ok;
  } catch {
    return false;
  }
}
