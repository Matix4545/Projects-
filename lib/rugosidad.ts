// Motor de medición de rugosidad de calles (corre en el celular, sin dependencias).
//
// Mide la aceleración vertical (sin gravedad ni inclinación del soporte), la agrupa en
// tramos de ~100 m con el GPS y calcula por tramo:
//   · rms: aceleración vertical RMS en m/s² (índice de rugosidad; NO es IRI todavía:
//     se convertirá con la calibración en calles de referencia)
//   · golpes: picos fuertes (posibles baches o topes) con su ubicación aproximada
//
// Pensado para jornadas largas (repartidores, taxis): los tramos se liberan para enviarse
// poco a poco, y por privacidad nunca se envía nada cerca de donde el vehículo se detuvo
// (entregas, la casa) ni del inicio o el final del recorrido. El recorte es al azar y
// distinto de cada lado, para que el centro del hueco no delate el punto exacto.

export type LatLon = [number, number];
export type Clase = "buena" | "regular" | "mala";

export type Tramo = {
  puntos: LatLon[];
  largo_m: number;
  vel_kmh: number;
  rms: number;
  golpes: LatLon[];
  muestras: number;
  /** Distancia recorrida al inicio y al final del tramo (solo para la privacidad; no se envía) */
  inicio_m: number;
  fin_m: number;
};

export type EstadoMedicion = {
  distancia_m: number;
  vel_kmh: number | null;
  gps_ok: boolean;
  hz: number;
  tramos: number;
};

/** Umbrales provisionales (m/s² RMS). Se ajustan con recorridos reales. */
export const UMBRALES = { regular: 1.0, mala: 2.0 };
export const COLOR_CLASE: Record<Clase, string> = { buena: "#1a9850", regular: "#f2b705", mala: "#d73027" };
export const clasificar = (rms: number): Clase => (rms >= UMBRALES.mala ? "mala" : rms >= UMBRALES.regular ? "regular" : "buena");

const G = 9.80665;
const OPCIONES = {
  tramoM: 100,
  velMinKmh: 15,
  velMaxKmh: 80,
  golpeG: 0.7,
  /** Privacidad: metros que se descartan (al azar entre min y max, distinto de cada lado)
   *  alrededor de cada parada y al inicio y al final */
  recorteMinM: 150,
  recorteMaxM: 250,
  /** Parada: más de 2 min a menos de 5 km/h (una entrega, la casa); los semáforos no cuentan */
  paradaS: 120,
  paradaKmh: 5,
  /** Si el GPS deja de llegar más de 60 s (pantalla apagada, otra app), se corta el recorrido */
  huecoS: 60,
  precisionMaxM: 25,
};

