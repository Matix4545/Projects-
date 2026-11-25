// Dónde iba el vehículo, y hacia dónde, en el instante exacto de cada cuadro de video, para ubicar
// los baches en el mapa lo más preciso posible.
//
// · Cada lectura del GPS lleva la hora en que se tomó (no la hora en que llegó a la página).
// · La posición en un instante se INTERPOLA entre la lectura anterior y la siguiente; por eso los
//   cuadros se procesan cuando ya llegó la lectura siguiente (≈1 s de retraso). Solo si no llega se
//   extrapola con la velocidad.
// · Si el GPS da velocidad y rumbo se usan; si no, se calculan con al menos 1 s de recorrido (con
//   lecturas muy juntas, un error de 2 m parecería una velocidad enorme).
import { aLocal, rumboEntre, sueloALatLng } from "./geometria.ts";

type Lectura = { lat: number; lng: number; t: number; rumbo: number | null; precision: number };

const VEL_MAX = 45; // m/s (160 km/h): más que eso es un salto del GPS
const HISTORIAL_S = 15;

export type Posicion = { lat: number; lng: number; rumbo: number; precision: number; interpolada: boolean };

export class Movimiento {
  private historial: Lectura[] = [];
  /** m/s */
  vel = 0;
  /** Grados desde el norte; null hasta que el vehículo se mueve */
  rumbo: number | null = null;

  get ultima(): Lectura | null {
    return this.historial[this.historial.length - 1] ?? null;
  }

  /**
   * Lectura del GPS: t en segundos (la hora en que se tomó), velocidad en m/s y rumbo en grados si el
   * GPS los da, y su precisión en metros.
   */
  lectura(lat: number, lng: number, t: number, velocidad?: number | null, rumbo?: number | null, precision = 10) {
    const previa = this.ultima;
    if (previa && t <= previa.t) return; // llegó desordenada o repetida
    this.historial.push({ lat, lng, t, rumbo: null, precision });
    while (this.historial.length > 2 && t - this.historial[0].t > HISTORIAL_S) this.historial.shift();

    // Velocidad: la del GPS o el desplazamiento desde la lectura de hace 1–4 s
    if (velocidad != null && Number.isFinite(velocidad) && velocidad >= 0 && velocidad <= VEL_MAX) {
      this.vel = velocidad;
    } else {
      const base = this.historial.find((l) => t - l.t <= 4);
      if (base && t - base.t >= 1) this.vel = Math.min(VEL_MAX, Math.hypot(...aLocal([lat, lng], [base.lat, base.lng])) / (t - base.t));
    }

    // Rumbo: el del GPS en movimiento, o el del desplazamiento de los últimos segundos
    if (rumbo != null && Number.isFinite(rumbo) && this.vel > 1.5) {
      this.rumbo = rumbo;
    } else {
      const base = this.historial.find((l) => t - l.t <= 4);
      if (base && base !== this.ultima && Math.hypot(...aLocal([lat, lng], [base.lat, base.lng])) >= 4) {
        this.rumbo = rumboEntre([base.lat, base.lng], [lat, lng]);
      }
    }
    this.ultima!.rumbo = this.rumbo;
  }

  /** ¿Ya llegó una lectura tomada en t o después? (entonces se puede interpolar) */
  cubre(t: number) {
    const u = this.ultima;
    return !!u && u.t >= t;
  }

  /** Posición en el instante t: interpolada entre dos lecturas si se puede, si no extrapolada */
  posicionEn(t: number): Posicion | null {
    const h = this.historial;
    if (!h.length) return null;
    for (let i = h.length - 1; i > 0; i--) {
      const a = h[i - 1];
      const b = h[i];
      if (t < a.t || t > b.t) continue;
      const f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1;
      // Rumbo del tramo entre las dos lecturas (la dirección real del recorrido) si avanzó lo suficiente
      const avance = Math.hypot(...aLocal([b.lat, b.lng], [a.lat, a.lng]));
      const rumbo = avance >= 3 ? rumboEntre([a.lat, a.lng], [b.lat, b.lng]) : (b.rumbo ?? a.rumbo);
      if (rumbo == null) return null;
      return {
        lat: a.lat + (b.lat - a.lat) * f,
        lng: a.lng + (b.lng - a.lng) * f,
        rumbo,
        precision: Math.max(a.precision, b.precision),
        interpolada: true,
      };
    }
    const u = h[h.length - 1];
    if (t < u.t || u.rumbo == null || t - u.t > 5) return null;
    const avance = this.vel * Math.min(t - u.t, 1.2);
    const [lat, lng] = sueloALatLng([0, avance], u.lat, u.lng, u.rumbo);
    return { lat, lng, rumbo: u.rumbo, precision: u.precision + avance * 0.2, interpolada: false };
  }
}

/**
 * Hora actual en segundos, en la misma escala que las lecturas del GPS (milisegundos desde 1970).
 * Con Date.now() y no con performance.now(): este último se detiene mientras el celular duerme y,
 * al despertar, los cuadros quedarían atrasados respecto al GPS (el bache se ubicaría mal).
 */
export const ahora = () => Date.now() / 1000;

/** Hora en que se tomó una lectura del GPS; si el celular da una hora rara, la de llegada */
export function horaDeLectura(timestampMs: number) {
  const t = timestampMs / 1000;
  const a = ahora();
  return Number.isFinite(t) && Math.abs(a - t) < 10 ? t : a;
}
