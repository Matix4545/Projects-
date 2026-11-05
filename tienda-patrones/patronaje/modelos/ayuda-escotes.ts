// Herramientas para escotes y cuellos: abrir y bajar el escote, vistas recortadas,
// cruce de botones, aberturas y medidas del escote.
import { type Pt, P, cruceSegmentos, curva, dir, dist, enLongitud, escalar, interseccion, longitud, perp, remuestrear, resta, suma, unitario } from "../geometria.ts";
import type { Medidas } from "../medidas.ts";
import { type Pieza, type V, corto, crear, idx, indicesTramo, largoTramo, margen, orientar, piquete, reemplazar, tiene, tramo, tramoSinPinzas, trasladarPinza, v } from "../pieza.ts";

/** Quita de la lista las pinzas cuyos puntos ya no existen (el escote nuevo las recortó). */
export function limpiarPinzas(pz: Pieza): Pieza {
  pz.pinzas = pz.pinzas.filter((p) => tiene(pz, p.a) && tiene(pz, p.b) && tiene(pz, p.apice));
  return pz;
}

/** Dirección del hombro, del cuello hacia la punta del hombro. */
export function dirHombro(pz: Pieza): Pt {
  return dir(v(pz, "cuelloHombro"), v(pz, "hombro"));
}

/** Perpendicular al hombro que apunta hacia abajo (hacia el cuerpo). */
export function perpHombroAbajo(pz: Pieza): Pt {
  const d = perp(dirHombro(pz));
  return d.y < 0 ? d : escalar(d, -1);
}

/** Punto sobre el hombro a `w` cm del cuello (medido hacia la punta del hombro). */
export function enHombro(pz: Pieza, w: number): Pt {
  const [a, b] = corto(pz, "cuelloHombro", "hombro");
  let t = tramoSinPinzas(pz, a, b) as Pt[];
  if (a !== "cuelloHombro") t = [...t].reverse();
  return enLongitud(t, w).p;
}

/** Largo del escote (cosido) entre el cuello del hombro y el centro. */
export function largoEscote(pz: Pieza): number {
  const [a, b] = corto(pz, "cuelloHombro", "centroCuello");
  return largoTramo(pz, a, b);
}

/** Largo del hombro (cosido, sin pinzas). */
export function largoHombro(pz: Pieza): number {
  const [a, b] = corto(pz, "cuelloHombro", "hombro");
  return largoTramo(pz, a, b);
}

/**
 * Pasa la pinza de hombro de la espalda a la sisa (pinza de sisa), para poder abrir
 * mucho el escote sin cortar la pinza. El largo del hombro no cambia.
 */
export function pinzaEspaldaASisa(espalda: Pieza): Pieza {
  if (!espalda.pinzas.some((p) => p.apice === "pinzaHombro")) return espalda;
  if (!tiene(espalda, "sisaMedio")) return espalda;
  return trasladarPinza(espalda, "pinzaHombro", "sisaMedio", { nombre: "pinzaSisa", retiro: 1 });
}

/**
 * Cambia el escote. `curvaEscote(C, S)` recibe el punto nuevo del centro (C) y el
 * punto nuevo en el hombro (S) y devuelve la línea del escote de C a S.
 * `abrir`: cuánto se abre en el hombro (cm); `bajar`: cuánto baja el centro (negativo = sube).
 */
export function cambiarEscote(
  pz: Pieza,
  abrir: number,
  bajar: number,
  curvaEscote: (C: Pt, S: Pt, abajo: Pt) => Pt[],
): Pieza {
  const S = enHombro(pz, abrir);
  const c0 = v(pz, "centroCuello");
  const C = P(c0.x, c0.y - bajar);
  const linea = curvaEscote(C, S, perpHombroAbajo(pz));
  const [a, b] = corto(pz, "centroCuello", "cuelloHombro");
  if (a === "centroCuello") reemplazar(pz, a, b, linea);
  else reemplazar(pz, a, b, [...linea].reverse());
  return limpiarPinzas(pz);
}

/** Escote curvo: perpendicular al centro y al hombro. `lleno` (0–1) controla la redondez. */
export function curvaRedonda(lleno = 0.55, llenoHombro = 0.45) {
  return (C: Pt, S: Pt, abajo: Pt): Pt[] => {
    const haciaLado = P(Math.sign(S.x - C.x) || 1, 0);
    // llega al hombro subiendo: dirección contraria a "abajo"
    return curva(C, haciaLado, S, escalar(abajo, -1), lleno, llenoHombro, 30);
  };
}

