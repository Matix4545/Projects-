// Modelo de pieza de patrón y las operaciones clásicas de transformación:
// traslado de pinzas (cortar y girar), dividir, unir, abrir (cortar y separar),
// suavizar, márgenes y doblez.
import {
  type Pt,
  angulo,
  areaFirmada,
  caja,
  dentro,
  dist,
  escalar,
  limpiar,
  longitud,
  enLongitud,
  masCercano,
  perp,
  remuestrear,
  resta,
  rotar,
  suavizarPolilinea,
  suma,
  dir,
  medio,
} from "./geometria.ts";

/** Vértice del contorno. `n` nombre; `m` margen del tramo que sale de este vértice; `d` tramo al doblez. */
export type V = Pt & { n?: string; m?: number; d?: boolean };

/** Pinza en V dentro del contorno: a → ápice → b (en el orden del contorno). `retiro`: cuánto antes del ápice termina al coser. */
export type Pinza = { a: string; apice: string; b: string; retiro: number };

export type Marca =
  | { t: "linea"; pts: Pt[]; estilo: "guia" | "pliegue" | "doblez" | "colocacion" | "costura" }
  | { t: "pinzaInterna"; pts: Pt[] }
  | { t: "taladro"; p: Pt }
  | { t: "piquete"; p: Pt; doble?: boolean }
  | { t: "texto"; p: Pt; s: string; h?: number }
  | { t: "boton"; p: Pt; r?: number }
  | { t: "ojal"; p: Pt; ang: number; l: number };

export type Pieza = {
  nombre: string;
  contorno: V[];
  pinzas: Pinza[];
  marcas: Marca[];
  hilo: [Pt, Pt] | null;
  cortar: string;
  /** Punto común para anidar las tallas una sobre otra. */
  ancla?: Pt;
  margen: number;
};

export const MARGEN = 1;

export function crear(nombre: string, contorno: V[], o: Partial<Pieza> = {}): Pieza {
  const pz: Pieza = {
    nombre,
    contorno: limpiar(contorno.map((v) => ({ ...v }))),
    pinzas: o.pinzas ?? [],
    marcas: o.marcas ?? [],
    hilo: o.hilo ?? null,
    cortar: o.cortar ?? "Cortar 2 en tela",
    ancla: o.ancla,
    margen: o.margen ?? MARGEN,
  };
  return orientar(pz);
}

export function clonar(pz: Pieza): Pieza {
  return structuredClone(pz);
}

// ── Búsqueda ────────────────────────────────────────────────────────────────

export function idx(pz: Pieza, n: string): number {
  const i = pz.contorno.findIndex((v) => v.n === n);
  if (i < 0) throw new Error(`La pieza "${pz.nombre}" no tiene el punto "${n}"`);
  return i;
}

export function tiene(pz: Pieza, n: string): boolean {
  return pz.contorno.some((v) => v.n === n);
}

export function v(pz: Pieza, n: string): V {
  return pz.contorno[idx(pz, n)];
}

/** Índices desde → hasta avanzando en el sentido del contorno (incluye ambos). */
export function indicesTramo(pz: Pieza, desde: string, hasta: string): number[] {
  const n = pz.contorno.length;
  const a = idx(pz, desde);
  const b = idx(pz, hasta);
  const r = [a];
  for (let k = a; k !== b; ) {
    k = (k + 1) % n;
    r.push(k);
  }
  return r;
}

export function tramo(pz: Pieza, desde: string, hasta: string): V[] {
  return indicesTramo(pz, desde, hasta).map((k) => ({ ...pz.contorno[k] }));
}

/** Largo de costura del tramo, con las pinzas cerradas (las patas se juntan). */
export function largoTramo(pz: Pieza, desde: string, hasta: string): number {
  const t = tramo(pz, desde, hasta);
  const apices = new Set(pz.pinzas.map((p) => p.apice));
  let l = 0;
  for (let k = 1; k < t.length; k++) {
    // los dos tramos que tocan un ápice desaparecen al cerrar la pinza
    if ((t[k].n && apices.has(t[k].n!)) || (t[k - 1].n && apices.has(t[k - 1].n!))) continue;
    l += dist(t[k - 1], t[k]);
  }
  return l;
}

