// Herramientas para los cortes de vestido: vestido suelto (sin pinzas de cintura),
// recorte con una recta, parte baja de paneles (princesa, sirena), vistas e igualado de costados.
import { type Pt, P, cruz, curva, dir, dist, escalar, interseccion, lerp, perp, resta, spline, suma } from "../geometria.ts";
import type { Medidas } from "../medidas.ts";
import type { Cuerpo } from "../bases/cuerpo.ts";
import { delanteroConPinza } from "../bases/cuerpo.ts";
import { vista } from "../bases/utiles.ts";
import {
  type Pieza,
  type V,
  crear,
  doblezBorde,
  hiloVertical,
  largoTramo,
  margenBorde,
  moverPunto,
  tiene,
  tramo,
  v,
} from "../pieza.ts";
import { dentro, masCercano } from "../geometria.ts";

/** Quita el doblez (el centro pasa a ser costura, p. ej. para el cierre). */
export function sinDoblez(pz: Pieza, cm = 1.5, cortar = "Cortar 2 en tela (un par)"): Pieza {
  const r = structuredClone(pz);
  for (const q of r.contorno) if (q.d) {
    q.d = false;
    q.m = cm;
  }
  r.cortar = cortar;
  return r;
}

/** Marca el cierre invisible en el centro espalda (largo desde el cuello). */
export function marcarCierre(pz: Pieza, largoCierre = 55) {
  const cc = v(pz, "centroCuello");
  const p = P(cc.x, cc.y - largoCierre);
  pz.marcas.push({ t: "piquete", p });
  pz.marcas.push({ t: "texto", p: P(cc.x + 3, p.y + 1.2), s: "fin del cierre", h: 0.7 });
}

/**
 * Vestido suelto: el costado baja recto desde abajo de la sisa (o de la pinza de costado)
 * hasta la cadera y la bastilla, sin pinzas de cintura.
 * `inicio`: punto del costado donde empieza la línea nueva (sisaBajo o la pata baja de la pinza de busto).
 */
export function suelto(
  pz: Pieza,
  m: Medidas,
  o: { inicio: string; anchoCadera: number; anchoBajo: number; largo: number; nombre?: string },
): Pieza {
  const cc = v(pz, "centroCintura");
  const kc = v(pz, "costadoCintura");
  const lado = kc.x > cc.x ? 1 : -1;
  const yW = cc.y;
  const S = v(pz, o.inicio);
  const cadera = P(cc.x + lado * o.anchoCadera, yW - m.alturaCadera);
  const bajo = P(cc.x + lado * o.anchoBajo, yW - o.largo);
  const t = (S.y - yW) / (S.y - cadera.y);
  const cintura = lerp(S, cadera, t);
  const nuevosLado: V[] = [
    { ...cintura, n: "costadoCintura" },
    { ...cadera, n: "cadera" },
    { ...bajo, n: "costadoBajo" },
  ];
  const centroBajo: V = { x: cc.x, y: yW - o.largo, n: "centroBajo" };
  const desdeCentro = tramo(pz, "centroCintura", o.inicio);
  const esDelantero = desdeCentro.some((q) => q.n === "hombro");
  const cont: V[] = esDelantero
    ? [...desdeCentro, ...nuevosLado, centroBajo]
    : [...tramo(pz, o.inicio, "centroCintura"), centroBajo, ...[...nuevosLado].reverse()];
  const nombres = new Set(cont.map((q) => q.n).filter(Boolean));
  const r = crear(o.nombre ?? pz.nombre, cont, {
    pinzas: pz.pinzas.filter((p) => nombres.has(p.a) && nombres.has(p.b) && nombres.has(p.apice)),
    marcas: pz.marcas.filter((mk) => mk.t !== "taladro"),
    hilo: pz.hilo,
    cortar: pz.cortar,
    ancla: P(cc.x, yW),
  });
  margenBorde(r, "costadoBajo", "centroBajo", 2);
  if (pz.contorno.some((q) => q.d)) doblezBorde(r, "centroBajo", "centroCintura");
  return r;
}

