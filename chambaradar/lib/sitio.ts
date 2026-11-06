/** Dominio público del sitio (para enlaces de correo y de Stripe). */
export function urlSitio(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
  ).replace(/\/$/, "");
}

/** Solo permite redirigir a rutas internas ("/precios"), nunca a otro dominio. */
export function rutaSegura(ruta: string | null | undefined, porDefecto = "/vacantes"): string {
  if (!ruta || !ruta.startsWith("/") || ruta.startsWith("//") || ruta.startsWith("/\\")) return porDefecto;
  return ruta;
}