/** Tramo como queda dibujado: sin ápices (la pinza se dibuja aparte). */
export function tramoSinPinzas(pz: Pieza, desde: string, hasta: string): V[] {
  const apices = new Set(pz.pinzas.map((p) => p.apice));
  return tramo(pz, desde, hasta).filter((p) => !(p.n && apices.has(p.n)));
}

// ── Transformaciones rígidas ────────────────────────────────────────────────

export function transformar(pz: Pieza, f: (p: Pt) => Pt): Pieza {
  const r = clonar(pz);
  const tp = <T extends Pt>(p: T): T => ({ ...p, ...f(p) });
  r.contorno = r.contorno.map(tp);
  r.hilo = r.hilo ? [f(r.hilo[0]), f(r.hilo[1])] : null;
  r.ancla = r.ancla ? f(r.ancla) : undefined;
  r.marcas = r.marcas.map((m) => {
    if ("pts" in m) return { ...m, pts: m.pts.map(f) };
    if ("p" in m) return { ...m, p: f(m.p) } as Marca;
    return m;
  });
  return orientar(r);
}

export const mover = (pz: Pieza, dx: number, dy: number) => transformar(pz, (p) => ({ x: p.x + dx, y: p.y + dy }));
export const girar = (pz: Pieza, c: Pt, ang: number) => transformar(pz, (p) => rotar(p, c, ang));
/** Espejo horizontal respecto a la vertical x = x0. */
export const espejarX = (pz: Pieza, x0 = 0) => transformar(pz, (p) => ({ x: 2 * x0 - p.x, y: p.y }));

/** Asegura sentido antihorario (necesario para los márgenes hacia afuera). */
export function orientar(pz: Pieza): Pieza {
  if (areaFirmada(pz.contorno) >= 0) return pz;
  const n = pz.contorno.length;
  const viejo = pz.contorno;
  const nuevo: V[] = [];
  for (let j = 0; j < n; j++) {
    const k = n - 1 - j;
    const ant = viejo[(k - 1 + n) % n];
    nuevo.push({ ...viejo[k], m: ant.m, d: ant.d });
  }
  pz.contorno = nuevo;
  pz.pinzas = pz.pinzas.map((p) => ({ ...p, a: p.b, b: p.a }));
  return pz;
}

// ── Edición del contorno ────────────────────────────────────────────────────

let contadorNombres = 0;
const nuevoNombre = (base: string) => `${base}~${++contadorNombres}`;

/** Inserta (o reutiliza) un vértice con nombre en el punto del contorno más cercano a `cerca`. */
export function insertar(pz: Pieza, n: string, cerca: Pt): string {
  const c = masCercano(pz.contorno, cerca);
  const a = pz.contorno[c.i];
  const b = pz.contorno[(c.i + 1) % pz.contorno.length];
  if (dist(c.p, a) < 0.02) {
    if (!a.n) a.n = n;
    return a.n!;
  }
  if (dist(c.p, b) < 0.02) {
    if (!b.n) b.n = n;
    return b.n!;
  }
  pz.contorno.splice(c.i + 1, 0, { ...c.p, n, m: a.m, d: a.d });
  return n;
}

/** Inserta un vértice a `distancia` cm de `desde`, avanzando hacia `hasta`. */
export function insertarEn(pz: Pieza, n: string, desde: string, hasta: string, distancia: number): string {
  const t = tramo(pz, desde, hasta);
  const { p } = enLongitud(t, distancia);
  return insertar(pz, n, p);
}

/** Reemplaza los vértices entre `desde` y `hasta` (exclusivos) por `nuevos`. Si `nuevos` incluye extremos, se usan para moverlos. */
export function reemplazar(pz: Pieza, desde: string, hasta: string, nuevos: Pt[], moverExtremos = true): void {
  const ia = idx(pz, desde);
  const ib = idx(pz, hasta);
  const va = pz.contorno[ia];
  const vb = pz.contorno[ib];
  let interior = nuevos;
  if (moverExtremos && nuevos.length >= 2) {
    Object.assign(va, { x: nuevos[0].x, y: nuevos[0].y });
    Object.assign(vb, { x: nuevos[nuevos.length - 1].x, y: nuevos[nuevos.length - 1].y });
    interior = nuevos.slice(1, -1);
  }
  const nuevosV: V[] = interior.map((p) => ({ x: p.x, y: p.y, m: va.m, d: va.d }));
  const n = pz.contorno.length;
  if (ia < ib) {
    pz.contorno.splice(ia + 1, ib - ia - 1, ...nuevosV);
  } else {
    // el tramo cruza el inicio del arreglo
    const cola = pz.contorno.slice(ib, ia + 1);
    pz.contorno = [...cola, ...nuevosV];
    void n;
  }
  pz.contorno = limpiar(pz.contorno);
}

