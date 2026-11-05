// Herramientas para los modelos de manga: cortar y separar en abanico,
// trazar mangas con una sisa dada y localizar puntos sobre bordes.
import {
  type Pt,
  P,
  curva,
  dir,
  dist,
  enLongitud,
  escalar,
  lerp,
  longitud,
  masCercano,
  perp,
  remuestrear,
  rotar,
  suavizarPolilinea,
  suma,
  punto,
  resta,
} from "../geometria.ts";
import { type Pieza, type V, corto, crear, insertar, margen, piquete, piqueteDesdeFin, piqueteEn, tramo, v } from "../pieza.ts";

/** Puntos de la polilínea entre las longitudes s0 y s1 (incluye los extremos interpolados). */
export function subtramo(pts: Pt[], s0: number, s1: number): Pt[] {
  const r: Pt[] = [enLongitud(pts, s0).p];
  let acum = 0;
  for (let i = 1; i < pts.length; i++) {
    acum += dist(pts[i - 1], pts[i]);
    if (acum > s0 + 1e-6 && acum < s1 - 1e-6) r.push(pts[i]);
  }
  r.push(enLongitud(pts, s1).p);
  return r;
}

/** Inserta un punto con nombre sobre el borde que une a y b, a `d` cm de `a` (en cualquier sentido del contorno). */
export function insertarEnBorde(pz: Pieza, n: string, a: string, b: string, d: number): string {
  const [x, y] = corto(pz, a, b);
  const t = tramo(pz, x, y);
  const L = longitud(t);
  const s = x === a ? d : L - d;
  return insertar(pz, n, enLongitud(t, Math.max(0, Math.min(L, s))).p);
}

type Transformacion = (p: Pt) => Pt;

/**
 * Movimiento rígido que abre un corte de T (copa) a B (bastilla): `aT` cm de abertura
 * arriba y `aB` abajo, desplazando hacia el lado de la normal `n`.
 */
function aperturaCorte(T: Pt, B: Pt, aT: number, aB: number, n: Pt): Transformacion {
  if (Math.abs(aT - aB) < 1e-6) return (p) => suma(p, escalar(n, aT));
  const L = dist(T, B);
  let piv: Pt;
  let extremo: Pt;
  let a: number;
  if (aT > aB) {
    piv = suma(T, escalar(dir(T, B), (L * aT) / (aT - aB)));
    extremo = T;
    a = aT;
  } else {
    piv = suma(B, escalar(dir(B, T), (L * aB) / (aB - aT)));
    extremo = B;
    a = aB;
  }
  const r = dist(piv, extremo);
  const th = 2 * Math.asin(Math.min(1, a / (2 * r)));
  const prueba = rotar(extremo, piv, th);
  const signo = punto(resta(prueba, extremo), n) >= 0 ? 1 : -1;
  return (p) => rotar(p, piv, signo * th);
}

export type OpcionesAbanico = {
  /** Número de cortes (par, para que quede simétrica). */
  cortes?: number;
  /** Abertura de cada corte en la copa (cm). */
  copa?: number;
  /** Abertura de cada corte en la bastilla (cm). */
  bastilla?: number;
  /** Cuánto se sube el centro de la copa (volumen arriba). */
  subirCopa?: number;
  /** Cuánto se baja el centro de la bastilla (más largo al centro). */
  bajarBastilla?: number;
  /** Largo extra en la mitad trasera de la bastilla (manga obispo). */
  alargarAtras?: number;
  /** Margen de la bastilla (cm). */
  margenBastilla?: number;
  nombre?: string;
};

/**
 * Cortar y separar una manga en tiras verticales (método clásico): la copa y la
 * bastilla se dividen en partes iguales y cada corte se abre lo indicado arriba
 * y abajo. La tira del centro no se mueve. Los costados (bajo brazo) no cambian
 * de largo, así que siguen cerrando con el cuerpo.
 */
