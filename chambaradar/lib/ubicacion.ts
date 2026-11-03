import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { esDeSonora, leerGeo } from "./geo.ts";

// Acceso gratis para la gente de Sonora, por dos vías:
// 1. El estado según la IP (encabezado "x-nf-geo" de Netlify). Funciona con
//    datos móviles, pero el internet de casa suele salir como de la CDMX.
// 2. Verificación con el GPS del teléfono o la computadora (/api/ubicacion):
//    deja una cookie firmada por 30 días. Las coordenadas no se guardan.

export const COOKIE_LOCAL = "cr_sonora";
export const DIAS_VERIFICADO = 30;

function firma(vence: number): string {
  return createHmac("sha256", process.env.CHAMBARADAR_CLAVE ?? "").update(`sonora|${vence}`).digest("base64url");
}

/** Valor de la cookie: "vencimiento.firma" */
export function marcaSonora(ahora = Date.now()): string {
  const vence = Math.floor(ahora / 1000) + DIAS_VERIFICADO * 86_400;
  return `${vence}.${firma(vence)}`;
}

export function marcaValida(valor: string | undefined, ahora = Date.now()): boolean {
  if (!valor || !process.env.CHAMBARADAR_CLAVE) return false;
  const [texto, f] = valor.split(".");
  const vence = Number(texto);
  if (!Number.isInteger(vence) || vence * 1000 < ahora || !f) return false;
  const esperada = Buffer.from(firma(vence));
  const recibida = Buffer.from(f);
  return esperada.length === recibida.length && timingSafeEqual(esperada, recibida);
}

/** ¿El visitante está en Sonora? (DEMO_SONORA=1 lo simula en desarrollo) */
export async function visitanteLocal(): Promise<boolean> {
  if (process.env.NODE_ENV !== "production" && process.env.DEMO_SONORA === "1") return true;
  try {
    if (esDeSonora(leerGeo((await headers()).get("x-nf-geo")))) return true;
    return marcaValida((await cookies()).get(COOKIE_LOCAL)?.value);
  } catch {
    return false; // fuera de una petición (p. ej. funciones programadas)
  }
}