export function moverPunto(pz: Pieza, n: string, p: Pt) {
  Object.assign(v(pz, n), { x: p.x, y: p.y });
}

export function renombrar(pz: Pieza, viejo: string, nuevo: string) {
  v(pz, viejo).n = nuevo;
  pz.pinzas = pz.pinzas.map((p) => ({
    ...p,
    a: p.a === viejo ? nuevo : p.a,
    b: p.b === viejo ? nuevo : p.b,
    apice: p.apice === viejo ? nuevo : p.apice,
  }));
}

/** Ordena dos puntos para que el tramo entre ellos sea el corto (el borde que los une directamente). */
export function corto(pz: Pieza, a: string, b: string): [string, string] {
  return indicesTramo(pz, a, b).length <= indicesTramo(pz, b, a).length ? [a, b] : [b, a];
}

/** Margen (cm) para el borde que une a y b (en cualquier sentido). */
export function margenBorde(pz: Pieza, a: string, b: string, cm: number) {
  const [x, y] = corto(pz, a, b);
  margen(pz, x, y, cm);
}

/** Doblez en el borde que une a y b (en cualquier sentido). */
export function doblezBorde(pz: Pieza, a: string, b: string) {
  const [x, y] = corto(pz, a, b);
  doblez(pz, x, y);
}

/** Margen (cm) para el tramo desde → hasta. */
export function margen(pz: Pieza, desde: string, hasta: string, cm: number) {
  const ids = indicesTramo(pz, desde, hasta);
  for (const k of ids.slice(0, -1)) pz.contorno[k].m = cm;
}

/** Marca el tramo como doblez de tela (sin margen). */
export function doblez(pz: Pieza, desde: string, hasta: string) {
  const ids = indicesTramo(pz, desde, hasta);
  for (const k of ids.slice(0, -1)) {
    pz.contorno[k].d = true;
    pz.contorno[k].m = 0;
  }
}

export function piquete(pz: Pieza, en: string | Pt, doble = false) {
  const p = typeof en === "string" ? v(pz, en) : en;
  pz.marcas.push({ t: "piquete", p: { x: p.x, y: p.y }, doble });
}

/** Piquete a cierta distancia del final del tramo (medida hacia atrás). */
export function piqueteDesdeFin(pz: Pieza, desde: string, hasta: string, distancia: number, doble = false) {
  const t = tramoSinPinzas(pz, desde, hasta);
  piquete(pz, enLongitud(t, longitud(t) - distancia).p, doble);
}

/** Piquete a cierta distancia sobre un tramo. */
export function piqueteEn(pz: Pieza, desde: string, hasta: string, distancia: number, doble = false) {
  const t = tramoSinPinzas(pz, desde, hasta);
  piquete(pz, enLongitud(t, distancia).p, doble);
}

export function texto(pz: Pieza, p: Pt, s: string, h = 1) {
  pz.marcas.push({ t: "texto", p, s, h });
}

// ── Pinzas ──────────────────────────────────────────────────────────────────