export function abanico(manga: Pieza, o: OpcionesAbanico = {}): Pieza {
  const cortes = o.cortes ?? 6;
  const N = cortes + 1;
  const aT = o.copa ?? 0;
  const aB = o.bastilla ?? 0;
  const copa = tramo(manga, "sisaFrente", "sisaAtras").reverse(); // de atrás hacia el frente
  const bast = tramo(manga, "bastillaAtras", "bastillaFrente");
  const Lc = longitud(copa);
  const Lh = longitud(bast);
  const tC = (k: number) => enLongitud(copa, (Lc * k) / N).p;
  const tH = (k: number) => enLongitud(bast, (Lh * k) / N).p;
  const m = Math.floor(N / 2);
  const T: Transformacion[] = new Array(N);
  T[m] = (p) => p;
  for (let i = m + 1; i < N; i++) {
    const R = aperturaCorte(tC(i), tH(i), aT, aB, perp(dir(tC(i), tH(i))));
    const prev = T[i - 1];
    T[i] = (p) => prev(R(p));
  }
  for (let i = m - 1; i >= 0; i--) {
    const Lf = aperturaCorte(tC(i + 1), tH(i + 1), aT, aB, escalar(perp(dir(tC(i + 1), tH(i + 1))), -1));
    const sig = T[i + 1];
    T[i] = (p) => sig(Lf(p));
  }
  let nuevaCopa: Pt[] = [];
  let nuevaBast: Pt[] = [];
  for (let i = 0; i < N; i++) {
    nuevaCopa.push(...subtramo(copa, (Lc * i) / N, (Lc * (i + 1)) / N).map(T[i]));
    nuevaBast.push(...subtramo(bast, (Lh * i) / N, (Lh * (i + 1)) / N).map(T[i]));
  }
  // suavizar los saltos que deja cada abertura
  nuevaCopa = suavizarPolilinea(remuestrear(nuevaCopa, 0.5), 30, 0.5);
  nuevaBast = suavizarPolilinea(remuestrear(nuevaBast, 0.5), 30, 0.5);
  // volumen extra: subir la copa y bajar la bastilla al centro
  const perfil = (u: number) => Math.sin(Math.PI * u) ** 2;
  const sube = o.subirCopa ?? 0;
  const baja = o.bajarBastilla ?? 0;
  const atras = o.alargarAtras ?? 0;
  if (sube) nuevaCopa = nuevaCopa.map((p, k) => ({ x: p.x, y: p.y + sube * perfil(k / (nuevaCopa.length - 1)) }));
  if (baja || atras)
    nuevaBast = nuevaBast.map((p, k) => {
      const u = k / (nuevaBast.length - 1);
      const extraAtras = u < 0.5 ? atras * Math.sin(Math.PI * u * 2) : 0;
      return { x: p.x, y: p.y - baja * perfil(u) - extraAtras };
    });
  // punto más alto de la copa = hombro
  let iTop = 0;
  for (let k = 0; k < nuevaCopa.length; k++) if (nuevaCopa[k].y > nuevaCopa[iTop].y) iTop = k;
  const copaV: V[] = nuevaCopa.map((p, k) => ({ x: p.x, y: p.y, n: k === 0 ? "sisaAtras" : k === nuevaCopa.length - 1 ? "sisaFrente" : k === iTop ? "copa" : undefined }));
  const bastV: V[] = nuevaBast.map((p, k) => ({ x: p.x, y: p.y, n: k === 0 ? "bastillaAtras" : k === nuevaBast.length - 1 ? "bastillaFrente" : undefined }));
  const contorno: V[] = [...bastV, ...[...copaV].reverse()];
  const r = crear(o.nombre ?? manga.nombre, contorno, { cortar: manga.cortar, ancla: manga.ancla, hilo: manga.hilo });
  margen(r, "bastillaAtras", "bastillaFrente", o.margenBastilla ?? 2.5);
  // piquetes de la copa: se mueven con su tira y se ajustan a la copa nueva
  for (const mk of manga.marcas) {
    if (mk.t !== "piquete") continue;
    const c = masCercano(copa, mk.p);
    if (c.d > 0.3) continue;
    let s = 0;
    for (let k = 0; k < c.i; k++) s += dist(copa[k], copa[k + 1]);
    s += dist(copa[c.i], c.p);
    const i = Math.min(N - 1, Math.floor((s / Lc) * N));
    const q = masCercano(r.contorno, T[i](mk.p));
    r.marcas.push({ t: "piquete", p: q.p, doble: mk.doble });
  }
  return r;
}

