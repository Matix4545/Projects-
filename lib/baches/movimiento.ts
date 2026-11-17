// Dónde va el vehículo y hacia dónde, a partir del GPS, para ubicar los baches en el mapa.
// Si el GPS da velocidad y rumbo se usan; si no, se calculan con el desplazamiento de al menos
// 1 segundo y hasta 4 (con lecturas muy juntas, un error de 2 m parecería una velocidad enorme).
import { aLocal, rumboEntre, sueloALatLng } from "./geometria.ts";

type Lectura = { lat: number; lng: number; t: number };

const VEL_MAX = 45; // m/s (160 km/h): más que eso es un salto del GPS

export class Movimiento {
  private historial: Lectura[] = [];
  /** m/s */
  vel = 0;
  /** Grados desde el norte; null hasta que el vehículo se mueve */
  rumbo: number | null = null;

  get ultima(): Lectura | null {
    return this.historial[this.historial.length - 1] ?? null;
  }

  /** Lectura del GPS (t en segundos); velocidad en m/s y rumbo en grados, si el GPS los da */
  lectura(lat: number, lng: number, t: number, velocidad?: number | null, rumbo?: number | null) {
    const previa = this.ultima;
    if (previa && t <= previa.t) return; // llegó desordenada o repetida
    this.historial.push({ lat, lng, t });
    while (this.historial.length > 2 && t - this.historial[0].t > 4) this.historial.shift();

    // Velocidad
    if (velocidad != null && Number.isFinite(velocidad) && velocidad >= 0 && velocidad <= VEL_MAX) {
      this.vel = velocidad;
    } else {
      // La lectura más vieja de los últimos 4 s (al menos 1 s antes): más base, menos ruido
      const base = this.historial[0];
      if (t - base.t >= 1) this.vel = Math.min(VEL_MAX, Math.hypot(...aLocal([lat, lng], [base.lat, base.lng])) / (t - base.t));
    }

    // Rumbo
    if (rumbo != null && Number.isFinite(rumbo) && this.vel > 1.5) {
      this.rumbo = rumbo;
    } else {
      const base = this.historial[0];
      if (base !== this.ultima && Math.hypot(...aLocal([lat, lng], [base.lat, base.lng])) >= 4) {
        this.rumbo = rumboEntre([base.lat, base.lng], [lat, lng]);
      }
    }
  }

  /** Posición estimada en el instante t: la última lectura más lo que avanzó desde entonces */
  posicionEn(t: number): { lat: number; lng: number; rumbo: number } | null {
    const u = this.ultima;
    if (!u || this.rumbo == null || t - u.t > 5) return null;
    const avance = this.vel * Math.min(Math.max(t - u.t, 0), 1.2);
    const [lat, lng] = sueloALatLng([0, avance], u.lat, u.lng, this.rumbo);
    return { lat, lng, rumbo: this.rumbo };
  }
}
