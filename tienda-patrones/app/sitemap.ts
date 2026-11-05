import type { MetadataRoute } from "next";
import { PATRONES } from "@/lib/catalogo";
import { urlSitio } from "@/lib/config";
import { CATEGORIAS_PATRONAJE } from "@/patronaje/modelos/tipos.ts";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = urlSitio();
  const fijas = ["", "/patrones", "/aprende", ...Object.keys(CATEGORIAS_PATRONAJE).map((c) => `/aprende/${c}`), "/medidas", "/como-imprimir", "/preguntas", "/licencia"];
  return [
    ...fijas.map((r) => ({ url: base + r, changeFrequency: "weekly" as const, priority: r === "" ? 1 : 0.6 })),
    ...PATRONES.map((p) => ({ url: `${base}/patrones/${p.slug}`, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
