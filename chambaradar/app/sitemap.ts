import type { MetadataRoute } from "next";
import { rutaVacante, vacantesPublicas } from "@/lib/publicas";
import { busquedasSitemap } from "@/lib/seo";
import { urlSitio } from "@/lib/sitio";

// Se genera en cada petición: las vacantes cambian todos los días.
export const dynamic = "force-dynamic";

const PAGINAS: { ruta: string; prioridad: number; frecuencia: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { ruta: "/", prioridad: 1, frecuencia: "daily" },
  { ruta: "/vacantes", prioridad: 0.9, frecuencia: "daily" },
  { ruta: "/empresas", prioridad: 0.7, frecuencia: "daily" },
  { ruta: "/obregon", prioridad: 0.7, frecuencia: "daily" },
  { ruta: "/cv", prioridad: 0.7, frecuencia: "monthly" },
  { ruta: "/herramientas", prioridad: 0.6, frecuencia: "monthly" },
  { ruta: "/herramientas/sueldo-neto", prioridad: 0.7, frecuencia: "monthly" },
  { ruta: "/herramientas/dolares-a-pesos", prioridad: 0.7, frecuencia: "weekly" },
  ...[500, 800, 1000, 1200, 1500, 2000, 2500, 3000, 3500, 4000, 5000, 6000, 8000, 10000].map((m) => ({ ruta: `/herramientas/dolares-a-pesos/${m}`, prioridad: 0.5, frecuencia: "weekly" as const })),
  { ruta: "/publicar", prioridad: 0.6, frecuencia: "monthly" },
  { ruta: "/precios", prioridad: 0.5, frecuencia: "monthly" },
  { ruta: "/empezar", prioridad: 0.4, frecuencia: "monthly" },
  { ruta: "/privacidad", prioridad: 0.2, frecuencia: "yearly" },
  { ruta: "/terminos", prioridad: 0.2, frecuencia: "yearly" },
];

/** Next.js no escapa la URL al escribir el XML: un "&" suelto deja el sitemap inválido para Google. */
const xml = (url: string) => url.replace(/&/g, "&amp;");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sitio = urlSitio();
  const hoy = new Date();
  // Cada vacante que publican los negocios tiene su página (las demás están detrás del muro)
  const publicas = await vacantesPublicas().catch(() => []);
  return [
    ...PAGINAS.map((p) => ({ url: `${sitio}${p.ruta}`, lastModified: hoy, changeFrequency: p.frecuencia, priority: p.prioridad })),
    ...publicas.map((v) => ({ url: `${sitio}${rutaVacante(v.id)}`, lastModified: new Date(v.vista), changeFrequency: "daily" as const, priority: 0.8 })),
    ...busquedasSitemap().map((ruta) => ({ url: xml(`${sitio}${ruta}`), lastModified: hoy, changeFrequency: "daily" as const, priority: 0.6 })),
  ];
}
