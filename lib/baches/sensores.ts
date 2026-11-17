// Hacia dónde está el piso visto desde la cámara, con los sensores del celular.
// Se promedia mucho tiempo (≈20 s): el celular va fijo en su soporte, así que la inclinación
// real casi no cambia, y un promedio largo quita el efecto de frenar, acelerar o de las subidas.
import { abajoDesdeOrientacion, abajoEnCamara, normalizar, type Vec3 } from "./geometria";

export function anguloPantalla(): number {
  const a = screen.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0;
  return ((Math.round(a) % 360) + 360) % 360;
}

export class Orientacion {
  private suma: Vec3 | null = null;
  private desde = 0;
  private angulo = -1;
  /** Segundos de la última lectura (para saber si el sensor está funcionando) */
  ultima = 0;

  constructor(private tauLargo = 20) {}

  lectura(beta: number | null, gamma: number | null, t: number) {
    if (beta == null || gamma == null || !Number.isFinite(beta) || !Number.isFinite(gamma)) return;
    const ang = anguloPantalla();
    if (ang !== this.angulo) {
      // Se giró la pantalla: se empieza de nuevo
      this.angulo = ang;
      this.suma = null;
    }
    const g = abajoEnCamara(abajoDesdeOrientacion(beta, gamma), ang);
    if (!this.suma) {
      this.suma = g;
      this.desde = t;
    } else {
      const dt = Math.min(Math.max(t - this.ultima, 0), 1);
      // Los primeros 3 s se ajusta rápido; después, promedio largo
      const tau = t - this.desde < 3 ? 0.5 : this.tauLargo;
      const k = dt / (tau + dt);
      this.suma = normalizar([this.suma[0] + k * (g[0] - this.suma[0]), this.suma[1] + k * (g[1] - this.suma[1]), this.suma[2] + k * (g[2] - this.suma[2])]);
    }
    this.ultima = t;
  }

  /** "Abajo" en ejes de la cámara, o null si todavía no hay lecturas */
  abajo(): Vec3 | null {
    return this.suma;
  }
}
