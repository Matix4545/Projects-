// Herramientas para faldas (también sirven para la parte de abajo de los vestidos).
// Todas trabajan sobre las piezas de `faldaBase` (bases/falda.ts): puntos
// centroCintura, costadoCintura, cadera, costadoBajo, centroBajo y pinzas pinza1/pinza2.
import { type Pt, P, cruceSegmentos, curva, dentro, dir, dist, escalar, longitud, medio, rotar, suma } from "../geometria.ts";
import type { Medidas } from "../medidas.ts";
import { rectangulo } from "../bases/utiles.ts";
import {
  type Pieza,
  type V,
  clonar,
  corto,
  crear,
  dividir,
  insertar,
  largoTramo,
  margenBorde,
  piquete,
  reemplazar,
  suavizar,
  tiene,
  tramo,
  trasladarPinza,
  v,
} from "../pieza.ts";

/** Medio contorno de cintura con holgura (cm): lo que mide la cintura de una falda base. */
export const cinturaFalda = (m: Medidas) => m.cintura + 2;

/**
 * Ordena a y b para que el tramo a → b NO pase por puntos cuyo nombre cumpla `evitar`.
 * (Más seguro que `corto`, que sólo cuenta vértices.)
 */
export function orden(pz: Pieza, a: string, b: string, evitar: (n: string) => boolean): [string, string] {
  const interior = tramo(pz, a, b).slice(1, -1);
  return interior.some((q) => q.n && evitar(q.n)) ? [b, a] : [a, b];
}
/** Bastilla: el tramo que no pasa por la cintura. */
export const ordenBastilla = (pz: Pieza, a: string, b: string) => orden(pz, a, b, (n) => /Cintura|cintura/.test(n));
/** Cintura: el tramo que no pasa por la bastilla ni la cadera. */
export const ordenCintura = (pz: Pieza, a: string, b: string) => orden(pz, a, b, (n) => /Bajo|cadera/.test(n));
/** Costado: el tramo que no pasa por los centros. */
export const ordenCostado = (pz: Pieza, a: string, b: string) => orden(pz, a, b, (n) => n.startsWith("centro"));

/** Primer cruce de la semirrecta o + t·d (t > 0) con el tramo desde → hasta. */
export function cruceConTramo(pz: Pieza, desde: string, hasta: string, o: Pt, d: Pt): Pt | null {
  const t = tramo(pz, desde, hasta);
  const lejos = suma(o, escalar(d, 1000));
  for (let k = 1; k < t.length; k++) {
    const c = cruceSegmentos(o, lejos, t[k - 1], t[k]);
    if (c) return c.p;
  }
  return null;
}

/** Punto del tramo desde → hasta a la altura `y` (primer cruce). */
export function puntoEnY(pz: Pieza, desde: string, hasta: string, y: number): Pt | null {
  const t = tramo(pz, desde, hasta);
  for (let k = 1; k < t.length; k++) {
    const a = t[k - 1];
    const b = t[k];
    if ((a.y - y) * (b.y - y) <= 0 && a.y !== b.y) {
      const s = (y - a.y) / (b.y - a.y);
      return P(a.x + (b.x - a.x) * s, y);
    }
  }
  return null;
}

/** Quita una pinza en V rellenando su abertura (el borde pasa recto de pata a pata). */
export function rellenarPinza(pz: Pieza, apice: string): void {
  pz.contorno = pz.contorno.filter((q) => q.n !== apice);
  pz.pinzas = pz.pinzas.filter((q) => q.apice !== apice);
}

/**
 * Quita pinzas rotas (con algún punto que ya no está en el contorno) y sus puntos sueltos.
 * Pasa con medidas extremas (cadera − cintura > 40 cm), cuando las pinzas de la falda base
 * se enciman. Devuelve la misma pieza.
 */
export function sanearPinzas(pz: Pieza): Pieza {
  const nombres = new Set(pz.contorno.map((q) => q.n).filter(Boolean));
  const rotas = pz.pinzas.filter((p) => !(nombres.has(p.a) && nombres.has(p.b) && nombres.has(p.apice)));
  if (!rotas.length) return pz;
  const quitar = new Set(rotas.flatMap((p) => [p.a, p.apice, p.b]));
  pz.contorno = pz.contorno.filter((q) => !(q.n && quitar.has(q.n)));
  pz.pinzas = pz.pinzas.filter((p) => !rotas.includes(p));
  return pz;
}

