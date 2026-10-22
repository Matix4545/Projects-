// Geometría de tramos de calle ([lat, lng]); sirve en el navegador y en el servidor.
export type Punto = [number, number];

const RADIO_TIERRA_M = 6_371_000;
const rad = (g: number) => (g * Math.PI) / 180;

/** Distancia en metros entre dos puntos (haversine). */
export function distanciaM([lat1, lng1]: Punto, [lat2, lng2]: Punto) {
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * RADIO_TIERRA_M * Math.asin(Math.sqrt(h));
}

export function largoM(puntos: Punto[]) {
  let total = 0;
  for (let i = 1; i < puntos.length; i++) total += distanciaM(puntos[i - 1], puntos[i]);
  return total;
}

/** Punto a la mitad del recorrido (no el promedio): cae sobre la calle. */
export function puntoMedio(puntos: Punto[]): Punto {
  const mitad = largoM(puntos) / 2;
  let andado = 0;
  for (let i = 1; i < puntos.length; i++) {
    const tramo = distanciaM(puntos[i - 1], puntos[i]);
    if (andado + tramo >= mitad && tramo > 0) {
      const t = (mitad - andado) / tramo;
      const [a, b] = [puntos[i - 1], puntos[i]];
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    andado += tramo;
  }
  return puntos[0];
}

/** Quita puntos repetidos seguidos y redondea a 6 decimales (~10 cm). */
export function limpiarTrazo(puntos: Punto[]): Punto[] {
  const r = (n: number) => Math.round(n * 1e6) / 1e6;
  const salida: Punto[] = [];
  for (const [lat, lng] of puntos) {
    const p: Punto = [r(lat), r(lng)];
    const ultimo = salida[salida.length - 1];
    if (!ultimo || ultimo[0] !== p[0] || ultimo[1] !== p[1]) salida.push(p);
  }
  return salida;
}

/** WKT para PostGIS (que usa el orden lng lat). */
export const trazoAWkt = (puntos: Punto[]) => `SRID=4326;LINESTRING(${puntos.map(([lat, lng]) => `${lng} ${lat}`).join(",")})`;
