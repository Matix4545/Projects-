// Motor de medición de rugosidad de calles (corre en el celular, sin dependencias).
//
// Mide la aceleración vertical (sin gravedad ni inclinación del soporte), la agrupa en
// tramos de ~100 m con el GPS y calcula por tramo:
//   · rms: aceleración vertical RMS en m/s² (índice de rugosidad; NO es IRI todavía:
//     se convertirá con la calibración en calles de referencia)
//   · golpes: picos fuertes (posibles baches o topes) con su ubicación aproximada
//   · datos extra para la calibración futura (rms_baja, p95, vel_sd): con ellos los tramos
//     que se midan hoy se podrán convertir a IRI después, sin volver a recorrer las calles
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
  /** RMS solo de la parte lenta (< 4 Hz): el rebote de la carrocería, lo que más se parece al IRI.
   *  La parte rápida es vibración del motor y del soporte. */
  rms_baja: number;
  /** Percentil 95 de |aceleración vertical| en m/s² (qué tan fuertes son los golpes del tramo) */
  p95: number;
  /** Variación de la velocidad en el tramo (km/h): si es alta, el tramo sirve menos para calibrar */
  vel_sd: number;
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
  descartes: Descartes;
};

/** Lo que no se pudo medir y por qué (se muestra al terminar; no se envía) */
export type Descartes = {
  /** m recortados alrededor del inicio, el final y las paradas */
  privacidad_m: number;
  /** m a vuelta de rueda o detenido casi todo el tramo (menos de 15 km/h) */
  lento_m: number;
  /** m a más de 80 km/h */
  rapido_m: number;
  /** s con señal de GPS débil (lecturas con mucho error) */
  gps_debil_s: number;
  /** veces que la medición se cortó (pantalla apagada u otra app) */
  cortes: number;
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
  precisionMaxM: 30,
};