/** Crea una pinza en V centrada en el punto del contorno más cercano a `centro`, con abertura `ancho` y ápice `apice`. */
export function agregarPinza(pz: Pieza, nombre: string, centro: Pt, apice: Pt, ancho: number, retiro = 0): Pinza {
  const c = masCercano(pz.contorno, centro);
  // longitudes de arco acumuladas desde el vértice 0
  const n = pz.contorno.length;
  const acum = [0];
  for (let k = 1; k <= n; k++) acum.push(acum[k - 1] + dist(pz.contorno[k - 1], pz.contorno[k % n]));
  const s0 = acum[c.i] + dist(pz.contorno[c.i], c.p);
  const cerrado = [...pz.contorno, pz.contorno[0]];
  const enS = (s: number) => enLongitud(cerrado, s).p;
  const pa = enS(s0 - ancho / 2);
  const pb = enS(s0 + ancho / 2);
  const lm = (dist(apice, pa) + dist(apice, pb)) / 2;
  const qa = suma(apice, escalar(dir(apice, pa), lm));
  const qb = suma(apice, escalar(dir(apice, pb), lm));
  const pin: Pinza = { a: `${nombre}A`, apice: nombre, b: `${nombre}B`, retiro };
  const mBase = pz.contorno[c.i].m;
  const dBase = pz.contorno[c.i].d;
  const nuevo: V[] = [];
  let insertado = false;
  for (let k = 0; k < n; k++) {
    const sk = acum[k];
    const p = pz.contorno[k];
    const entre = sk > s0 - ancho / 2 + 1e-6 && sk < s0 + ancho / 2 - 1e-6;
    if (!entre || p.n) {
      if (!insertado && sk > s0) {
        nuevo.push({ ...qa, n: pin.a, m: mBase, d: dBase }, { ...apice, n: pin.apice, m: mBase, d: dBase }, { ...qb, n: pin.b, m: mBase, d: dBase });
        insertado = true;
      }
      if (!entre) nuevo.push(p);
    }
  }
  if (!insertado) nuevo.push({ ...qa, n: pin.a, m: mBase }, { ...apice, n: pin.apice, m: mBase }, { ...qb, n: pin.b, m: mBase });
  pz.contorno = nuevo;
  pz.pinzas.push(pin);
  return pin;
}

/** Abertura actual de una pinza (cm entre patas). */
export function aberturaPinza(pz: Pieza, apice: string): number {
  const pin = pz.pinzas.find((p) => p.apice === apice)!;
  return dist(v(pz, pin.a), v(pz, pin.b));
}

const FIJOS = (n?: string) => !!n && n.startsWith("centro");

function normalizarAng(a: number) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

/**
 * Traslado de pinza por el método de cortar y girar: corta del punto `destino`
 * (vértice del contorno) al ápice y gira la parte de la pieza entre el corte y la
 * pinza vieja hasta cerrarla (o cerrarla en `fraccion`). El centro (puntos "centro…") no se mueve.
 */
export function trasladarPinza(
  pz: Pieza,
  apice: string,
  destino: string,
  o: { fraccion?: number; nombre?: string; retiro?: number } = {},
): Pieza {
  const r = clonar(pz);
  const pin = r.pinzas.find((p) => p.apice === apice);
  if (!pin) throw new Error(`No hay pinza con ápice ${apice}`);
  const fr = o.fraccion ?? 1;
  const nombre = o.nombre ?? `${apice}_${destino}`;
  const n = r.contorno.length;
  const iA = idx(r, pin.a);
  const iB = idx(r, pin.b);
  const iD = idx(r, destino);
  const ap = v(r, pin.apice);
  // cadena hacia adelante: D … A ; hacia atrás: B … D
  const cadF: number[] = [];
  for (let k = iD; ; k = (k + 1) % n) {
    cadF.push(k);
    if (k === iA) break;
  }
  const cadR: number[] = [];
  for (let k = iB; ; k = (k + 1) % n) {
    cadR.push(k);
    if (k === iD) break;
  }
  const usarF = !cadF.some((k) => FIJOS(r.contorno[k].n)) || cadR.some((k) => FIJOS(r.contorno[k].n));
  const A = v(r, pin.a);
  const B = v(r, pin.b);
  const theta =
    fr * normalizarAng(usarF ? angulo(resta(B, ap)) - angulo(resta(A, ap)) : angulo(resta(A, ap)) - angulo(resta(B, ap)));
  const cadena = usarF ? cadF : cadR;
  const region = [ap, ...cadena.map((k) => r.contorno[k])];
  const enRegion = (p: Pt) => dentro(p, region);

  const D = r.contorno[iD];
  const Drot: V = { ...D, ...rotar(D, ap, theta) };
  const rotados = new Map<number, V>();
  for (const k of cadena) if (k !== iD) rotados.set(k, { ...r.contorno[k], ...rotar(r.contorno[k], ap, theta) });

  const nuevo: V[] = [];
  const nombreA = `${nombre}A`;
  const nombreB = `${nombre}B`;
  // si se traslada completa, la pinza vieja desaparece: su ápice y la pata girada
  const iP = idx(r, pin.apice);
  const borrar = fr >= 0.999 ? new Set([iP, usarF ? iA : iB]) : new Set<number>();
  // la pata que queda de la pinza cerrada pierde su nombre (para no confundirla con la nueva)
  const iQueda = fr >= 0.999 ? (usarF ? iB : iA) : -1;
  for (let k = 0; k < n; k++) {
    if (borrar.has(k)) continue;
    const p = k === iQueda ? { ...r.contorno[k], n: `${r.contorno[k].n}~cerrada` } : r.contorno[k];
    if (k === iD) {
      const fijo: V = { ...D };
      if (usarF) {
        nuevo.push({ ...fijo, n: nombreA }, { ...ap, n: nombre, m: D.m, d: D.d }, { ...Drot, n: nombreB });
      } else {
        nuevo.push({ ...Drot, n: nombreA }, { ...ap, n: nombre, m: D.m, d: D.d }, { ...fijo, n: nombreB });
      }
      continue;
    }
    const rot = rotados.get(k);
    nuevo.push(rot ? { ...rot, n: p.n } : { ...p });
  }
  r.contorno = nuevo;
  if (fr >= 0.999) r.pinzas = r.pinzas.filter((q) => q.apice !== apice || q !== pin);
  r.pinzas = r.pinzas.filter((q) => q !== pin || fr < 0.999);
  const nombreFijo = usarF ? nombreA : nombreB;
  r.pinzas = r.pinzas.map((q) => ({ ...q, a: q.a === destino ? nombreFijo : q.a, b: q.b === destino ? nombreFijo : q.b }));
  r.pinzas.push({ a: nombreA, apice: nombre, b: nombreB, retiro: o.retiro ?? pin.retiro });
  // marcas dentro de la parte girada
  r.marcas = r.marcas.map((m) => {
    if ("pts" in m) return enRegion(medioDe(m.pts)) ? { ...m, pts: m.pts.map((q) => rotar(q, ap, theta)) } : m;
    if ("p" in m) return enRegion(m.p) ? ({ ...m, p: rotar(m.p, ap, theta) } as Marca) : m;
    return m;
  });
  r.contorno = limpiar(r.contorno);
  return r;
}

