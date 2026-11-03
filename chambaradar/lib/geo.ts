// Lectura del encabezado "x-nf-geo" de Netlify (JSON, normalmente en base64).

export interface Geo {
  city?: string;
  country?: { code?: string };
  subdivision?: { code?: string; name?: string };
}

export function leerGeo(valor: string | null | undefined): Geo | null {
  if (!valor) return null;
  for (const texto of [valor, Buffer.from(valor, "base64").toString("utf8")]) {
    try {
      const g = JSON.parse(texto);
      if (g && typeof g === "object") return g as Geo;
    } catch {
      // se intenta el otro formato
    }
  }
  return null;
}

export function esDeSonora(g: Geo | null): boolean {
  if (!g || g.country?.code !== "MX") return false;
  return g.subdivision?.code === "SON" || /sonora/i.test(g.subdivision?.name ?? "");
}

// Contorno aproximado de Sonora (lon, lat), un poco hacia el mar por el lado
// del Golfo. Sirve para verificar con el GPS a quien su internet de casa
// aparece como de otro estado (Telmex, Totalplay y Megacable suelen salir
// como "Ciudad de México").
const SONORA: [number, number][] = [
  [-114.82, 32.5], // San Luis Río Colorado
  [-111.07, 31.33], // frontera, Nogales
  [-108.21, 31.33], // esquina con Chihuahua
  [-108.6, 30.0],
  [-108.9, 28.8],
  [-108.45, 27.9],
  [-108.45, 26.9], // con Chihuahua y Sinaloa
  [-109.25, 26.3], // Agiabampo, límite con Sinaloa
  [-110.0, 26.6],
  [-110.7, 27.2],
  [-111.3, 27.9],
  [-112.2, 28.8],
  [-113.0, 29.9],
  [-113.6, 31.1],
  [-114.65, 31.65], // Golfo de Santa Clara
];

/** ¿El punto (GPS) está dentro de Sonora? Rayo contra el contorno. */
export function dentroDeSonora(lat: number, lon: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  let dentro = false;
  for (let i = 0, j = SONORA.length - 1; i < SONORA.length; j = i++) {
    const [xi, yi] = SONORA[i];
    const [xj, yj] = SONORA[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}
