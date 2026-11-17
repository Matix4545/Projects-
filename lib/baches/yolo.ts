// Lectura de la salida de un modelo YOLO de segmentación (Ultralytics, exportado a ONNX).
// Funciones puras, sin dependencias, para poder probarlas en Node.
//
// El modelo da dos tensores:
//   · output0: cajas, confianza y 32 coeficientes de máscara por detección. Puede venir en dos formas:
//       – clásica  [1, 4 + clases + 32, N]: cx, cy, ancho, alto, una confianza por clase… (necesita NMS)
//       – sin NMS  [1, K, 6 + 32]: x1, y1, x2, y2, confianza, clase… (YOLO26 "end-to-end")
//   · output1: 32 prototipos de máscara de 160 × 160 (para una entrada de 640).
// La máscara de cada detección es sigmoide(Σ coeficiente_k · prototipo_k), recortada a su caja.
// El contorno se saca con "marching squares" sobre esa probabilidad, así el borde cae entre
// píxeles del prototipo (precisión subpíxel) y no en escalones.

export type Tensor = { data: Float32Array; dims: readonly number[] };

/** Cómo se acomodó el cuadro de video dentro de la entrada cuadrada del modelo */
export type Letterbox = { escala: number; dx: number; dy: number; anchoEntrada: number; altoEntrada: number };

export function calcularLetterbox(ancho: number, alto: number, anchoEntrada: number, altoEntrada: number): Letterbox {
  const escala = Math.min(anchoEntrada / ancho, altoEntrada / alto);
  return {
    escala,
    dx: Math.round((anchoEntrada - ancho * escala) / 2),
    dy: Math.round((altoEntrada - alto * escala) / 2),
    anchoEntrada,
    altoEntrada,
  };
}

/** RGBA (de un canvas) → planos R, G, B en 0–1, como espera YOLO */
export function rgbaAEntrada(rgba: Uint8ClampedArray | Uint8Array, ancho: number, alto: number, salida?: Float32Array) {
  const n = ancho * alto;
  const t = salida ?? new Float32Array(3 * n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    t[i] = rgba[j] / 255;
    t[n + i] = rgba[j + 1] / 255;
    t[2 * n + i] = rgba[j + 2] / 255;
  }
  return t;
}

export type Deteccion = {
  /** Caja en píxeles de la entrada del modelo */
  caja: [number, number, number, number];
  confianza: number;
  clase: number;
  coefs: Float32Array;
};

/** IoU entre dos cajas [x1, y1, x2, y2] */
export function iou(a: Deteccion["caja"], b: Deteccion["caja"]) {
  const w = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
  const h = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const inter = w * h;
  const union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter;
  return union > 0 ? inter / union : 0;
}

/**
 * Detecciones con confianza ≥ umbral, sin duplicados (NMS por IoU), de la más a la menos segura.
 * nm: número de coeficientes de máscara (canales de los prototipos).
 */
export function decodificar(salida: Tensor, nm: number, opc: { umbral?: number; iou?: number; max?: number } = {}): Deteccion[] {
  const umbral = opc.umbral ?? 0.3;
  const maxDet = opc.max ?? 20;
  const [, a, b] = salida.dims;
  const d = salida.data;
  const candidatos: Deteccion[] = [];

  if (b === 6 + nm && a !== 6 + nm) {
    // Sin NMS: [1, K, 6 + nm], una fila por detección
    for (let i = 0; i < a; i++) {
      const o = i * b;
      const conf = d[o + 4];
      if (!(conf >= umbral)) continue;
      candidatos.push({ caja: [d[o], d[o + 1], d[o + 2], d[o + 3]], confianza: conf, clase: Math.round(d[o + 5]), coefs: d.slice(o + 6, o + 6 + nm) });
    }
  } else {
    // Clásica: [1, 4 + nc + nm, N], un canal por fila
    const c = a;
    const n = b;
    const nc = c - 4 - nm;
    if (nc < 1) throw new Error(`Salida del modelo inesperada: [${salida.dims.join(", ")}]`);
    for (let i = 0; i < n; i++) {
      let mejor = 0;
      let clase = 0;
      for (let k = 0; k < nc; k++) {
        const s = d[(4 + k) * n + i];
        if (s > mejor) [mejor, clase] = [s, k];
      }
      if (!(mejor >= umbral)) continue;
      const [cx, cy, w, h] = [d[i], d[n + i], d[2 * n + i], d[3 * n + i]];
      const coefs = new Float32Array(nm);
      for (let k = 0; k < nm; k++) coefs[k] = d[(4 + nc + k) * n + i];
      candidatos.push({ caja: [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], confianza: mejor, clase, coefs });
    }
  }

  candidatos.sort((x, y) => y.confianza - x.confianza);
  const quedan: Deteccion[] = [];
  const umbralIou = opc.iou ?? 0.5;
  for (const c of candidatos) {
    if (quedan.length >= maxDet) break;
    if (quedan.every((q) => iou(q.caja, c.caja) < umbralIou)) quedan.push(c);
  }
  return quedan;
}