function medioDe(pts: Pt[]): Pt {
  return pts.length === 2 ? medio(pts[0], pts[1]) : pts[Math.floor(pts.length / 2)];
}

/** Une dos pinzas contiguas (la pata b de una es la pata a de la otra) en una sola. */
export function fusionarPinzas(pz: Pieza, apice1: string, apice2: string, nombre = apice1): Pieza {
  const r = clonar(pz);
  let p1 = r.pinzas.find((q) => q.apice === apice1)!;
  let p2 = r.pinzas.find((q) => q.apice === apice2)!;
  if (p2.b === p1.a) [p1, p2] = [p2, p1];
  if (p1.b !== p2.a) throw new Error("Las pinzas no son contiguas");
  const quitar = new Set([p1.b, p2.apice]);
  r.contorno = r.contorno.filter((q) => !(q.n && quitar.has(q.n)));
  r.pinzas = r.pinzas.filter((q) => q !== p1 && q !== p2);
  if (p1.apice !== nombre) renombrar(r, p1.apice, nombre);
  r.pinzas.push({ a: p1.a, apice: nombre, b: p2.b, retiro: Math.max(p1.retiro, p2.retiro) });
  return r;
}

// ── Dividir, unir, abrir ────────────────────────────────────────────────────

function repartir(original: Pieza, piezas: Pieza[]) {
  for (const p of piezas) {
    const nombres = new Set(p.contorno.map((q) => q.n).filter(Boolean));
    p.pinzas = original.pinzas.filter((q) => nombres.has(q.a) && nombres.has(q.b) && nombres.has(q.apice));
    p.marcas = original.marcas.filter((m) => {
      const ref = "pts" in m ? medioDe(m.pts) : "p" in m ? m.p : null;
      return ref ? dentro(ref, p.contorno) || masCercano(p.contorno, ref).d < 0.05 : false;
    });
    if (original.hilo && !dentro(medio(original.hilo[0], original.hilo[1]), p.contorno)) p.hilo = hiloVertical(p);
  }
}

/** Línea de hilo vertical en el centro de la pieza. */
export function hiloVertical(pz: Pieza, ang = Math.PI / 2): [Pt, Pt] {
  const c = caja(pz.contorno);
  const centro = { x: (c.x0 + c.x1) / 2, y: (c.y0 + c.y1) / 2 };
  const l = Math.max(4, Math.min(c.alto, c.ancho) * 0.6);
  return [rotar({ x: centro.x, y: centro.y - l / 2 }, centro, ang - Math.PI / 2), rotar({ x: centro.x, y: centro.y + l / 2 }, centro, ang - Math.PI / 2)];
}