export function distanciaM(a: LatLon, b: LatLon) {
  const R = 6371000;
  const r = Math.PI / 180;
  const dp = (b[0] - a[0]) * r;
  const dl = (b[1] - a[1]) * r;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

type Abierto = { inicio_m: number; fin_m: number; t0: number; t1: number; puntos: LatLon[]; sumSq: number; n: number; golpes: LatLon[]; ultimoGolpe: number };

export class MotorRugosidad {
  private o = OPCIONES;
  // Gravedad estimada (filtro pasa-bajas de ~1 s)
  private gx = 0;
  private gy = 0;
  private gz = 0;
  private gLista = false;
  private tMov = 0;
  private nMov = 0;
  private tPrimerMov = 0;
  private ultimaPos: LatLon | null = null;
  private ultimaT = 0;
  private dist = 0;
  private vel: number | null = null;
  private gpsOk = false;
  private actual: Abierto | null = null;
  private pendientes: Tramo[] = [];
  private medidos = 0;
  /** Donde el vehículo se detuvo (o se cortó el GPS), con lo que se recorta antes y después */
  private paradas: { d: number; antes: number; despues: number }[] = [];
  private recorteInicio: number;
  private recorteFinal: number;

  private azar: () => number;

  /** azar: se puede fijar en las pruebas */
  constructor(azar: () => number = Math.random) {
    this.azar = azar;
    this.recorteInicio = this.recorte();
    this.recorteFinal = this.recorte();
  }

  private recorte() {
    return this.o.recorteMinM + this.azar() * (this.o.recorteMaxM - this.o.recorteMinM);
  }

  private marcarParada() {
    this.paradas.push({ d: this.dist, antes: this.recorte(), despues: this.recorte() });
  }
  private quietoDesde: number | null = null;
  private paradaMarcada = false;

  /** Lectura del acelerómetro con gravedad (m/s²) y su tiempo en segundos. */
  movimiento(ax: number, ay: number, az: number, t: number) {
    const dt = this.tMov ? Math.min(Math.max(t - this.tMov, 0.001), 0.2) : 1 / 60;
    this.tMov = t;
    if (!this.nMov) this.tPrimerMov = t;
    this.nMov++;
    if (!this.gLista) {
      [this.gx, this.gy, this.gz] = [ax, ay, az];
      this.gLista = true;
    }
    const alfa = dt / (1 + dt);
    this.gx += alfa * (ax - this.gx);
    this.gy += alfa * (ay - this.gy);
    this.gz += alfa * (az - this.gz);
    const gn = Math.hypot(this.gx, this.gy, this.gz) || G;
    const vertical = (ax * this.gx + ay * this.gy + az * this.gz) / gn - gn;

    const tr = this.actual;
    if (!tr || !this.ultimaPos) return;
    tr.sumSq += vertical * vertical;
    tr.n++;
    if (Math.abs(vertical) > this.o.golpeG * G && t - tr.ultimoGolpe > 1) {
      tr.golpes.push(this.ultimaPos);
      tr.ultimoGolpe = t;
    }
  }

  /** Lectura del GPS: precisión en metros, velocidad en m/s (o null) y tiempo en segundos. */
  posicion(lat: number, lng: number, precision: number, velocidad: number | null, t: number) {
    if (precision > this.o.precisionMaxM) {
      this.gpsOk = false;
      return;
    }
    this.gpsOk = true;
    const pos: LatLon = [lat, lng];

    if (this.ultimaPos) {
      const dt = t - this.ultimaT;
      const d = distanciaM(this.ultimaPos, pos);
      if (dt > this.o.huecoS) {
        // Hueco (pantalla apagada u otra app): se corta el tramo y se trata como parada
        this.marcarParada();
        this.actual = null;
        this.ultimaPos = pos;
        this.ultimaT = t;
        this.quietoDesde = null;
        return;
      }
      if (dt > 0 && d / dt > 45) return; // salto del GPS (>160 km/h)
      this.dist += d;
      this.vel = velocidad != null && velocidad >= 0 ? velocidad : dt > 0 ? d / dt : null;
    }
    this.ultimaPos = pos;
    this.ultimaT = t;

    // Paradas: entregas, casa
    if (this.vel !== null && this.vel * 3.6 < this.o.paradaKmh) {
      this.quietoDesde ??= t;
      if (!this.paradaMarcada && t - this.quietoDesde >= this.o.paradaS) {
        // La parada se ubica donde empezó a estar quieto (no se movió desde entonces)
        this.marcarParada();
        this.paradaMarcada = true;
      }
    } else {
      this.quietoDesde = null;
      this.paradaMarcada = false;
    }

    if (!this.actual) {
      this.actual = this.nuevo(t, pos);
      return;
    }
    const tr = this.actual;
    const ultimo = tr.puntos[tr.puntos.length - 1];
    if (distanciaM(ultimo, pos) > 15) tr.puntos.push(pos);
    tr.fin_m = this.dist;
    tr.t1 = t;
    if (tr.fin_m - tr.inicio_m >= this.o.tramoM) {
      if (tr.puntos[tr.puntos.length - 1] !== pos) tr.puntos.push(pos);
      this.cerrar(tr);
      this.actual = this.nuevo(t, pos);
    }
  }

  private nuevo(t: number, pos: LatLon): Abierto {
    return { inicio_m: this.dist, fin_m: this.dist, t0: t, t1: t, puntos: [pos], sumSq: 0, n: 0, golpes: [], ultimoGolpe: 0 };
  }

  private cerrar(tr: Abierto) {
    const largo = tr.fin_m - tr.inicio_m;
    const dur = tr.t1 - tr.t0;
    if (tr.n < 20 || dur <= 0) return;
    const kmh = (largo / dur) * 3.6;
    if (kmh < this.o.velMinKmh || kmh > this.o.velMaxKmh) return;
    this.medidos++;
    this.pendientes.push({
      puntos: tr.puntos.slice(0, 30),
      largo_m: Math.round(largo),
      vel_kmh: Math.round(kmh * 10) / 10,
      rms: Math.round(Math.sqrt(tr.sumSq / tr.n) * 1000) / 1000,
      golpes: tr.golpes.slice(0, 20),
      muestras: tr.n,
      inicio_m: tr.inicio_m,
      fin_m: tr.fin_m,
    });
  }

  /**
   * Devuelve los tramos que ya se pueden enviar y los quita de la cola.
   * Un tramo se libera solo cuando el vehículo ya avanzó lo suficiente para saber que no
   * está cerca de una parada; con final = true se descarta también el final del recorrido.
   */
  liberar(final = false): Tramo[] {
    const cercaDeParada = (t: Tramo) => this.paradas.some((p) => t.fin_m > p.d - p.antes && t.inicio_m < p.d + p.despues);
    const listos: Tramo[] = [];
    const siguen: Tramo[] = [];
    for (const t of this.pendientes) {
      if (t.inicio_m < this.recorteInicio || cercaDeParada(t)) continue; // descartado por privacidad
      if (final) {
        if (t.fin_m <= this.dist - this.recorteFinal) listos.push(t);
      } else if (t.fin_m + this.o.recorteMaxM <= this.dist) {
        // Ya avanzó lo suficiente: una parada futura no lo alcanzaría
        listos.push(t);
      } else siguen.push(t);
    }
    this.pendientes = final ? [] : siguen;
    return listos;
  }

  get hz() {
    const dur = this.tMov - this.tPrimerMov;
    return dur > 0 ? Math.round(this.nMov / dur) : 0;
  }

  estado(): EstadoMedicion {
    return {
      distancia_m: Math.round(this.dist),
      vel_kmh: this.vel != null ? Math.round(this.vel * 3.6) : null,
      gps_ok: this.gpsOk,
      hz: this.hz,
      tramos: this.medidos,
    };
  }
}

/** Resumen para mostrar al terminar */
export function resumir(tramos: Pick<Tramo, "largo_m" | "rms" | "golpes">[]) {
  const km = (c?: Clase) => tramos.filter((t) => !c || clasificar(t.rms) === c).reduce((s, t) => s + t.largo_m, 0) / 1000;
  return {
    km: km(),
    buena: km("buena"),
    regular: km("regular"),
    mala: km("mala"),
    golpes: tramos.reduce((s, t) => s + t.golpes.length, 0),
  };
}