/** Nombres de las pinzas de cintura de una pieza de falda (pinza1, pinza2…). */
export const pinzasDe = (pz: Pieza) => pz.pinzas.map((p) => p.apice);

/**
 * Cierra (total o parcialmente) una pinza de cintura y abre la misma cantidad en la bastilla:
 * corta desde la bastilla siguiendo la línea de la pinza hasta su punta y gira.
 */
export function abrirPinzaAlBajo(pz: Pieza, apice: string, fraccion = 1): Pieza {
  const pin = pz.pinzas.find((p) => p.apice === apice);
  if (!pin) return pz;
  const ap = v(pz, apice);
  const base = medio(v(pz, pin.a), v(pz, pin.b));
  const [h1, h2] = ordenBastilla(pz, "centroBajo", "costadoBajo");
  const enBajo = cruceConTramo(pz, h1, h2, ap, dir(base, ap));
  if (!enBajo) return pz;
  const r = clonar(pz);
  const nombre = insertar(r, `${apice}Corte`, enBajo);
  const res = trasladarPinza(r, apice, nombre, { fraccion, nombre: `${apice}Bajo` });
  rellenarPinza(res, `${apice}Bajo`);
  return res;
}

/**
 * Da vuelo en el costado: gira el punto `extremo` alrededor de `pivote` hacia afuera
 * hasta separarlo `cm` (la costura conserva su largo, así delantero y espalda siguen iguales).
 */
export function vueloCostado(pz: Pieza, cm: number, pivote = "cadera", extremo = "costadoBajo"): void {
  if (cm <= 0) return;
  const pv = v(pz, pivote);
  const ex = v(pz, extremo);
  const l = dist(pv, ex);
  const fi = 2 * Math.asin(Math.min(1, cm / (2 * l)));
  const a = rotar(ex, pv, fi);
  const b = rotar(ex, pv, -fi);
  const fuera = !dentro(medio(ex, a), pz.contorno) ? a : b;
  Object.assign(ex, { x: fuera.x, y: fuera.y });
}

/**
 * Rehace la bastilla entre a y b como una curva que sale a escuadra (90°) de las
 * costuras de los dos extremos: así, al coser, la bastilla queda pareja.
 */
export function bastillaAEscuadra(pz: Pieza, a: string, b: string, k = 0.35): void {
  const [x, y] = ordenBastilla(pz, a, b);
  const n = pz.contorno.length;
  const ix = pz.contorno.findIndex((q) => q.n === x);
  const iy = pz.contorno.findIndex((q) => q.n === y);
  const px = pz.contorno[ix];
  const py = pz.contorno[iy];
  const antes = pz.contorno[(ix - 1 + n) % n];
  const despues = pz.contorno[(iy + 1) % n];
  const dIn = dir(antes, px);
  const dOut = dir(py, despues);
  const t0 = P(-dIn.y, dIn.x); // gira +90°
  const t1 = P(dOut.y, -dOut.x); // gira −90°
  reemplazar(pz, x, y, curva(px, t0, py, t1, k, k, 32));
}

/** Suaviza la bastilla (de centro a costado). */
export function suavizarBajo(pz: Pieza, iteraciones = 30): void {
  const [a, b] = ordenBastilla(pz, "centroBajo", "costadoBajo");
  suavizar(pz, a, b, iteraciones, 0.6);
}

/** Largo de cintura de una pieza (pinzas cerradas). */
export function largoCintura(pz: Pieza): number {
  const [a, b] = ordenCintura(pz, "centroCintura", "costadoCintura");
  return largoTramo(pz, a, b);
}

/** Largo de costado (cintura a bastilla). */
export function largoCostado(pz: Pieza): number {
  const [a, b] = ordenCostado(pz, "costadoCintura", "costadoBajo");
  return largoTramo(pz, a, b);
}

/**
 * Línea A: cierra las pinzas de cintura (la más cercana al costado completa, la otra en
 * `fraccion`) pasándolas a la bastilla y agrega `vuelo` cm en el costado.
 */