/**
 * Corta la pieza con una línea que va del vértice `desde` al vértice `hasta`
 * (ambos en el contorno) pasando por los puntos `interior`.
 * Devuelve [parte desde→hasta, parte hasta→desde].
 */
export function dividir(pz: Pieza, desde: string, hasta: string, interior: Pt[] = [], nombres: [string, string] = [pz.nombre, pz.nombre]): [Pieza, Pieza] {
  const t1 = tramo(pz, desde, hasta);
  const t2 = tramo(pz, hasta, desde);
  const corteM = { m: pz.margen, d: false };
  t1[t1.length - 1] = { ...t1[t1.length - 1], ...corteM };
  t2[t2.length - 1] = { ...t2[t2.length - 1], ...corteM };
  const c1: V[] = [...t1, ...[...interior].reverse().map((p) => ({ x: p.x, y: p.y, ...corteM }))];
  const c2: V[] = [...t2, ...interior.map((p) => ({ x: p.x, y: p.y, ...corteM }))];
  const p1 = { ...clonar(pz), nombre: nombres[0], contorno: limpiar(c1) };
  const p2 = { ...clonar(pz), nombre: nombres[1], contorno: limpiar(c2) };
  repartir(pz, [p1, p2]);
  return [orientar(p1), orientar(p2)];
}

/**
 * Une dos piezas por una costura: el tramo a1→b1 de `p1` con el tramo a2→b2 de `p2`
 * (a1 se junta con b2 y b1 con a2). `p2` se mueve y gira para encajar.
 */
export function unir(p1: Pieza, a1: string, b1: string, p2: Pieza, a2: string, b2: string, nombre = p1.nombre): Pieza {
  const A1 = v(p1, a1);
  const B1 = v(p1, b1);
  const A2 = v(p2, a2);
  const B2 = v(p2, b2);
  // transformación rígida que lleva B2→A1 y A2→B1
  const ang = angulo(resta(B1, A1)) - angulo(resta(A2, B2));
  let q = girar(p2, B2, ang);
  const nb2 = v(q, b2);
  q = mover(q, A1.x - nb2.x, A1.y - nb2.y);
  const c1 = tramo(p1, b1, a1);
  const c2 = tramo(q, b2, a2).slice(1, -1);
  const r: Pieza = {
    ...clonar(p1),
    nombre,
    contorno: limpiar([...c1, ...c2]),
    pinzas: [...p1.pinzas, ...q.pinzas],
    marcas: [...p1.marcas, ...q.marcas],
  };
  return orientar(r);
}

/**
 * Cortar y separar: corta de `desde` (extremo que se abre) a `hasta` (bisagra)
 * y gira la parte de "adelante" (hasta→desde en el contorno) para abrir `apertura` cm.
 * Con `paralelo`, la separación es igual en ambos extremos (agrega amplitud para frunces).
 */
export function abrir(pz: Pieza, desde: string, hasta: string, apertura: number, o: { paralelo?: boolean; girarDesde?: boolean } = {}): Pieza {
  const [A, B] = dividir(pz, desde, hasta);
  // A: desde … hasta (más el corte de regreso); B: hasta … desde
  const D = v(pz, desde);
  const H = v(pz, hasta);
  let Bm: Pieza;
  if (o.paralelo) {
    let nrm = perp(dir(D, H));
    const prueba = suma(medio(D, H), escalar(nrm, 0.5));
    if (dentro(prueba, A.contorno)) nrm = escalar(nrm, -1);
    Bm = mover(B, nrm.x * apertura, nrm.y * apertura);
  } else {
    const r = dist(D, H);
    const th = 2 * Math.asin(Math.min(1, apertura / (2 * r)));
    const mas = rotar(D, H, th);
    const signo = dentro(medio(D, mas), A.contorno) ? -1 : 1;
    Bm = girar(B, H, signo * th);
  }
  // contorno: A sin el corte (desde → hasta) + B movida (hasta → desde)
  const ca = tramo(A, desde, hasta);
  const cb = tramo(Bm, hasta, desde);
  ca[ca.length - 1] = { ...ca[ca.length - 1], m: cb[0].m, d: cb[0].d };
  const nb = cb.map((p, k) => {
    if (k === cb.length - 1) return { ...p, n: `${desde}'` };
    if (k === 0) return { ...p, n: o.paralelo ? `${hasta}'` : undefined };
    return p;
  });
  // el hueco en el extremo abierto hereda el margen del tramo original
  const r: Pieza = {
    ...clonar(pz),
    contorno: limpiar(o.paralelo ? [...ca, ...nb] : [...ca, ...nb.slice(1)]),
    pinzas: [...A.pinzas, ...Bm.pinzas.filter((q) => !A.pinzas.some((w) => w.apice === q.apice))],
    marcas: [...A.marcas, ...Bm.marcas],
  };
  const ult = r.contorno[r.contorno.length - 1];
  ult.m = v(pz, desde).m;
  ult.d = v(pz, desde).d;
  return orientar(r);
}