/** Copa de manga (misma forma que la base): atrás (x<0) → copa → frente (x>0). */
export function copaManga(h: number, atras: number, frente: number, llenura = 1): { frente: Pt[]; atras: Pt[] } {
  const T = P(0, h);
  const F = P(frente, 0);
  const A = P(-atras, 0);
  const mF = lerp(T, F, 0.5);
  const mA = lerp(T, A, 0.45);
  const dF = dir(T, F);
  const dA = dir(T, A);
  const k = 0.5 * llenura;
  const frenteSup = curva(T, P(1, 0), mF, dF, k, 0.35);
  const frenteInf = curva(mF, dF, F, P(1, 0), 0.4, 0.35);
  const atrasSup = curva(T, P(-1, 0), mA, dA, k, 0.35);
  const atrasInf = curva(mA, dA, A, P(-1, 0), 0.4, 0.3);
  return { frente: [...frenteSup, ...frenteInf.slice(1)], atras: [...atrasSup, ...atrasInf.slice(1)] };
}

/**
 * Traza una manga montada para una sisa cualquiera (hombro caído, camisera…).
 * Los nombres de puntos son los mismos que en la manga base.
 */
export function trazarManga(o: {
  nombre?: string;
  sisaDelantera: number;
  sisaEspalda: number;
  embebido: number;
  anchoBiceps: number;
  largo: number;
  bastilla: number;
  llenura?: number;
}): { manga: Pieza; altoCopa: number } {
  const frente = o.anchoBiceps / 2 - 0.5;
  const atras = o.anchoBiceps / 2 + 0.5;
  const objetivo = o.sisaDelantera + o.sisaEspalda + o.embebido;
  let lo = 1;
  let hi = 26;
  for (let k = 0; k < 50; k++) {
    const h = (lo + hi) / 2;
    const cp = copaManga(h, atras, frente, o.llenura);
    if (longitud(cp.frente) + longitud(cp.atras) > objetivo) hi = h;
    else lo = h;
  }
  const h = (lo + hi) / 2;
  const cp = copaManga(h, atras, frente, o.llenura);
  const yB = h - o.largo;
  const mb = o.bastilla / 2;
  const manga = crear(
    o.nombre ?? "Manga",
    [
      { x: -mb, y: yB, n: "bastillaAtras" },
      { x: mb, y: yB, n: "bastillaFrente" },
      { x: frente, y: 0, n: "sisaFrente" },
      ...[...cp.frente].reverse().slice(1, -1),
      { x: 0, y: h, n: "copa" },
      ...cp.atras.slice(1, -1),
      { x: -atras, y: 0, n: "sisaAtras" },
    ],
    { cortar: "Cortar 2 en tela (un par)", ancla: P(0, 0) },
  );
  margen(manga, "bastillaAtras", "bastillaFrente", 2.5);
  manga.hilo = [P(0, -3), P(0, yB + Math.min(8, o.largo / 3))];
  manga.marcas.push({ t: "linea", pts: [P(-atras, 0), P(frente, 0)], estilo: "guia" });
  piquete(manga, "copa");
  piqueteEn(manga, "sisaFrente", "copa", o.sisaDelantera * 0.33 + o.embebido * 0.15);
  piqueteDesdeFin(manga, "copa", "sisaAtras", o.sisaEspalda * 0.33 + o.embebido * 0.18, true);
  return { manga, altoCopa: h };
}

/** Piquetes a lo largo de un tramo (para zonas de frunce). */
export function piquetesFrunce(pz: Pieza, a: string, b: string, fracciones: number[]) {
  const t = tramo(pz, a, b);
  const L = longitud(t);
  for (const f of fracciones) piquete(pz, enLongitud(t, L * f).p);
}

export { v };