/** Probabilidad de máscara (0–1) en la cuadrícula de prototipos, solo dentro de la caja */
export function mascara(det: Deteccion, protos: Tensor, lb: Pick<Letterbox, "anchoEntrada" | "altoEntrada">) {
  const [, nm, mh, mw] = protos.dims;
  const sx = mw / lb.anchoEntrada;
  const sy = mh / lb.altoEntrada;
  // Caja en coordenadas de prototipo (un píxel de margen para que el contorno cierre)
  const x0 = Math.max(0, Math.floor(det.caja[0] * sx));
  const y0 = Math.max(0, Math.floor(det.caja[1] * sy));
  const x1 = Math.min(mw - 1, Math.ceil(det.caja[2] * sx));
  const y1 = Math.min(mh - 1, Math.ceil(det.caja[3] * sy));
  const ancho = x1 - x0 + 3;
  const alto = y1 - y0 + 3;
  const p = new Float32Array(ancho * alto); // borde de ceros
  const plano = mh * mw;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      // Solo los centros de celda que caen dentro de la caja
      const px = (x + 0.5) / sx;
      const py = (y + 0.5) / sy;
      if (px < det.caja[0] || px > det.caja[2] || py < det.caja[1] || py > det.caja[3]) continue;
      let s = 0;
      const o = y * mw + x;
      for (let k = 0; k < nm; k++) s += det.coefs[k] * protos.data[k * plano + o];
      p[(y - y0 + 1) * ancho + (x - x0 + 1)] = 1 / (1 + Math.exp(-s));
    }
  }
  // Origen de la rejilla en coordenadas de prototipo (el borde agregado está en x0 - 1)
  return { p, ancho, alto, ox: x0 - 1, oy: y0 - 1, sx, sy };
}

type Pt = [number, number];

/**
 * Contornos de nivel 0.5 de una rejilla (marching squares con interpolación lineal).
 * Devuelve el contorno exterior más grande, en coordenadas de la rejilla (centros de celda en x + 0.5).
 */
export function contornoMayor(p: Float32Array, ancho: number, alto: number, nivel = 0.5): Pt[] | null {
  const v = (x: number, y: number) => p[y * ancho + x];
  // Punto sobre cada arista, con clave única para encadenar los segmentos
  const puntos = new Map<number, Pt>();
  const claveH = (x: number, y: number) => (y * ancho + x) * 2; // arista (x,y)–(x+1,y)
  const claveV = (x: number, y: number) => (y * ancho + x) * 2 + 1; // arista (x,y)–(x,y+1)
  const enArista = (k: number): Pt => {
    let q = puntos.get(k);
    if (q) return q;
    const idx = k >> 1;
    const x = idx % ancho;
    const y = (idx - x) / ancho;
    const a = v(x, y);
    const b = k & 1 ? v(x, y + 1) : v(x + 1, y);
    const t = a === b ? 0.5 : (nivel - a) / (b - a);
    q = k & 1 ? [x + 0.5, y + t + 0.5] : [x + t + 0.5, y + 0.5];
    puntos.set(k, q);
    return q;
  };
  const vecinos = new Map<number, number[]>();
  const unir = (a: number, b: number) => {
    (vecinos.get(a) ?? vecinos.set(a, []).get(a)!).push(b);
    (vecinos.get(b) ?? vecinos.set(b, []).get(b)!).push(a);
  };

  for (let y = 0; y < alto - 1; y++) {
    for (let x = 0; x < ancho - 1; x++) {
      const a = v(x, y) >= nivel ? 1 : 0; // arriba izquierda
      const b = v(x + 1, y) >= nivel ? 1 : 0; // arriba derecha
      const c = v(x + 1, y + 1) >= nivel ? 1 : 0; // abajo derecha
      const d = v(x, y + 1) >= nivel ? 1 : 0; // abajo izquierda
      const caso = (a << 3) | (b << 2) | (c << 1) | d;
      if (caso === 0 || caso === 15) continue;
      const arriba = claveH(x, y);
      const abajo = claveH(x, y + 1);
      const izq = claveV(x, y);
      const der = claveV(x + 1, y);
      switch (caso) {
        case 1: case 14: unir(izq, abajo); break;
        case 2: case 13: unir(abajo, der); break;
        case 3: case 12: unir(izq, der); break;
        case 4: case 11: unir(arriba, der); break;
        case 6: case 9: unir(arriba, abajo); break;
        case 7: case 8: unir(izq, arriba); break;
        case 5: case 10: {
          // Silla: se decide con el promedio del centro
          const centro = (v(x, y) + v(x + 1, y) + v(x + 1, y + 1) + v(x, y + 1)) / 4 >= nivel;
          if ((caso === 5) === centro) {
            unir(izq, arriba);
            unir(abajo, der);
          } else {
            unir(izq, abajo);
            unir(arriba, der);
          }
          break;
        }
      }
    }
  }

  // Encadenar en lazos y quedarse con el de mayor área
  const usado = new Set<number>();
  let mejor: Pt[] | null = null;
  let mejorArea = 0;
  for (const inicio of vecinos.keys()) {
    if (usado.has(inicio)) continue;
    const lazo: Pt[] = [];
    let previo = -1;
    let actual = inicio;
    while (!usado.has(actual)) {
      usado.add(actual);
      lazo.push(enArista(actual));
      const sig = (vecinos.get(actual) ?? []).find((k) => k !== previo && !usado.has(k));
      if (sig === undefined) break;
      previo = actual;
      actual = sig;
    }
    if (lazo.length < 3) continue;
    let s = 0;
    for (let i = 0, j = lazo.length - 1; i < lazo.length; j = i++) s += lazo[j][0] * lazo[i][1] - lazo[i][0] * lazo[j][1];
    if (Math.abs(s / 2) > mejorArea) [mejor, mejorArea] = [lazo, Math.abs(s / 2)];
  }
  return mejor;
}