export function evase(pz: Pieza, o: { vuelo?: number; fraccion?: number } = {}): Pieza {
  let r = sanearPinzas(clonar(pz));
  const nombres = pinzasDe(r).sort(); // pinza1 (hacia el centro), pinza2 (hacia el costado)
  for (const [k, n] of [...nombres].reverse().entries()) {
    const fr = k === 0 && nombres.length > 1 ? 1 : (o.fraccion ?? 0.5);
    r = abrirPinzaAlBajo(r, n, nombres.length === 1 ? (o.fraccion ?? 1) : fr);
  }
  vueloCostado(r, o.vuelo ?? 3);
  bastillaAEscuadra(r, "centroBajo", "costadoBajo");
  return r;
}

/** Pretina doblada al centro: cintura + 2 cm de holgura + `cruce` cm de traslape. Alto terminado `alto`. */
export function pretina(m: Medidas, o: { cruce?: number; alto?: number; nombre?: string } = {}): Pieza {
  const cruce = o.cruce ?? 3;
  const alto = o.alto ?? 4;
  const c = cinturaFalda(m);
  const r = rectangulo(o.nombre ?? "Pretina", c + cruce, alto * 2, "Cortar 1 en tela y 1 en entretela", { dobladoAlCentro: true });
  // piquetes: centro espalda, costados y centro delantero (el traslape queda al final)
  for (const f of [0, 0.25, 0.5, 0.75, 1]) piquete(r, P(c * f, 0));
  r.marcas.push({ t: "boton", p: P(c + cruce / 2, alto * 1.5), r: 0.6 });
  r.ancla = P(0, 0);
  return r;
}

/** Panel rectangular de falda (cintura arriba, bastilla abajo con 3 cm). */
export function panel(nombre: string, ancho: number, alto: number, cortar: string, bastilla = 3): Pieza {
  const r = rectangulo(nombre, ancho, alto, cortar);
  margenBorde(r, "a", "b", bastilla);
  r.hilo = [P(Math.min(8, ancho * 0.2), alto * 0.25), P(Math.min(8, ancho * 0.2), alto * 0.75)];
  r.ancla = P(0, alto);
  return r;
}

/** Pieza en sector de círculo con vértice arriba (godet). `alto` = largo de sus lados; `ancho` = abertura en la bastilla. */
export function godet(alto: number, ancho: number, cortar = "Cortar 6 en tela"): Pieza {
  const a = Math.asin(Math.min(0.95, ancho / (2 * alto)));
  const pts: V[] = [{ x: 0, y: 0, n: "vertice" }];
  const n = 24;
  for (let k = 0; k <= n; k++) {
    const t = -Math.PI / 2 - a + (2 * a * k) / n;
    pts.push({ x: alto * Math.cos(t), y: alto * Math.sin(t), n: k === 0 ? "bajoIzq" : k === n ? "bajoDer" : undefined });
  }
  const r = crear("Godet", pts, { cortar, ancla: P(0, 0) });
  r.hilo = [P(0, -alto * 0.3), P(0, -alto * 0.8)];
  return r;
}

/** Quita todas las pinzas en V (el borde queda recto entre sus vecinos). */
export function sinPinzas(pz: Pieza): { pieza: Pieza; supresion: number } {
  const r = sanearPinzas(clonar(pz));
  let supresion = 0;
  for (const pin of r.pinzas) {
    supresion += dist(v(r, pin.a), v(r, pin.b));
    const quitar = new Set([pin.a, pin.apice, pin.b]);
    r.contorno = r.contorno.filter((q) => !(q.n && quitar.has(q.n)));
  }
  r.pinzas = [];
  return { pieza: r, supresion };
}

export type OpcionesNesgas = {
  /** Vuelo agregado en la bastilla a cada lado de cada costura (cm). */
  vuelo: number;
  /** Altura (y, negativa) desde donde empieza el vuelo; por defecto la cadera. */
  yVuelo?: number;
  /** Entalle en esa altura (cm hacia adentro de cada nesga), para faldas sirena. */
  entalle?: number;
  /** x de la costura de la nesga; por defecto la punta de la pinza 1. */
  x?: number;
};

/**
 * Corta media falda (delantero o espalda) en dos nesgas por la línea de la pinza 1.
 * Las pinzas se vuelven parte de la costura (curva de cintura a cadera) y se agrega
 * vuelo en la bastilla en la costura nueva y en el costado. Devuelve [centro, costado].
 */