/** Escote en V: casi recto, y en los últimos cm se endereza para llegar a 90° al hombro. */
export function curvaV(final = 0.15) {
  return (C: Pt, S: Pt, abajo: Pt): Pt[] => curva(C, dir(C, S), S, escalar(abajo, -1), 0.6, final, 30);
}

/**
 * Escote cuadrado: horizontal desde el centro, esquina redondeada y lado casi
 * vertical que sube al hombro.
 */
export function curvaCuadrada(radio = 1.5) {
  return (C: Pt, S: Pt, abajo: Pt): Pt[] => {
    const lado = Math.sign(S.x - C.x) || 1;
    const esquina = P(S.x - lado * 0.6, C.y);
    const r = Math.min(radio, Math.abs(esquina.x - C.x) / 2);
    const a = P(esquina.x - lado * r, C.y);
    const b = P(esquina.x, C.y + r);
    const arriba = P(S.x - lado * 0.3, S.y - 2.5);
    return [
      C,
      a,
      ...curva(a, P(lado, 0), b, P(0, 1), 0.55, 0.55, 8).slice(1, -1),
      b,
      arriba,
      ...curva(arriba, dir(b, arriba), S, escalar(abajo, -1), 0.3, 0.3, 8).slice(1),
    ];
  };
}

/**
 * Vista que copia un tramo del contorno con el ancho dado y la recorta contra
 * dos líneas (por ejemplo el centro y el hombro), para que sus extremos caigan
 * justo sobre esas costuras.
 */
export function vistaRecortada(
  pz: Pieza,
  desde: string,
  hasta: string,
  ancho: number,
  nombre: string,
  lineaIni: [Pt, Pt] | null,
  lineaFin: [Pt, Pt] | null,
  cortar = "Cortar 2 en tela y 2 en entretela",
): Pieza {
  const t = remuestrear(tramoSinPinzas(pz, desde, hasta), 0.5);
  let off = desplazarLimpia(t, ancho);
  if (off.length < 2) throw new Error(`No se pudo trazar la vista "${nombre}"`);
  const recortar = (pts: Pt[], linea: [Pt, Pt] | null, alInicio: boolean): Pt[] => {
    if (!linea) return pts;
    const arr = alInicio ? pts : [...pts].reverse();
    // busca el primer tramo que cruza la línea
    for (let k = 0; k < arr.length - 1; k++) {
      const L1 = suma(linea[0], escalar(dir(linea[0], linea[1]), -500));
      const L2 = suma(linea[0], escalar(dir(linea[0], linea[1]), 500));
      const c = cruceSegmentos(arr[k], arr[k + 1], L1, L2);
      if (c) {
        const r = [c.p, ...arr.slice(k + 1)];
        return alInicio ? r : r.reverse();
      }
    }
    // no cruza: prolonga el primer tramo hasta la línea, o proyecta si queda lejos
    let q = interseccion(arr[0], arr[1], linea[0], linea[1]);
    if (!q || dist(q, arr[0]) > ancho * 1.5) {
      const d = dir(linea[0], linea[1]);
      const w = resta(arr[0], linea[0]);
      q = suma(linea[0], escalar(d, w.x * d.x + w.y * d.y));
    }
    const r = [q, ...arr];
    return alInicio ? r : r.reverse();
  };
  off = recortar(off, lineaIni, true);
  off = recortar(off, lineaFin, false);
  const cont: V[] = [
    ...t.map((p, k) => ({ x: p.x, y: p.y, n: k === 0 ? "inicio" : k === t.length - 1 ? "fin" : undefined })),
    ...[...off].reverse().map((p, k, arr) => ({ x: p.x, y: p.y, n: k === 0 ? "finInterior" : k === arr.length - 1 ? "inicioInterior" : undefined })),
  ];
  const r = crear(nombre, cont, { cortar });
  const medio = t[Math.floor(t.length / 2)];
  const k0 = Math.max(0, Math.floor(t.length / 2) - 1);
  const k1 = Math.min(t.length - 1, Math.floor(t.length / 2) + 1);
  const nrm = perp(dir(t[k0], t[k1]));
  r.hilo = [suma(medio, escalar(nrm, ancho * 0.3)), suma(medio, escalar(nrm, ancho * 0.7))];
  return r;
}