/** Simplifica un contorno cerrado (Douglas–Peucker) a una tolerancia en las mismas unidades */
export function simplificar(puntos: Pt[], tolerancia: number): Pt[] {
  if (puntos.length <= 8) return puntos;
  const rdp = (pts: Pt[]): Pt[] => {
    if (pts.length < 3) return pts;
    const [a, b] = [pts[0], pts[pts.length - 1]];
    const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
    const largo = Math.hypot(dx, dy) || 1;
    let max = -1;
    let idx = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const dist = Math.abs(dy * (pts[i][0] - a[0]) - dx * (pts[i][1] - a[1])) / largo;
      if (dist > max) [max, idx] = [dist, i];
    }
    if (max <= tolerancia) return [a, b];
    return [...rdp(pts.slice(0, idx + 1)).slice(0, -1), ...rdp(pts.slice(idx))];
  };
  // Se parte el lazo en el punto más lejano al primero para que el resultado no dependa del inicio
  let lejos = 0;
  let dmax = 0;
  for (let i = 1; i < puntos.length; i++) {
    const d = Math.hypot(puntos[i][0] - puntos[0][0], puntos[i][1] - puntos[0][1]);
    if (d > dmax) [dmax, lejos] = [d, i];
  }
  const ida = rdp(puntos.slice(0, lejos + 1));
  const vuelta = rdp([...puntos.slice(lejos), puntos[0]]);
  return [...ida.slice(0, -1), ...vuelta.slice(0, -1)];
}

export type Bache = {
  confianza: number;
  /** Índice de la clase en el modelo (un modelo puede distinguir baches de alcantarillas, rejillas…) */
  clase: number;
  /** Contorno en píxeles del cuadro de video original */
  contorno: [number, number][];
  /** Caja en píxeles del cuadro original */
  caja: [number, number, number, number];
};

/**
 * De la salida del modelo a contornos en píxeles del cuadro original.
 * umbral: confianza mínima para ser candidato (adquisición); umbralPorClase: la que cada clase
 * necesita para aceptarse (p. ej. bache 0.25, alcantarilla 0.35).
 */
export function baches(
  salida: Tensor,
  protos: Tensor,
  lb: Letterbox,
  opc: { umbral?: number; iou?: number; umbralPorClase?: (number | undefined)[] } = {},
): Bache[] {
  const nm = protos.dims[1];
  const res: Bache[] = [];
  for (const det of decodificar(salida, nm, opc)) {
    if (det.confianza < (opc.umbralPorClase?.[det.clase] ?? 0)) continue;
    const m = mascara(det, protos, lb);
    const lazo = contornoMayor(m.p, m.ancho, m.alto);
    if (!lazo) continue;
    const enCuadro = (x: number, y: number): [number, number] => [
      ((m.ox + x) / m.sx - lb.dx) / lb.escala,
      ((m.oy + y) / m.sy - lb.dy) / lb.escala,
    ];
    const contorno = simplificar(lazo, 0.1).map(([x, y]) => enCuadro(x, y));
    const caja = [(det.caja[0] - lb.dx) / lb.escala, (det.caja[1] - lb.dy) / lb.escala, (det.caja[2] - lb.dx) / lb.escala, (det.caja[3] - lb.dy) / lb.escala] as Bache["caja"];
    res.push({ confianza: det.confianza, clase: det.clase, contorno, caja });
  }
  return res;
}

/**
 * Qué clases del modelo son baches. Un modelo de una sola clase es de baches; uno con varias
 * (p. ej. pothole, manhole, grate) solo cuenta las que se llaman bache / pothole / hueco.
 * Las demás se dibujan, pero no se suben al mapa: una tapa de registro no es un bache.
 */
export function clasesDeBache(nombres: string[] | undefined): number[] | null {
  if (!nombres || nombres.length <= 1) return null; // todas
  const idx = nombres.flatMap((n, i) => (/bache|pothole|hueco|pot[\s_-]?hole|socav/i.test(n) ? [i] : []));
  return idx.length ? idx : null;
}
