// SEO del listado de vacantes: título, descripción y dirección canónica según
// los filtros, y la lista de búsquedas que van en el sitemap.

import { CATEGORIAS, NOMBRE_CATEGORIA, NOMBRE_ZONA, PAISES, type Categoria, type Modalidad, type Zona } from "./tipos.ts";

/** Lo mínimo de los filtros que hace falta aquí (Filtros de lib/vacantes.ts lo cumple). */
export interface FiltrosSeo {
  q: string;
  categoria: Categoria | "";
  pais: string;
  modalidad: Modalidad | "";
  zona: Zona | "";
  alcance: "cerca" | "todo";
  pagina: number;
}

function lugarDe(f: FiltrosSeo): string {
  if (f.zona) return `en ${NOMBRE_ZONA[f.zona]}`;
  if (f.modalidad === "remoto") return "home office";
  if (f.alcance === "cerca") return "cerca de ti";
  if (f.pais) return `en ${PAISES[f.pais]}`;
  return "en todo México y LATAM";
}

/** "Ventas · home office", "Vacantes en Sonora", "Software e ingeniería en México"… */
export function tituloDeFiltros(f: FiltrosSeo): string {
  const lugar = lugarDe(f);
  if (f.categoria) return `${NOMBRE_CATEGORIA[f.categoria]}${lugar === "home office" ? " · home office" : ` ${lugar}`}`;
  if (lugar === "home office") return "Home office / remoto";
  return `Vacantes ${lugar}`;
}

/** Texto para Google (meta description) de esa búsqueda. */
export function descripcionDeFiltros(f: FiltrosSeo): string {
  const que = f.categoria ? `Vacantes de ${NOMBRE_CATEGORIA[f.categoria].toLowerCase()}` : "Vacantes";
  const lugar = lugarDe(f);
  const donde =
    lugar === "home office"
      ? "100 % remotas (home office) que aceptan gente en México y LATAM"
      : lugar === "cerca de ti"
        ? "en Sonora y home office"
        : lugar;
  return `${que} ${donde}, sacadas directo de las páginas de empleo de las empresas. Aplica directo, con menos competencia que en LinkedIn u OCC. Actualizado todos los días.`;
}

/**
 * Dirección canónica: solo área y lugar (y página). Así "?categoria=ventas&dias=7&sueldo=1"
 * no compite en Google con "?categoria=ventas", y las búsquedas por texto no se indexan.
 */
export function rutaCanonica(f: FiltrosSeo): string {
  const u = new URLSearchParams();
  if (f.categoria) u.set("categoria", f.categoria);
  if (f.zona) u.set("donde", f.zona);
  else if (f.modalidad === "remoto") u.set("donde", "remoto");
  else if (f.pais === "MX") u.set("donde", "mx");
  else if (f.pais) u.set("pais", f.pais);
  if (f.pagina > 1) u.set("pagina", String(f.pagina));
  const s = u.toString();
  return s ? `/vacantes?${s}` : "/vacantes";
}

/** Solo se indexan las búsquedas "limpias" (sin texto libre ni filtros finos). */
export function indexable(f: FiltrosSeo, params: Record<string, unknown>): boolean {
  if (f.q) return false;
  const extras = Object.keys(params).filter((k) => !["categoria", "donde", "pais", "pagina"].includes(k));
  return extras.length === 0;
}

const LUGARES_SITEMAP = ["", "donde=remoto", "donde=mx", "donde=sonora"];

/** Búsquedas que van en el sitemap: cada área × (todo, home office, México, Sonora). */
export function busquedasSitemap(): string[] {
  const rutas: string[] = [];
  for (const lugar of LUGARES_SITEMAP) {
    if (lugar) rutas.push(`/vacantes?${lugar}`);
    for (const c of CATEGORIAS) {
      if (c === "otros") continue;
      rutas.push(`/vacantes?categoria=${c}${lugar ? `&${lugar}` : ""}`);
    }
  }
  return rutas;
}