/**
 * Iguala el largo del costado del delantero al de la espalda (desde la sisa a la bastilla)
 * moviendo la esquina de la bastilla del delantero sobre la línea del costado.
 */
export function igualarCostados(del: Pieza, esp: Pieza, bajo = "costadoBajo", previo = "cadera"): void {
  const lf = largoTramo(del, ...ordenar(del, "sisaBajo", bajo));
  const lb = largoTramo(esp, ...ordenar(esp, "sisaBajo", bajo));
  const d = lb - lf;
  if (Math.abs(d) < 0.01 || Math.abs(d) > 4) return;
  const a = tiene(del, previo) ? v(del, previo) : v(del, "costadoCintura");
  const b = v(del, bajo);
  moverPunto(del, bajo, suma(b, escalar(dir(a, b), d)));
}

/** Ordena dos puntos para el tramo largo-de-costura que NO pasa por el centro. */
function ordenar(pz: Pieza, a: string, b: string): [string, string] {
  const t = tramo(pz, a, b);
  return t.some((q) => q.n?.startsWith("centro")) ? [b, a] : [a, b];
}

/**
 * Recorta la pieza con la recta a→b. Se queda con la parte a la izquierda (o derecha) de la recta.
 * Los puntos nuevos sobre la recta se llaman corte1, corte2… en el orden del contorno.
 */
export function recortar(pz: Pieza, a: Pt, b: Pt, izquierda: boolean, nombre = pz.nombre): Pieza {
  const c = pz.contorno;
  const n = c.length;
  const lado = (p: Pt) => cruz(resta(b, a), resta(p, a));
  const dentroDe = (p: Pt) => (izquierda ? lado(p) >= -1e-9 : lado(p) <= 1e-9);
  const out: V[] = [];
  let k = 0;
  for (let i = 0; i < n; i++) {
    const prev = c[(i - 1 + n) % n];
    const cur = c[i];
    const pi = dentroDe(prev);
    const ci = dentroDe(cur);
    if (ci) {
      if (!pi) {
        const x = interseccion(prev, cur, a, b)!;
        out.push({ ...x, n: `corte${++k}`, m: prev.m, d: prev.d });
      }
      out.push({ ...cur });
    } else if (pi) {
      const x = interseccion(prev, cur, a, b)!;
      out.push({ ...x, n: `corte${++k}`, m: pz.margen, d: false });
    }
  }
  const nombres = new Set(out.map((q) => q.n).filter(Boolean));
  const r = crear(nombre, out, {
    pinzas: pz.pinzas.filter((p) => nombres.has(p.a) && nombres.has(p.b) && nombres.has(p.apice)),
    marcas: pz.marcas.filter((mk) => {
      const ref = "pts" in mk ? mk.pts[Math.floor(mk.pts.length / 2)] : "p" in mk ? mk.p : null;
      return ref ? dentro(ref, out) || masCercano(out, ref).d < 0.05 : false;
    }),
    hilo: pz.hilo,
    cortar: pz.cortar,
    ancla: pz.ancla,
    margen: pz.margen,
  });
  if (r.hilo && !dentro(lerp(r.hilo[0], r.hilo[1], 0.5), r.contorno)) r.hilo = hiloVertical(r);
  return r;
}

/** Renombra el vértice más cercano a `p`. */
export function nombrarCerca(pz: Pieza, p: Pt, n: string) {
  let mejor = 0;
  let d = Infinity;
  pz.contorno.forEach((q, i) => {
    const dd = dist(q, p);
    if (dd < d) {
      d = dd;
      mejor = i;
    }
  });
  pz.contorno[mejor].n = n;
}

// ── Parte baja de paneles ───────────────────────────────────────────────────

