// Vista previa en SVG (para revisar trazos y para las ilustraciones de la tienda).
import { type Pt, caja } from "../geometria.ts";
import type { Pieza } from "../pieza.ts";
import { type Dibujo, dibujar } from "./salida.ts";

const f = (n: number) => (Math.round(n * 100) / 100).toString();
const ruta = (pts: Pt[], cerrar = false) => pts.map((p, i) => `${i ? "L" : "M"}${f(p.x)} ${f(-p.y)}`).join("") + (cerrar ? "Z" : "");

export type OpcionesSvg = {
  /** Muestra textos, piquetes y línea de costura. */
  detalle?: boolean;
  separacion?: number;
  colorFondo?: string;
  anchoLinea?: number;
  maxAncho?: number;
};

/** Acomoda piezas en fila (o en varias filas) para una vista previa. */
export function acomodarVista(dibujos: Dibujo[], sep = 3, maxAncho = 160): { d: Dibujo; dx: number; dy: number }[] {
  const r: { d: Dibujo; dx: number; dy: number }[] = [];
  let x = 0;
  let yFila = 0;
  let altoFila = 0;
  for (const d of dibujos) {
    const b = caja(d.corte);
    if (x > 0 && x + b.ancho > maxAncho) {
      x = 0;
      yFila -= altoFila + sep;
      altoFila = 0;
    }
    r.push({ d, dx: x - b.x0, dy: yFila - b.y1 });
    x += b.ancho + sep;
    altoFila = Math.max(altoFila, b.alto);
  }
  return r;
}

export function svgPiezas(piezas: Pieza[], o: OpcionesSvg = {}): string {
  const detalle = o.detalle ?? true;
  const dibujos = piezas.map((p) => dibujar(p));
  const lugares = acomodarVista(dibujos, o.separacion ?? 3, o.maxAncho ?? 160);
  const todos: Pt[] = [];
  for (const { d, dx, dy } of lugares) for (const p of d.corte) todos.push({ x: p.x + dx, y: p.y + dy });
  const b = caja(todos);
  const pad = 2;
  const lw = o.anchoLinea ?? 0.18;
  const partes: string[] = [];
  for (const { d, dx, dy } of lugares) {
    const m = (p: Pt) => ({ x: p.x + dx, y: p.y + dy });
    partes.push(`<g>`);
    partes.push(`<path d="${ruta(d.corte.map(m), true)}" fill="var(--pieza-relleno, #fffdf9)" stroke="var(--pieza-linea, #2b2420)" stroke-width="${lw}" stroke-linejoin="round"/>`);
    if (detalle) partes.push(`<path d="${ruta(d.costura.map(m), true)}" fill="none" stroke="var(--pieza-costura, #9a8f86)" stroke-width="${lw * 0.6}" stroke-dasharray="0.6 0.4"/>`);
    for (const pin of d.pinzas) partes.push(`<path d="${ruta(pin.map(m))}" fill="none" stroke="var(--pieza-linea, #2b2420)" stroke-width="${lw * 0.8}"/>`);
    for (const l of d.lineas)
      partes.push(`<path d="${ruta(l.pts.map(m))}" fill="none" stroke="var(--pieza-acento, #c2552d)" stroke-width="${lw * 0.7}" ${l.estilo === "doblez" || l.estilo === "pliegue" ? 'stroke-dasharray="1.2 0.5 0.2 0.5"' : 'stroke-dasharray="0.8 0.5"'}/>`);
    if (d.hilo) {
      const [a, c] = [m(d.hilo[0]), m(d.hilo[1])];
      partes.push(`<path d="${ruta([a, c])}" stroke="var(--pieza-acento, #c2552d)" stroke-width="${lw * 0.8}" marker-start="url(#flecha)" marker-end="url(#flecha)"/>`);
    }
    if (detalle) {
      for (const [a, c] of d.piquetes) partes.push(`<path d="${ruta([m(a), m(c)])}" stroke="var(--pieza-linea, #2b2420)" stroke-width="${lw}"/>`);
      for (const t of d.taladros) partes.push(`<circle cx="${f(m(t).x)}" cy="${f(-m(t).y)}" r="0.25" fill="var(--pieza-linea, #2b2420)"/>`);
      for (const bt of d.botones) partes.push(`<circle cx="${f(m(bt.p).x)}" cy="${f(-m(bt.p).y)}" r="${bt.r}" fill="none" stroke="var(--pieza-linea, #2b2420)" stroke-width="${lw * 0.7}"/>`);
      for (const [a, c] of d.ojales) partes.push(`<path d="${ruta([m(a), m(c)])}" stroke="var(--pieza-linea, #2b2420)" stroke-width="${lw * 1.4}"/>`);
      for (const t of d.textos) {
        const p = m(t.p);
        partes.push(
          `<text x="${f(p.x)}" y="${f(-p.y)}" font-size="${f(t.h)}" text-anchor="middle" dominant-baseline="middle" fill="var(--pieza-texto, #6b5f57)" font-family="system-ui, sans-serif"${t.ang ? ` transform="rotate(${f((-t.ang * 180) / Math.PI)} ${f(p.x)} ${f(-p.y)})"` : ""}>${escapar(t.s)}</text>`,
        );
      }
    }
    partes.push(`</g>`);
  }
  const vb = `${f(b.x0 - pad)} ${f(-b.y1 - pad)} ${f(b.ancho + 2 * pad)} ${f(b.alto + 2 * pad)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img"><defs><marker id="flecha" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--pieza-acento, #c2552d)"/></marker></defs>${partes.join("")}</svg>`;
}

function escapar(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