export function distanciaM(a: LatLon, b: LatLon) {
  const R = 6371000;
  const r = Math.PI / 180;
  const dp = (b[0] - a[0]) * r;
  const dl = (b[1] - a[1]) * r;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

type Abierto = {
  inicio_m: number;
  fin_m: number;
  puntos: LatLon[];
  sumSq: number;
  sumSqBaja: number;
  /** Histograma de |vertical| en pasos de 0.1 m/s² (para el percentil 95) */
  hist: Uint16Array;
  /** Lecturas del acelerómetro tomadas en movimiento (las de semáforos y tráfico parado no cuentan) */
  n: number;
  /** Velocidades del GPS en movimiento, para la velocidad del tramo */
  sumVel: number;
  sumVel2: number;
  nVel: number;
  golpes: LatLon[];
  ultimoGolpe: number;
};

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
  /** Lectura del GPS anterior a la última: da la dirección para ubicar los golpes entre lecturas */
  private previaPos: LatLon | null = null;
  private previaT = 0;
  /** Parte lenta (< 4 Hz) de la aceleración vertical */
  private vBaja = 0;
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
  private descartes: Descartes = { privacidad_m: 0, lento_m: 0, rapido_m: 0, gps_debil_s: 0, cortes: 0 };
  /** Última lectura del GPS aunque haya sido imprecisa, y si en ella el vehículo se movía */
  private ultimaLecturaT = 0;
  private seMoviaConGpsDebil = false;

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
    const rc = 1 / (2 * Math.PI * 4);
    this.vBaja += (dt / (rc + dt)) * (vertical - this.vBaja);

    const tr = this.actual;
    if (!tr || !this.ultimaPos) return;
    // Solo se mide en movimiento: un semáforo o tráfico parado no tumba el tramo completo
    if (this.vel === null || this.vel * 3.6 < this.o.velMinKmh) return;
    tr.sumSq += vertical * vertical;
    tr.sumSqBaja += this.vBaja * this.vBaja;
    tr.hist[Math.min(Math.floor(Math.abs(vertical) * 10), tr.hist.length - 1)]++;
    tr.n++;
    if (Math.abs(vertical) > this.o.golpeG * G && t - tr.ultimoGolpe > 1) {
      tr.golpes.push(this.ubicarEn(t));
      tr.ultimoGolpe = t;
    }
  }

  /**
   * Dónde iba el vehículo en el instante t: la última lectura del GPS más lo que avanzó desde
   * entonces en la misma dirección (el GPS lee 1 vez por segundo; a 50 km/h son 14 m).
   */
  private ubicarEn(t: number): LatLon {
    const a = this.previaPos;
    const b = this.ultimaPos!;
    const dtGps = this.ultimaT - this.previaT;
    if (!a || dtGps <= 0 || this.vel === null) return b;
    const d = distanciaM(a, b);
    if (d < 1) return b;
    const avance = Math.min(this.vel * Math.max(0, t - this.ultimaT), 3 * this.vel, 40);
    const f = avance / d;
    return [b[0] + (b[0] - a[0]) * f, b[1] + (b[1] - a[1]) * f];
  }

  /** Lectura del GPS: precisión en metros, velocidad en m/s (o null) y tiempo en segundos. */
  posicion(lat: number, lng: number, precision: number, velocidad: number | null, t: number) {
    const lecturaPrevia = this.ultimaLecturaT;
    this.ultimaLecturaT = t;
    if (precision > this.o.precisionMaxM) {
      if (this.gpsOk === false && lecturaPrevia) this.descartes.gps_debil_s += Math.min(t - lecturaPrevia, this.o.huecoS);
      this.gpsOk = false;
      // ¿Seguía en movimiento? (si no hay velocidad, se asume que sí)
      this.seMoviaConGpsDebil = velocidad == null || velocidad * 3.6 >= this.o.paradaKmh;
      return;
    }
    this.gpsOk = true;
    const pos: LatLon = [lat, lng];

    if (this.ultimaPos) {
      const dt = t - this.ultimaT;
      const d = distanciaM(this.ultimaPos, pos);
      if (dt > this.o.huecoS) {
        const gpsDebilEnMovimiento = t - lecturaPrevia <= this.o.huecoS && this.seMoviaConGpsDebil;
        if (gpsDebilEnMovimiento) {
          // Señal débil un rato (puente, vía del tren) pero siguió manejando: se corta el tramo,
          // sin recorte de privacidad porque no se detuvo
        } else {
          // Sin lecturas (pantalla apagada u otra app): se corta y se trata como parada
          this.marcarParada();
          this.descartes.cortes++;
        }
        this.actual = null;
        this.previaPos = null;
        this.ultimaPos = pos;
        this.ultimaT = t;
        this.quietoDesde = null;
        return;
      }
      if (dt > 0 && d / dt > 45) return; // salto del GPS (>160 km/h)
      this.dist += d;
      this.vel = velocidad != null && velocidad >= 0 ? velocidad : dt > 0 ? d / dt : null;
      if (d >= 1) [this.previaPos, this.previaT] = [this.ultimaPos, this.ultimaT];
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
    if (this.vel !== null && this.vel * 3.6 >= this.o.velMinKmh) {
      tr.sumVel += this.vel;
      tr.sumVel2 += this.vel * this.vel;
      tr.nVel++;
    }
    if (tr.fin_m - tr.inicio_m >= this.o.tramoM) {
      if (tr.puntos[tr.puntos.length - 1] !== pos) tr.puntos.push(pos);
      this.cerrar(tr);
      this.actual = this.nuevo(t, pos);
    }
  }

  private nuevo(_t: number, pos: LatLon): Abierto {
    return { inicio_m: this.dist, fin_m: this.dist, puntos: [pos], sumSq: 0, sumSqBaja: 0, hist: new Uint16Array(200), n: 0, sumVel: 0, sumVel2: 0, nVel: 0, golpes: [], ultimoGolpe: 0 };
  }

  private cerrar(tr: Abierto) {
    const largo = tr.fin_m - tr.inicio_m;
    // Muy pocas lecturas en movimiento: fue a vuelta de rueda o detenido casi todo el tramo
    if (tr.n < 20 || tr.nVel === 0) {
      this.descartes.lento_m += largo;
      return;
    }
    const kmh = (tr.sumVel / tr.nVel) * 3.6;
    if (kmh > this.o.velMaxKmh) {
      this.descartes.rapido_m += largo;
      return;
    }
    this.medidos++;
    const media = tr.sumVel / tr.nVel;
    const sd = Math.sqrt(Math.max(0, tr.sumVel2 / tr.nVel - media * media)) * 3.6;
    let acum = 0;
    let p95 = tr.hist.length;
    for (let i = 0; i < tr.hist.length; i++) {
      acum += tr.hist[i];
      if (acum >= 0.95 * tr.n) {
        p95 = i + 1;
        break;
      }
    }
    const r3 = (x: number) => Math.round(x * 1000) / 1000;
    this.pendientes.push({
      puntos: tr.puntos.slice(0, 30),
      largo_m: Math.round(largo),
      vel_kmh: Math.round(kmh * 10) / 10,
      rms: r3(Math.sqrt(tr.sumSq / tr.n)),
      rms_baja: r3(Math.sqrt(tr.sumSqBaja / tr.n)),
      p95: p95 / 10,
      vel_sd: Math.round(sd * 10) / 10,
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
      if (t.inicio_m < this.recorteInicio || cercaDeParada(t)) {
        this.descartes.privacidad_m += t.largo_m; // descartado por privacidad
        continue;
      }
      if (final) {
        if (t.fin_m <= this.dist - this.recorteFinal) listos.push(t);
        else this.descartes.privacidad_m += t.largo_m;
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
      descartes: { ...this.descartes },
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

/** Una medición de rugosidad tal como llega al mapa del equipo */
export type MedicionTramo = {
  rms: number;
  vel_kmh: number;
  vehiculo: string;
  fecha: string;
  n_golpes: number;
  largo_m: number;
  distancia_m: number;
  /** Etiqueta del recorrido de prueba, si la tiene */
  nota?: string;
};

/** Distancia en metros de un punto a una línea (aproximación plana, suficiente para ~100 m) */
function distanciaALinea([lat, lng]: LatLon, linea: LatLon[]) {
  const kx = 111_320 * Math.cos((lat * Math.PI) / 180);
  const ky = 110_574;
  let min = Infinity;
  for (let i = 1; i < linea.length; i++) {
    const [ax, ay] = [(linea[i - 1][1] - lng) * kx, (linea[i - 1][0] - lat) * ky];
    const [bx, by] = [(linea[i][1] - lng) * kx, (linea[i][0] - lat) * ky];
    const [dx, dy] = [bx - ax, by - ay];
    const l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
    min = Math.min(min, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return min;
}

/**
 * Mediciones a menos de radioM metros del punto tocado (todas las pasadas por esa cuadra),
 * de la más cercana a la más lejana.
 */
export function medicionesCerca(lat: number, lng: number, fc: GeoJSON.FeatureCollection, radioM = 25): MedicionTramo[] {
  const salida: MedicionTramo[] = [];
  for (const f of fc.features) {
    if (f.geometry.type !== "LineString" || f.properties?.tipo !== "tramo") continue;
    const linea = (f.geometry.coordinates as number[][]).map(([x, y]) => [y, x] as LatLon);
    const d = distanciaALinea([lat, lng], linea);
    if (d > radioM) continue;
    let largo = 0;
    for (let i = 1; i < linea.length; i++) largo += distanciaM(linea[i - 1], linea[i]);
    const p = f.properties;
    salida.push({
      rms: Number(p.rms),
      vel_kmh: Number(p.vel_kmh),
      vehiculo: String(p.vehiculo),
      fecha: String(p.fecha),
      n_golpes: Number(p.n_golpes ?? 0),
      largo_m: Math.round(largo),
      distancia_m: d,
      nota: p.nota ? String(p.nota) : undefined,
    });
  }
  salida.sort((a, b) => a.distancia_m - b.distancia_m);
  // Solo la cuadra tocada: las pasadas por ahí quedan casi a la misma distancia (el GPS varía unos
  // metros); los tramos vecinos de la misma calle quedan más lejos y no se cuentan
  return salida.filter((m) => m.distancia_m <= salida[0].distancia_m + 12);
}
