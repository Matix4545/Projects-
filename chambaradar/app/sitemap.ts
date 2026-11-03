import type { MetadataRoute } from "next";
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
  { ruta: "/publicar", prioridad: 0.6, frecuencia: "monthly" },
  { ruta: "/precios", prioridad: 0.5, frecuencia: "monthly" },
  { ruta: "/empezar", prioridad: 0.4, frecuencia: "monthly" },
  { ruta: "/privacidad", prioridad: 0.2, frecuencia: "yearly" },
  { ruta: "/terminos", prioridad: 0.2, frecuencia: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const sitio = urlSitio();
  const hoy = new Date();
  return [
    ...PAGINAS.map((p) => ({ url: `${sitio}${p.ruta}`, lastModified: hoy, changeFrequency: p.frecuencia, priority: p.prioridad })),
    ...busquedasSitemap().map((ruta) => ({ url: `${sitio}${ruta}`, lastModified: hoy, changeFrequency: "daily" as const, priority: 0.6 })),
  ];
}
