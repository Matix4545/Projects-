// Secciones electorales (solo modo equipo): tipos y búsqueda de la sección de un punto.
import type { FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";

export type PropsSeccion = {
  seccion: number;
  distrito_local: number | null;
  distrito_federal: number | null;
  total: number;
  puntos: number;
  agua: number;
};
export type SeccionesGeoJSON = FeatureCollection<Polygon | MultiPolygon, PropsSeccion>;

/** ¿El punto (lng, lat) está dentro del anillo? (ray casting) */
function enAnillo([x, y]: Position, anillo: Position[]) {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i];
    const [xj, yj] = anillo[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

function enPoligono(punto: Position, poligono: Position[][]) {
  return enAnillo(punto, poligono[0]) && !poligono.slice(1).some((hueco) => enAnillo(punto, hueco));
}

/** Sección que contiene el punto, o null. */
export function seccionEn(lat: number, lng: number, secciones: SeccionesGeoJSON): PropsSeccion | null {
  for (const f of secciones.features) {
    const g = f.geometry;
    const poligonos = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    if (poligonos.some((p) => enPoligono([lng, lat], p))) return f.properties;
  }
  return null;
}

/** Top de secciones con más reportes */
export const topSecciones = (secciones: SeccionesGeoJSON, n: number) =>
  secciones.features
    .map((f) => f.properties)
    .filter((p) => p.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, n);
