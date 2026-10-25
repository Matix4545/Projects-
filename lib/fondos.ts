// Fondos del mapa que la persona puede elegir (botón de capas)
import { CENTRO_OBREGON } from "./constantes";

export type Fondo = "mapa" | "claro" | "satelite";

type Mosaicos = { url: string; atribucion: string; maxNativo: number };

export const FONDOS: Record<Fondo, { nombre: string; base: Mosaicos; etiquetas?: Mosaicos }> = {
  mapa: {
    nombre: "Mapa",
    base: {
      url: process.env.NEXT_PUBLIC_TILES_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      atribucion: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxNativo: 19,
    },
  },
  claro: {
    nombre: "Claro",
    base: {
      url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      atribucion: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxNativo: 19,
    },
  },
  satelite: {
    nombre: "Satélite",
    base: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      atribucion: "Imágenes &copy; Esri, Maxar, Earthstar Geographics",
      maxNativo: 18,
    },
    // Nombres de calles y colonias encima de la foto
    etiquetas: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      atribucion: "",
      maxNativo: 18,
    },
  },
};

export const esFondo = (v: unknown): v is Fondo => v === "mapa" || v === "claro" || v === "satelite";

/** Un mosaico de Ciudad Obregón para la vista previa del botón */
export function miniatura(f: Fondo, z = 13) {
  const [lat, lng] = CENTRO_OBREGON;
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const r = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
  return FONDOS[f].base.url.replace("{s}", "a").replace("{r}", "").replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
}
