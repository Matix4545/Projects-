import type { MetadataRoute } from "next";
import { urlSitio } from "@/lib/sitio";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const sitio = urlSitio();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Páginas privadas o sin contenido para buscadores
        disallow: ["/api/", "/auth/", "/cuenta", "/panel", "/entrar", "/salir", "/alertas/"],
      },
    ],
    sitemap: `${sitio}/sitemap.xml`,
    host: sitio,
  };
}
