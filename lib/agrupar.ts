// Agrupa los reportes cercanos en burbujas con número cuando el mapa está alejado
// (como Apple Maps o Google Maps). Sin dependencias: rejilla en píxeles del zoom actual.

/** A partir de este zoom se ven todos los puntos sueltos */
export const ZOOM_SIN_GRUPOS = 16;
/** Tamaño de la celda en píxeles de pantalla */
const CELDA_PX = 56;

/** peso: cuántos reportes representa (el agua de una colonia cuenta todos sus reportes) */
type ConUbicacion = { id: number; lat: number; lng: number; peso?: number };

export type Grupo<T> = { clave: string; lat: number; lng: number; miembros: T[]; total: number };

const pesoDe = (p: ConUbicacion) => p.peso ?? 1;

/** Coordenadas en píxeles (Web Mercator, mosaicos de 256 px) para un zoom */
export function aPixeles(lat: number, lng: number, zoom: number): [number, number] {
  const escala = 256 * 2 ** zoom;
  const s = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180);
  return [((lng + 180) / 360) * escala, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * escala];
}

/**
 * Devuelve los puntos sueltos y los grupos (2 o más reportes) de la misma celda.
 * Con zoom alto, o con el punto seleccionado, nada se agrupa.
 */
export function agrupar<T extends ConUbicacion>(pins: T[], zoom: number, seleccionado?: number | null) {
  if (zoom >= ZOOM_SIN_GRUPOS) return { sueltos: pins, grupos: [] as Grupo<T>[] };
  const celdas = new Map<string, T[]>();
  const sueltos: T[] = [];
  for (const p of pins) {
    if (p.id === seleccionado) {
      sueltos.push(p);
      continue;
    }
    const [x, y] = aPixeles(p.lat, p.lng, zoom);
    const clave = `${Math.floor(x / CELDA_PX)}:${Math.floor(y / CELDA_PX)}`;
    const lista = celdas.get(clave);
    if (lista) lista.push(p);
    else celdas.set(clave, [p]);
  }
  const grupos: Grupo<T>[] = [];
  for (const [clave, miembros] of celdas) {
    const total = miembros.reduce((s, p) => s + pesoDe(p), 0);
    if (total === 1) {
      sueltos.push(miembros[0]);
      continue;
    }
    const lat = miembros.reduce((s, p) => s + p.lat * pesoDe(p), 0) / total;
    const lng = miembros.reduce((s, p) => s + p.lng * pesoDe(p), 0) / total;
    grupos.push({ clave, lat, lng, miembros, total });
  }
  return { sueltos, grupos };
}

/** El valor que más se repite (el tipo de reporte dominante del grupo) */
export function masComun<T>(lista: T[], valor: (x: T) => string, peso: (x: T) => number = () => 1) {
  const cuenta = new Map<string, number>();
  let mejor = "";
  let max = 0;
  for (const x of lista) {
    const v = valor(x);
    const n = (cuenta.get(v) ?? 0) + peso(x);
    cuenta.set(v, n);
    if (n > max) [mejor, max] = [v, n];
  }
  return mejor;
}
