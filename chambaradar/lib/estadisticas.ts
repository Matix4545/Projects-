// Contador de visitas propio. Sin cookies y sin guardar la IP: de cada visita
// solo se guarda la página, la zona (estado), el tipo de dispositivo, de dónde
// llegó y un código anónimo del día (hash de IP + navegador + fecha + sal),
// que cambia cada día y no permite seguir a nadie de un día a otro.

import type { Geo } from "./geo.ts";

export type Zona = "obregon" | "sonora" | "mexico" | "extranjero" | "desconocida";
export type TipoEvento = "vista" | "aplicar" | "aplicar_bloqueada";

export const NOMBRE_ZONA_VISITA: Record<Zona, string> = {
  obregon: "Cd. Obregón (Cajeme)",
  sonora: "Resto de Sonora",
  mexico: "Resto de México",
  extranjero: "Otros países",
  desconocida: "Sin ubicación",
};

const plano = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function zonaDeGeo(g: Geo | null): Zona {
  if (!g?.country?.code) return "desconocida";
  if (g.country.code !== "MX") return "extranjero";
  const sonora = g.subdivision?.code === "SON" || /sonora/i.test(g.subdivision?.name ?? "");
  if (!sonora) return "mexico";
  return /obregon|cajeme|esperanza|bacum|pueblo yaqui/.test(plano(g.city ?? "")) ? "obregon" : "sonora";
}

export function dispositivoDe(ua: string): "movil" | "escritorio" {
  return /mobi|android|iphone|ipad|ipod/i.test(ua) ? "movil" : "escritorio";
}

/** Robots, vistas previas de enlaces y herramientas: no cuentan como visitas. */
export function esBot(ua: string): boolean {
  return !ua || /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|lighthouse|headless|curl|wget|python|node-fetch|axios|monitor/i.test(ua);
}

/** De dónde llegó: buscador, red social, mensajería, otro sitio o directo. */
export function origenDe(referente: string, dominioPropio: string): string {
  if (!referente) return "directo";
  let host = "";
  try {
    host = new URL(referente).hostname.replace(/^www\./, "");
  } catch {
    return "directo";
  }
  if (!host || host === dominioPropio.replace(/^www\./, "") || host.endsWith(".netlify.app")) return "interno";
  if (/(^|\.)google\./.test(host)) return "google";
  if (/bing\.|duckduckgo\.|yahoo\.|ecosia\./.test(host)) return "otro buscador";
  if (/facebook\.|fb\.|messenger\./.test(host)) return "facebook";
  if (/instagram\./.test(host)) return "instagram";
  if (/whatsapp\.|wa\.me/.test(host)) return "whatsapp";
  if (/t\.co$|twitter\.|x\.com/.test(host)) return "x / twitter";
  if (/linkedin\./.test(host)) return "linkedin";
  if (/tiktok\./.test(host)) return "tiktok";
  return host.slice(0, 60);
}

const PARAMETROS_RUTA = ["categoria", "donde", "pais", "modalidad", "zona"];

/** Ruta sin datos personales: solo la página y los filtros de área/lugar. La búsqueda va aparte. */
export function limpiarRuta(ruta: string): { ruta: string; busqueda: string | null } {
  let u: URL;
  try {
    u = new URL(ruta, "https://x.local");
  } catch {
    return { ruta: "/", busqueda: null };
  }
  const p = new URLSearchParams();
  for (const k of PARAMETROS_RUTA) {
    const v = u.searchParams.get(k);
    if (v && /^[a-z0-9-]{1,30}$/i.test(v)) p.set(k, v);
  }
  const q = (u.searchParams.get("q") ?? "").trim().toLowerCase().replace(/\s+/g, " ").slice(0, 60);
  const s = p.toString();
  return { ruta: `${u.pathname.slice(0, 80)}${s ? `?${s}` : ""}`, busqueda: q || null };
}

/** No se cuentan las páginas internas (panel, cuenta, API). */
export function rutaContable(ruta: string): boolean {
  return !/^\/(panel|api|auth|salir|cuenta|entrar)(\/|$|\?)/.test(ruta);
}

/** Código anónimo del visitante, distinto cada día. */
export async function visitanteDelDia(ip: string, ua: string, fecha: string, sal: string): Promise<string> {
  const datos = new TextEncoder().encode(`${sal}|${fecha}|${ip}|${ua}`);
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", datos));
  return [...h.slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Campaña de anuncio ("facebook/lanzamiento-co"): solo letras, números y - _ / . (máx. 60). */
export function limpiarCampana(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const c = valor.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_\-/.]/g, "").slice(0, 60);
  return c || null;
}