/**
 * Desplaza una polilínea abierta `d` cm a su izquierda con esquinas a inglete y
 * quita los bucles que se forman en esquinas cerradas (como en una vista de escote).
 */
export function desplazarLimpia(t: Pt[], d: number): Pt[] {
  const n = t.length;
  const nrm = (a: Pt, b: Pt) => perp(dir(a, b));
  const r: Pt[] = [];
  for (let k = 0; k < n; k++) {
    if (k === 0) {
      r.push(suma(t[0], escalar(nrm(t[0], t[1]), d)));
      continue;
    }
    if (k === n - 1) {
      r.push(suma(t[k], escalar(nrm(t[k - 1], t[k]), d)));
      continue;
    }
    const n1 = nrm(t[k - 1], t[k]);
    const n2 = nrm(t[k], t[k + 1]);
    const a1 = suma(t[k - 1], escalar(n1, d));
    const a2 = suma(t[k], escalar(n1, d));
    const b1 = suma(t[k], escalar(n2, d));
    const b2 = suma(t[k + 1], escalar(n2, d));
    const q = Math.abs(n1.x * n2.y - n1.y * n2.x) < 1e-3 ? null : interseccion(a1, a2, b1, b2);
    r.push(q && dist(q, t[k]) < 3 * d ? q : suma(t[k], escalar(unitario(suma(n1, n2)), d)));
  }
  return quitarBucles(r).filter((q) => t.every((p) => dist(p, q) > d * 0.9));
}

/** Quita bucles de una polilínea: si dos tramos no vecinos se cruzan, recorta lo de en medio. */
export function quitarBucles(pts: Pt[]): Pt[] {
  let r = pts.slice();
  for (let guard = 0; guard < 50; guard++) {
    let hecho = false;
    buscar: for (let i = 0; i < r.length - 3; i++) {
      for (let j = r.length - 2; j > i + 1; j--) {
        const c = cruceSegmentos(r[i], r[i + 1], r[j], r[j + 1]);
        if (c && c.t > 1e-6 && c.t < 1 - 1e-6) {
          r = [...r.slice(0, i + 1), c.p, ...r.slice(j + 1)];
          hecho = true;
          break buscar;
        }
      }
    }
    if (!hecho) break;
  }
  return r;
}

/**
 * Baja el extremo superior de las pinzas (de pez o en V) para que terminen al menos
 * `holgura` cm abajo del borde superior de la pieza (escotes muy bajos, halter, strapless).
 */
export function pinzasBajoBorde(pz: Pieza, holgura = 3) {
  const cont = pz.contorno;
  const bordeArriba = (x: number, yDesde: number, excluir?: string): number | null => {
    let mejor: number | null = null;
    for (let i = 0; i < cont.length; i++) {
      const a = cont[i];
      const b = cont[(i + 1) % cont.length];
      if (excluir && (a.n === excluir || b.n === excluir)) continue;
      if ((a.x - x) * (b.x - x) > 0 || a.x === b.x) continue;
      const y = a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
      if (y > yDesde && (mejor === null || y < mejor)) mejor = y;
    }
    return mejor;
  };
  for (const mk of pz.marcas) {
    if (mk.t !== "pinzaInterna" || mk.pts.length < 4) continue;
    const base = mk.pts[0];
    const fin = mk.pts[1];
    const tope = bordeArriba(fin.x, base.y + 0.5);
    if (tope !== null && fin.y > tope - holgura) mk.pts[1] = { x: fin.x, y: Math.max(base.y + 3, tope - holgura) };
  }
  // pinzas en V cuyo ápice quedó cerca o fuera del borde: se baja el ápice
  for (const pin of pz.pinzas) {
    const ap = pz.contorno.find((q) => q.n === pin.apice);
    const a = pz.contorno.find((q) => q.n === pin.a);
    if (!ap || !a || ap.y < a.y) continue; // sólo pinzas que suben desde abajo
    const tope = bordeArriba(ap.x, a.y + 0.5, pin.apice);
    const enCruce = tope === null || ap.y > tope - holgura;
    if (enCruce && tope !== null) ap.y = Math.max(a.y + 3, tope - holgura);
  }
}

/** Recta del centro (de la pieza), para recortar vistas. */
export function lineaCentro(pz: Pieza): [Pt, Pt] {
  const c = v(pz, "centroCuello");
  return [c, P(c.x, c.y - 10)];
}

