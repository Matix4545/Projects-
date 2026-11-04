import "server-only";
import { headers } from "next/headers";
import { esDeSonora, leerGeo } from "./geo.ts";

// Acceso gratis para la gente de Cd. Obregón. Netlify manda en cada visita
// el encabezado "x-nf-geo" (JSON en base64) con el estado del visitante según
// su IP. Usamos el estado (Sonora) y no la ciudad porque muchos celulares de
// Obregón aparecen como de Hermosillo u otra ciudad del estado.

/** Código de país del visitante según su IP ("MX", "PE"…), o null si no se sabe. DEMO_PAIS lo simula en desarrollo. */
export async function paisVisitante(): Promise<string | null> {
  if (process.env.NODE_ENV !== "production" && process.env.DEMO_PAIS) return process.env.DEMO_PAIS;
  try {
    return leerGeo((await headers()).get("x-nf-geo"))?.country?.code?.toUpperCase() ?? null;
  } catch {
    return null;
  }
}

/** ¿El visitante está en Sonora? (DEMO_SONORA=1 lo simula en desarrollo) */
export async function visitanteLocal(): Promise<boolean> {
  if (process.env.NODE_ENV !== "production" && process.env.DEMO_SONORA === "1") return true;
  try {
    return esDeSonora(leerGeo((await headers()).get("x-nf-geo")));
  } catch {
    return false; // fuera de una petición (p. ej. funciones programadas)
  }
}
