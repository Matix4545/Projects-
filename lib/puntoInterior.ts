// Un punto que cae DENTRO de una colonia (no solo el centro de su recuadro, que en colonias con
// forma de "L" puede caer fuera). Se usa para abrir una colonia desde un enlace (/?colonia=123):
// ese punto es el que se manda si el vecino reporta el agua desde ahí.
import type { MultiPolygon, Polygon, Position } from "geojson";

type Punto = [lat: number, lng: number];

function recuadro(anillo: Position[]) {
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of anillo) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY, area: (maxX - minX) * (maxY - minY) };
}

/**
 * Traza una línea horizontal a media altura del polígono más grande, busca dónde cruza sus
 * bordes y toma el centro del tramo interior más ancho.
 */
export function puntoInterior(geometria: Polygon | MultiPolygon): Punto | null {
  const poligonos = geometria.type === "Polygon" ? [geometria.coordinates] : geometria.coordinates;
  const conBorde = poligonos.filter((p) => p[0]?.length >= 4);
  if (conBorde.length === 0) return null;
  const mayor = conBorde.reduce((a, b) => (recuadro(b[0]).area > recuadro(a[0]).area ? b : a));
  const { minX, minY, maxX, maxY } = recuadro(mayor[0]);
  const y = (minY + maxY) / 2;

  const cruces: number[] = [];
  for (const anillo of mayor) {
    for (let i = 0; i < anillo.length - 1; i++) {
      const [x1, y1] = anillo[i];
      const [x2, y2] = anillo[i + 1];
      if (y1 > y !== y2 > y) cruces.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
    }
  }
  cruces.sort((a, b) => a - b);
  let mejor: [number, number] | null = null;
  for (let i = 0; i + 1 < cruces.length; i += 2) {
    if (!mejor || cruces[i + 1] - cruces[i] > mejor[1] - mejor[0]) mejor = [cruces[i], cruces[i + 1]];
  }
  const x = mejor ? (mejor[0] + mejor[1]) / 2 : (minX + maxX) / 2;
  return [y, x];
}