export type LadoPanel = {
  /** Punto de la cintura (vértice con nombre del cuerpo). */
  arriba: V;
  /** Dirección con la que la costura llega a la cintura desde arriba (apuntando hacia abajo). */
  tan: Pt;
  /** Puntos de la costura de la cadera hacia abajo (el último es la bastilla). */
  perfil: Pt[];
  /** Nombres para cada punto del perfil. */
  nombres: string[];
};

function bajada(l: LadoPanel, suave: boolean): V[] {
  const p0 = l.perfil[0];
  const sig = l.perfil[1] ?? P(p0.x, p0.y - 1);
  const recto = Math.abs(l.arriba.x - p0.x) < 0.01 && Math.abs(l.tan.x) < 1e-6;
  const tramoCurva = recto ? [l.arriba, p0] : curva(l.arriba, l.tan, p0, dir(p0, sig), 0.4, 0.45, 16);
  let resto: Pt[] = l.perfil;
  if (suave && l.perfil.length >= 3) {
    resto = spline(l.perfil, 10);
  }
  const pts: V[] = [{ ...l.arriba }, ...tramoCurva.slice(1, -1).map((p) => ({ x: p.x, y: p.y }))];
  // perfil con nombres en sus puntos de control
  let iNombre = 0;
  for (const p of resto) {
    const ctrl = l.perfil.findIndex((q) => dist(q, p) < 1e-6);
    pts.push(ctrl >= 0 ? { x: p.x, y: p.y, n: l.nombres[ctrl] } : { x: p.x, y: p.y });
    if (ctrl >= 0) iNombre++;
  }
  return pts;
}

/**
 * Parte de abajo de un panel en sentido antihorario: baja por el lado izquierdo,
 * cruza la bastilla y sube por el lado derecho (incluye los dos puntos de cintura).
 */
export function parteBaja(izq: LadoPanel, der: LadoPanel, o: { suave?: boolean } = {}): V[] {
  const a = bajada(izq, !!o.suave);
  const b = bajada(der, !!o.suave);
  const fa = a[a.length - 1];
  const fb = b[b.length - 1];
  const da = dir(a[a.length - 2], fa);
  const db = dir(b[b.length - 2], fb);
  const bastilla = curva(fa, perp(da), fb, perp(db), 0.3, 0.3, 16);
  return [...a, ...bastilla.slice(1, -1).map((p) => ({ x: p.x, y: p.y })), ...[...b].reverse()];
}

// ── Vistas para vestidos sin manga ──────────────────────────────────────────

/** Vistas de escote y sisa (delantero y espalda) a partir del cuerpo base. */
export function vistasSinManga(c: Cuerpo, o: { espaldaAlDoblez: boolean }): Pieza[] {
  const del = delanteroConPinza(c, "costado");
  const esp = c.espalda;
  const ve = vista(del, "centroCuello", "cuelloHombro", 5, "Vista escote delantero", "Cortar 1 al doblez en tela y entretela");
  doblezBorde(ve, "inicio", "inicioInterior");
  const vee = vista(esp, "cuelloHombro", "centroCuello", 5, "Vista escote espalda", o.espaldaAlDoblez ? "Cortar 1 al doblez en tela y entretela" : "Cortar 2 en tela y 2 en entretela");
  if (o.espaldaAlDoblez) doblezBorde(vee, "fin", "finInterior");
  else margenBorde(vee, "fin", "finInterior", 1.5);
  const vs = vista(del, "hombro", "sisaBajo", 4, "Vista sisa delantera");
  const vse = vista(esp, "sisaBajo", "hombro", 4, "Vista sisa espalda");
  return [ve, vee, vs, vse];
}

/** Hilo vertical en x, entre dos alturas. */
export function hiloEn(x: number, y0: number, y1: number): [Pt, Pt] {
  return [P(x, y0), P(x, y1)];
}

export { suma, escalar, lerp };
