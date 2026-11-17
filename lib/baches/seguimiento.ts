// Seguimiento de baches entre cuadros de video.
//
// El mismo bache aparece en varios cuadros mientras el vehículo se acerca (a 40 km/h se ve
// ~1.5 s). Cada aparición se ubica en el piso y en el mapa (metros este/norte desde el inicio
// del recorrido); las que caen a pocos metros se juntan en un solo bache. Cuando el bache deja
// de verse (el vehículo ya pasó), se decide si fue real (varios cuadros, confianza suficiente)
// y su área es la mediana de las medidas tomadas dentro de la zona dulce.

export type Observacion<F = unknown> = {
  /** Segundos */
  t: number;
  /** Centro del bache en metros (este, norte) desde el origen del recorrido */
  pos: [number, number];
  /** Qué tan adelante estaba (m): las medidas lejanas ubican peor */
  distancia: number;
  confianza: number;
  /** Solo si la medida estaba en la zona dulce */
  area_m2: number | null;
  largo_m: number | null;
  ancho_m: number | null;
  /** Foto u otro dato de este cuadro (se guarda el del mejor cuadro) */
  foto?: F;
  /** Rumbo del vehículo (grados): sirve para acomodar el bache en la calle por la que iba */
  rumbo?: number;
  /** Precisión del GPS en ese instante (m) */
  precision?: number;
};

export type BacheConfirmado<F = unknown> = {
  pos: [number, number];
  /** Mediana de las medidas en la zona dulce; null si nunca se midió bien */
  area_m2: number | null;
  /** Desviación estándar entre cuadros (m²) */
  area_sd: number | null;
  largo_m: number | null;
  ancho_m: number | null;
  confianza: number;
  confianza_max: number;
  cuadros: number;
  /** Cuadros con medida de área válida */
  medidas: number;
  distancia_m: number;
  foto?: F;
  rumbo: number | null;
  /** Mediana de la precisión del GPS en sus cuadros (m) */
  precision_m: number | null;
};

export const OPCIONES_SEGUIMIENTO = {
  /** Distancia máxima (m) para considerar que dos apariciones son el mismo bache */
  radioM: 2.5,
  /** Segundos sin verlo para darlo por pasado */
  perdidoS: 1.5,
  /** Para confirmar: cuadros mínimos y confianza máxima mínima */
  minCuadros: 2,
  minConfianza: 0.5,
};

type Pista<F> = { obs: Observacion<F>[]; pos: [number, number]; ultimo: number };

export const mediana = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export class Seguimiento<F = unknown> {
  private pistas: Pista<F>[] = [];
  private listos: BacheConfirmado<F>[] = [];
  /** Cuántos se descartaron por verse muy poco (posibles falsos positivos) */
  descartados = 0;
  private o: typeof OPCIONES_SEGUIMIENTO;

  constructor(opc: Partial<typeof OPCIONES_SEGUIMIENTO> = {}) {
    this.o = { ...OPCIONES_SEGUIMIENTO, ...opc };
  }

  get activos() {
    return this.pistas.length;
  }

  /** Apariciones de un cuadro (todas con el mismo t) */
  agregar(obs: Observacion<F>[], t: number) {
    this.cerrarViejas(t);
    // Emparejar por distancia, de la pareja más cercana a la más lejana; una pista por aparición
    const parejas: [number, number, number][] = [];
    obs.forEach((o, i) =>
      this.pistas.forEach((p, j) => {
        const d = Math.hypot(o.pos[0] - p.pos[0], o.pos[1] - p.pos[1]);
        if (d <= this.o.radioM) parejas.push([d, i, j]);
      }),
    );
    parejas.sort((a, b) => a[0] - b[0]);
    const obsUsada = new Set<number>();
    const pistaUsada = new Set<number>();
    for (const [, i, j] of parejas) {
      if (obsUsada.has(i) || pistaUsada.has(j)) continue;
      obsUsada.add(i);
      pistaUsada.add(j);
      const p = this.pistas[j];
      p.obs.push(obs[i]);
      p.ultimo = t;
      p.pos = posicion(p.obs);
    }
    obs.forEach((o, i) => {
      if (!obsUsada.has(i)) this.pistas.push({ obs: [o], pos: o.pos, ultimo: t });
    });
  }

  private cerrarViejas(t: number) {
    const siguen: Pista<F>[] = [];
    for (const p of this.pistas) {
      if (t - p.ultimo > this.o.perdidoS) this.cerrar(p);
      else siguen.push(p);
    }
    this.pistas = siguen;
  }

  private cerrar(p: Pista<F>) {
    const n = p.obs.length;
    const confs = p.obs.map((o) => o.confianza);
    const max = Math.max(...confs);
    if (n < this.o.minCuadros || max < this.o.minConfianza) {
      this.descartados++;
      return;
    }
    const buenas = p.obs.filter((o) => o.area_m2 != null);
    const areas = buenas.map((o) => o.area_m2!);
    const a = areas.length ? mediana(areas) : null;
    const sd = areas.length >= 2 ? Math.sqrt(areas.reduce((s, x) => s + (x - areas.reduce((u, v) => u + v, 0) / areas.length) ** 2, 0) / (areas.length - 1)) : null;
    // Foto del mejor cuadro: el más seguro dentro de la zona dulce (o el más seguro de todos)
    const mejor = [...(buenas.length ? buenas : p.obs)].sort((x, y) => y.confianza - x.confianza)[0];
    const r2 = (x: number) => Math.round(x * 100) / 100;
    const r4 = (x: number) => Math.round(x * 10_000) / 10_000;
    this.listos.push({
      pos: p.pos,
      area_m2: a == null ? null : r4(a),
      area_sd: sd == null ? null : r4(sd),
      largo_m: buenas.length ? r2(mediana(buenas.map((o) => o.largo_m!))) : null,
      ancho_m: buenas.length ? r2(mediana(buenas.map((o) => o.ancho_m!))) : null,
      confianza: r2(confs.reduce((s, x) => s + x, 0) / n),
      confianza_max: r2(max),
      cuadros: n,
      medidas: buenas.length,
      distancia_m: r2(mediana((buenas.length ? buenas : p.obs).map((o) => o.distancia))),
      foto: mejor.foto,
      rumbo: mejor.rumbo ?? null,
      precision_m: p.obs.some((o) => o.precision != null) ? r2(mediana(p.obs.flatMap((o) => (o.precision != null ? [o.precision] : [])))) : null,
    });
  }

  /** Baches confirmados desde la última vez (se quitan de la lista) */
  tomar(t?: number): BacheConfirmado<F>[] {
    if (t != null) this.cerrarViejas(t);
    const r = this.listos;
    this.listos = [];
    return r;
  }

  /** Al terminar el recorrido: cierra todo lo que estaba a la vista */
  terminar(): BacheConfirmado<F>[] {
    for (const p of this.pistas) this.cerrar(p);
    this.pistas = [];
    return this.tomar();
  }
}

/** Posición: promedio pesado por confianza; las apariciones lejanas pesan menos (ubican peor) */
function posicion(obs: Observacion[]): [number, number] {
  let e = 0;
  let n = 0;
  let w = 0;
  for (const o of obs) {
    const p = o.confianza / Math.max(o.distancia, 3) ** 2;
    e += o.pos[0] * p;
    n += o.pos[1] * p;
    w += p;
  }
  return w > 0 ? [e / w, n / w] : obs[obs.length - 1].pos;
}