/** Recta del hombro, para recortar vistas. */
export function lineaHombro(pz: Pieza): [Pt, Pt] {
  return [v(pz, "cuelloHombro"), v(pz, "hombro")];
}

/** Vista de escote estándar (delantero o espalda) al doblez del centro. */
export function vistaEscote(pz: Pieza, nombre: string, ancho = 6): Pieza {
  const [a, b] = corto(pz, "centroCuello", "cuelloHombro");
  const delCentro = a === "centroCuello";
  const vi = vistaRecortada(pz, a, b, ancho, nombre, delCentro ? lineaCentro(pz) : lineaHombro(pz), delCentro ? lineaHombro(pz) : lineaCentro(pz), "Cortar 1 al doblez en tela y 1 en entretela");
  // el extremo sobre el centro va al doblez
  doblezExtremo(vi, delCentro ? "inicio" : "fin");
  return vi;
}

/** Marca como doblez el lado corto de la vista que toca el centro. */
export function doblezExtremo(vi: Pieza, extremo: "inicio" | "fin") {
  const interior = extremo === "inicio" ? "inicioInterior" : "finInterior";
  const [a, b] = corto(vi, extremo, interior);
  for (const k of indicesTramo(vi, a, b).slice(0, -1)) {
    vi.contorno[k].d = true;
    vi.contorno[k].m = 0;
  }
}

/** Abertura en el centro espalda (pieza al doblez): corte marcado, botón y presilla. */
export function aberturaEspalda(espalda: Pieza, largo = 12) {
  const c = v(espalda, "centroCuello");
  espalda.marcas.push({ t: "linea", pts: [c, P(c.x, c.y - largo)], estilo: "colocacion" });
  espalda.marcas.push({ t: "texto", p: P(c.x + 2.2, c.y - largo / 2), s: `abertura ${largo} cm`, h: 0.7 });
  espalda.marcas.push({ t: "boton", p: P(c.x + 1.2, c.y - 1.2), r: 0.5 });
}

/** Largo total del escote (delantero + espalda, ambos lados). */
export function escoteTotal(delantero: Pieza, espalda: Pieza): number {
  return 2 * (largoEscote(delantero) + largoEscote(espalda));
}

/** Un escote necesita abertura si no pasa la cabeza (60 cm en tela plana). */
export function necesitaAbertura(delantero: Pieza, espalda: Pieza) {
  return escoteTotal(delantero, espalda) < 60;
}

/**
 * Delantero que abre al centro con cruce de botones: el borde se mueve `cruce` cm
 * más allá del centro delantero (que queda marcado). El escote sigue recto por el cruce.
 */
export function delanteroConCruce(pz: Pieza, cruce = 1.75): Pieza {
  const r: Pieza = structuredClone(pz);
  const cb = v(r, "centroBajo");
  const cc = v(r, "centroCuello");
  const lado = Math.sign(v(r, "hombro").x - cc.x) || -1; // hacia el costado
  const fuera = -lado; // hacia el borde delantero
  const frenteBajo: V = { x: cb.x + fuera * cruce, y: cb.y, n: "frenteBajo", m: 1 };
  const frenteCuello: V = { x: cc.x + fuera * cruce, y: cc.y, n: "frenteCuello", m: 1 };
  const [a, b] = corto(r, "centroBajo", "centroCuello");
  const ia = idx(r, a);
  const ib = idx(r, b);
  const interior = a === "centroBajo" ? [frenteBajo, frenteCuello] : [frenteCuello, frenteBajo];
  // quita lo que hubiera entre ambos (el centro al doblez) e inserta el borde con cruce
  const n = r.contorno.length;
  const nuevo: V[] = [];
  for (let k = 0; k < n; k++) {
    const q = r.contorno[k];
    const entre = ia < ib ? k > ia && k < ib : k > ia || k < ib;
    if (entre) continue;
    nuevo.push(q);
    if (k === ia) nuevo.push(...interior.map((p) => ({ ...p })));
  }
  r.contorno = nuevo.map((q) => (q.n === a ? { ...q, d: false, m: q.n === "centroBajo" ? 2 : 1 } : { ...q }));
  // el tramo del cruce en la bastilla lleva el margen de la bastilla
  const [h1] = corto(r, "centroBajo", "frenteBajo");
  margen(r, h1, h1 === "centroBajo" ? "frenteBajo" : "centroBajo", 2);
  const [n1] = corto(r, "frenteCuello", "centroCuello");
  margen(r, n1, n1 === "frenteCuello" ? "centroCuello" : "frenteCuello", 1);
  margen(r, ...corto(r, "frenteBajo", "frenteCuello"), 1);
  for (const q of r.contorno) if (q.d) q.d = false;
  r.marcas.push({ t: "linea", pts: [P(cc.x, cb.y), P(cc.x, cc.y)], estilo: "colocacion" });
  r.marcas.push({ t: "texto", p: P(cc.x + lado * 1.4, (cb.y + cc.y) / 2), s: "centro delantero", h: 0.6 });
  r.cortar = "Cortar 2 en tela (un par)";
  return orientar(r);
}