export function nesgas(pz: Pieza, m: Medidas, o: OpcionesNesgas): [Pieza, Pieza] {
  pz = sanearPinzas(clonar(pz));
  const pin = pz.pinzas.find((p) => p.apice === "pinza1") ?? pz.pinzas[0];
  const xs = o.x ?? (pin ? v(pz, pin.apice).x : (v(pz, "centroCintura").x + v(pz, "costadoCintura").x) / 2);
  const { pieza: base, supresion } = sinPinzas(pz);
  const s = Math.sign(v(base, "costadoBajo").x - v(base, "centroBajo").x); // hacia el costado
  const yCad = -m.alturaCadera;
  const yBajo = v(base, "centroBajo").y;
  const yV = o.yVuelo ?? yCad;
  const ent = o.entalle ?? 0;
  const yCint = Math.max(v(base, "centroCintura").y, v(base, "costadoCintura").y);
  const wC = insertar(base, "nesgaCintC", P(xs - (s * supresion) / 2, yCint + 0.5));
  const wS = insertar(base, "nesgaCintS", P(xs + (s * supresion) / 2, yCint + 0.5));
  const hm = insertar(base, "nesgaBajo", P(xs, yBajo));
  const cad = P(xs, yCad);
  const largoV = yV - yBajo;
  const fi = Math.atan2(o.vuelo, largoV);
  // línea de costura de cada nesga: cintura → (curva) cadera → (entalle) → bastilla con vuelo
  const linea = (desde: Pt, lado: number) => {
    const c = curva(desde, P(0, -1), cad, P(0, -1), 0.4, 0.45).slice(1);
    const pts: Pt[] = [...c];
    const piv = yV < yCad - 0.1 ? P(xs + lado * s * ent, yV) : cad;
    if (yV < yCad - 0.1) pts.push(piv);
    // vuelo hacia afuera de la nesga: la del centro abre hacia el costado y viceversa
    const fin = suma(piv, rotar(P(0, -largoV), P(0, 0), -lado * s * fi));
    pts.push(fin);
    return pts;
  };
  // lado = -1 → nesga del centro (su costura está hacia el costado), +1 → nesga del costado
  const lCentro = linea(v(base, wC), -1);
  const lCostado = linea(v(base, wS), 1);
  const [a1, b1] = dividir(base, wC, hm, lCentro);
  const centro = tiene(a1, "centroBajo") ? a1 : b1;
  const [a2, b2] = dividir(base, wS, hm, lCostado);
  const costado = tiene(a2, "costadoBajo") ? a2 : b2;
  const finC = insertar(centro, "nesgaBajoC", lCentro[lCentro.length - 1]);
  const finS = insertar(costado, "nesgaBajoS", lCostado[lCostado.length - 1]);
  for (const p of [centro, costado]) p.contorno = p.contorno.filter((q) => q.n !== "nesgaBajo");
  // vuelo (y entalle) en el costado del panel lateral
  if (yV < yCad - 0.1 && ent > 0) {
    const pr = puntoEnY(costado, ...orden(costado, "cadera", "costadoBajo", (n) => /Cintura|nesga/.test(n)), yV);
    if (pr) {
      const nombre = insertar(costado, "rodillaCostado", pr);
      const q = v(costado, nombre);
      Object.assign(q, { x: q.x - s * ent });
      vueloCostado(costado, o.vuelo, nombre);
    }
  } else vueloCostado(costado, o.vuelo);
  // bastillas: 3 cm y suavizadas para que queden a escuadra con las costuras
  const bastillas: [Pieza, string, string][] = [
    [centro, "centroBajo", finC],
    [costado, finS, "costadoBajo"],
  ];
  for (const [p, a, b] of bastillas) {
    const [x, y] = ordenBastilla(p, a, b);
    margenBorde(p, x, y, 3);
    bastillaAEscuadra(p, x, y);
    piquete(p, cad);
    p.ancla = P(xs, yCint);
  }
  // hilo vertical al centro de cada nesga
  const xCentro = v(base, "centroBajo").x;
  const xCad = v(base, "cadera").x;
  centro.hilo = [P((xCentro + xs) / 2, yCad - 3), P((xCentro + xs) / 2, yBajo + 10)];
  costado.hilo = [P((xs + xCad) / 2, yCad - 3), P((xs + xCad) / 2, yBajo + 10)];
  return [centro, costado];
}

/** Largo de un tramo de costura entre dos puntos (en el sentido corto). */
export function largoEntre(pz: Pieza, a: string, b: string): number {
  const [x, y] = corto(pz, a, b);
  return largoTramo(pz, x, y);
}

export { longitud };
