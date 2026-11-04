// Firmas HMAC sin estado: referencias de pedido y ligas de descarga.
// Funciones puras (el secreto se pasa como parámetro) para poder probarlas.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Licencia } from "./config";
import type { Articulo } from "./precios";

const LIC_A_LETRA: Record<Licencia, string> = { personal: "p", emprendedora: "e" };
const LETRA_A_LIC: Record<string, Licencia> = { p: "personal", e: "emprendedora" };

function hmac(secreto: string, texto: string, largo = 22): string {
  return createHmac("sha256", secreto).update(texto).digest("base64url").slice(0, largo);
}

function iguales(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// ── Referencia de pedido ─────────────────────────────────────────────────────
// Va en external_reference (Mercado Pago) o metadata (Stripe). Ej.:
//   "vestido-amapola~e.blusa-jacaranda~p|q8Xc..."
// Al volver del pago solo aceptamos referencias firmadas por nosotros.
export function crearReferencia(secreto: string, articulos: Articulo[]): string {
  const cuerpo = articulos.map((a) => `${a.slug}~${LIC_A_LETRA[a.licencia]}`).join(".");
  return `${cuerpo}|${hmac(secreto, "ref:" + cuerpo)}`;
}

export function leerReferencia(secreto: string, ref: string | null | undefined): Articulo[] | null {
  if (!ref) return null;
  const i = ref.lastIndexOf("|");
  if (i <= 0) return null;
  const cuerpo = ref.slice(0, i);
  if (!iguales(ref.slice(i + 1), hmac(secreto, "ref:" + cuerpo))) return null;
  const articulos: Articulo[] = [];
  for (const parte of cuerpo.split(".")) {
    const [slug, letra] = parte.split("~");
    const licencia = LETRA_A_LIC[letra];
    if (!slug || !licencia) return null;
    articulos.push({ slug, licencia });
  }
  return articulos;
}

// ── Token de descarga ────────────────────────────────────────────────────────
export type Descarga = { slug: string; formato: string; vence: number };

export function crearTokenDescarga(secreto: string, d: Descarga): string {
  const cuerpo = Buffer.from(JSON.stringify([d.slug, d.formato, d.vence])).toString("base64url");
  return `${cuerpo}.${hmac(secreto, "dl:" + cuerpo, 32)}`;
}

export function leerTokenDescarga(secreto: string, token: string | null | undefined, ahora = Date.now()): Descarga | null {
  if (!token) return null;
  const [cuerpo, firma] = token.split(".");
  if (!cuerpo || !firma || !iguales(firma, hmac(secreto, "dl:" + cuerpo, 32))) return null;
  try {
    const [slug, formato, vence] = JSON.parse(Buffer.from(cuerpo, "base64url").toString());
    if (typeof slug !== "string" || typeof formato !== "string" || typeof vence !== "number") return null;
    if (vence < ahora) return null;
    return { slug, formato, vence };
  } catch {
    return null;
  }
}

// ── Webhook de Stripe ────────────────────────────────────────────────────────
/** Verifica la firma del webhook (encabezado Stripe-Signature). */
export function firmaStripeValida(cuerpo: string, encabezado: string | null, secreto: string, ahora = Date.now()): boolean {
  if (!encabezado) return false;
  const partes = Object.fromEntries(
    encabezado.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i), p.slice(i + 1)];
    }),
  ) as Record<string, string>;
  const t = Number(partes.t);
  if (!t || Math.abs(ahora / 1000 - t) > 300) return false; // 5 minutos de tolerancia
  const esperada = createHmac("sha256", secreto).update(`${t}.${cuerpo}`).digest("hex");
  const firmas = encabezado
    .split(",")
    .filter((p) => p.startsWith("v1="))
    .map((p) => p.slice(3));
  return firmas.some((f) => f.length === esperada.length && timingSafeEqual(Buffer.from(f), Buffer.from(esperada)));
}