/** Botones y ojales horizontales sobre el centro delantero. */
export function botones(pz: Pieza, desdeArriba: number, cuantos: number, sep: number, boton = 1.2) {
  const cc = v(pz, "centroCuello");
  const lado = Math.sign(v(pz, "hombro").x - cc.x) || -1;
  const fuera = -lado;
  const largoOjal = boton + 0.3;
  for (let k = 0; k < cuantos; k++) {
    const y = cc.y - desdeArriba - k * sep;
    pz.marcas.push({ t: "boton", p: P(cc.x, y), r: boton / 2 });
    pz.marcas.push({ t: "ojal", p: P(cc.x + fuera * 0.3 - fuera * (largoOjal / 2), y), ang: 0, l: largoOjal });
  }
}

/** Botones repartidos desde `desdeArriba` hasta 10 cm de la bastilla. */
export function botonesRepartidos(pz: Pieza, desdeArriba: number, sepMax = 9.5) {
  const cc = v(pz, "centroCuello");
  const cb = v(pz, "centroBajo");
  const largo = cc.y - cb.y - desdeArriba - 10;
  const n = Math.max(2, Math.round(largo / sepMax) + 1);
  botones(pz, desdeArriba, n, largo / (n - 1));
}

/** Vista delantera para prendas con botones: borde delantero, escote y hasta el hombro. */
export function vistaDelantera(pz: Pieza, ancho = 7): Pieza {
  const [a, b] = corto(pz, "frenteBajo", "cuelloHombro");
  const bajo = v(pz, "frenteBajo");
  const lineaBajo: [Pt, Pt] = [bajo, P(bajo.x + 10, bajo.y)];
  const vi = vistaRecortada(pz, a, b, ancho, "Vista delantera", a === "frenteBajo" ? lineaBajo : lineaHombro(pz), a === "frenteBajo" ? lineaHombro(pz) : lineaBajo, "Cortar 2 en tela (un par) y 2 en entretela");
  const [x, y] = corto(vi, a === "frenteBajo" ? "inicio" : "fin", a === "frenteBajo" ? "inicioInterior" : "finInterior");
  margen(vi, x, y, 2);
  return vi;
}

/** Piquetes de escote: centro, cuello del hombro (y frente del cruce si existe). */
export function piquetesEscote(pz: Pieza) {
  piquete(pz, "cuelloHombro");
  if (tiene(pz, "frenteCuello")) piquete(pz, "centroCuello");
}

/** Recorre una polilínea y regresa el punto a `l` cm. */
export function enPolilinea(pts: Pt[], l: number): Pt {
  return enLongitud(pts, l).p;
}

/** Desplaza una polilínea abierta a la izquierda (según su sentido) `d` cm. */
export function desplazarAbierta(pts: Pt[], d: number | ((k: number, n: number) => number)): Pt[] {
  return pts.map((p, k) => {
    const a = pts[Math.max(0, k - 1)];
    const b = pts[Math.min(pts.length - 1, k + 1)];
    const dd = typeof d === "number" ? d : d(k, pts.length);
    return suma(p, escalar(perp(dir(a, b)), dd));
  });
}

/** Escote (lado del cuerpo) como polilínea del centro al cuello del hombro. */
export function lineaEscote(pz: Pieza): Pt[] {
  const [a, b] = corto(pz, "centroCuello", "cuelloHombro");
  const t = tramo(pz, a, b).map((q) => ({ x: q.x, y: q.y }));
  return a === "centroCuello" ? t : t.reverse();
}

export { longitud, unitario, P };
export type { Medidas };