/** Suaviza el tramo desde → hasta (para emparejar bastillas y copas después de abrir). */
export function suavizar(pz: Pieza, desde: string, hasta: string, iteraciones = 25, paso = 0.6): void {
  const t = tramo(pz, desde, hasta);
  if (t.length < 3) return;
  const nombrados = t.filter((p, k) => p.n && k > 0 && k < t.length - 1);
  let pts = remuestrear(t, 0.6);
  pts = suavizarPolilinea(pts, iteraciones, paso);
  const nuevos: V[] = pts.map((p) => ({ x: p.x, y: p.y }));
  for (const q of nombrados) {
    let mejor = 1;
    let d = Infinity;
    for (let k = 1; k < nuevos.length - 1; k++) {
      const dd = dist(nuevos[k], q);
      if (dd < d && !nuevos[k].n) {
        d = dd;
        mejor = k;
      }
    }
    nuevos[mejor].n = q.n;
  }
  const m0 = t[0].m;
  const d0 = t[0].d;
  const ia = idx(pz, desde);
  const ib = idx(pz, hasta);
  const interior = nuevos.slice(1, -1).map((p) => ({ ...p, m: m0, d: d0 }));
  if (ia < ib) pz.contorno.splice(ia + 1, ib - ia - 1, ...interior);
  else pz.contorno = [...pz.contorno.slice(ib, ia + 1), ...interior];
  pz.contorno = limpiar(pz.contorno);
}

/** Refleja la pieza sobre el tramo recto desde→hasta (pieza al doblez → pieza completa). */
export function completar(pz: Pieza, desde: string, hasta: string): Pieza {
  const a = v(pz, desde);
  const b = v(pz, hasta);
  const refl = (p: Pt) => {
    const d = dir(a, b);
    const w = resta(p, a);
    const proy = escalar(d, w.x * d.x + w.y * d.y);
    return suma(a, resta(escalar(proy, 2), w));
  };
  const lado = tramo(pz, hasta, desde); // sin el doblez
  const espejo = [...lado].reverse().map((p) => ({ ...p, ...refl(p), n: p.n ? `${p.n}*` : undefined }));
  const c: V[] = [...lado.map((p, k) => (k === lado.length - 1 ? { ...p, d: false } : p)), ...espejo.slice(1, -1)];
  // márgenes del espejo: el tramo k del espejo corresponde al tramo reflejado
  for (let k = 0; k < espejo.length - 1; k++) {
    const orig = lado[lado.length - 2 - k];
    const e = c[lado.length - 1 + k];
    if (e && orig) {
      e.m = orig.m;
      e.d = orig.d;
    }
  }
  const pinzasEsp = pz.pinzas.map((p) => ({ a: `${p.b}*`, apice: `${p.apice}*`, b: `${p.a}*`, retiro: p.retiro }));
  const marcasEsp = pz.marcas.map((m) => ("pts" in m ? { ...m, pts: m.pts.map(refl) } : "p" in m ? ({ ...m, p: refl(m.p) } as Marca) : m));
  const r: Pieza = { ...clonar(pz), contorno: limpiar(c), pinzas: [...pz.pinzas, ...pinzasEsp], marcas: [...pz.marcas, ...marcasEsp.filter((m) => m.t !== "texto")] };
  r.cortar = "Cortar 1 en tela (pieza completa)";
  return orientar(r);
}

// ── Medidas útiles ──────────────────────────────────────────────────────────

export function area(pz: Pieza): number {
  return Math.abs(areaFirmada(pz.contorno));
}

export { nuevoNombre };
