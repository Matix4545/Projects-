// Dominio público y datos del sitio para metadatos, sitemap, JSON-LD y llms.txt.

/** Dominio público (Vercel lo da automáticamente; NEXT_PUBLIC_SITE_URL si hay dominio propio) */
export const DOMINIO = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
).replace(/\/+$/, "");

export const NOMBRE_SITIO = "Reporta Cajeme";

/** "/guias" → "https://dominio/guias" */
export const urlAbsoluta = (ruta: string) => `${DOMINIO}${ruta.startsWith("/") ? ruta : `/${ruta}`}`;

/** Fecha de la última revisión del contenido de guías y herramientas (para sitemap y JSON-LD) */
export const CONTENIDO_REVISADO = "2026-11-05";
