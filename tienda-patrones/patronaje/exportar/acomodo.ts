// Acomodo de piezas en el pliego. Cada pieza se dibuja con todas sus tallas
// anidadas (alineadas en su punto ancla), como en los patrones comerciales.
import { type Pt, caja } from "../geometria.ts";
import type { Pieza } from "../pieza.ts";
import { type Dibujo, centro, dibujar } from "./salida.ts";

export type TallaPiezas = { talla: string; piezas: Pieza[] };

export type Grupo = {
  indice: number;
  nombre: string;
  /** Dibujo de cada talla, ya movido a su lugar en el pliego. */
  porTalla: { talla: string; d: Dibujo }[];
};

export type Pliego = { ancho: number; alto: number; grupos: Grupo[]; tallas: string[] };

function moverDibujo(d: Dibujo, dx: number, dy: number): Dibujo {
  const m = (p: Pt) => ({ x: p.x + dx, y: p.y + dy });
  return {
    ...d,
    corte: d.corte.map(m),
    costura: d.costura.map(m),
    pinzas: d.pinzas.map((q) => q.map(m)),
    taladros: d.taladros.map(m),
    piquetes: d.piquetes.map(([a, b]) => [m(a), m(b)] as [Pt, Pt]),
    lineas: d.lineas.map((l) => ({ ...l, pts: l.pts.map(m) })),
    hilo: d.hilo ? [m(d.hilo[0]), m(d.hilo[1])] : null,
    textos: d.textos.map((t) => ({ ...t, p: m(t.p) })),
    botones: d.botones.map((b) => ({ ...b, p: m(b.p) })),
    ojales: d.ojales.map(([a, b]) => [m(a), m(b)] as [Pt, Pt]),
  };
}

/**
 * Acomoda los grupos de piezas en filas dentro de un pliego de `ancho` cm
 * (91.4 cm = rollo de plotter de 36"). Si una pieza no cabe, el pliego se ensancha.
 */
export function acomodar(modelo: string, tallas: TallaPiezas[], ancho = 91.4, sep = 2.5, margen = 1.5): Pliego {
  const nPiezas = tallas[0].piezas.length;
  const referencia = tallas[Math.floor(tallas.length / 2)];
  const grupos: Grupo[] = [];
  const cajas: ReturnType<typeof caja>[] = [];
  for (let i = 0; i < nPiezas; i++) {
    const base = referencia.piezas[i];
    const anclaBase = base.ancla ?? centro(base.contorno);
    const porTalla = tallas.map(({ talla, piezas }) => {
      const pz = piezas[i];
      const a = pz.ancla ?? centro(pz.contorno);
      const d = dibujar(pz, { etiqueta: tallas.length > 1 ? undefined : talla, modelo });
      return { talla, d: moverDibujo(d, anclaBase.x - a.x, anclaBase.y - a.y) };
    });
    grupos.push({ indice: i, nombre: base.nombre, porTalla });
    cajas.push(caja(porTalla.flatMap((t) => t.d.corte)));
  }
  // filas (de arriba hacia abajo), piezas más altas primero
  const orden = grupos.map((_, i) => i).sort((a, b) => cajas[b].alto - cajas[a].alto);
  const anchoUtil = Math.max(ancho - 2 * margen, ...cajas.map((c) => c.ancho));
  let x = 0;
  let y = 0;
  let altoFila = 0;
  const lugar: { dx: number; dy: number }[] = [];
  for (const i of orden) {
    const c = cajas[i];
    if (x > 0 && x + c.ancho > anchoUtil) {
      x = 0;
      y -= altoFila + sep;
      altoFila = 0;
    }
    lugar[i] = { dx: margen + x - c.x0, dy: -margen + y - c.y1 };
    x += c.ancho + sep;
    altoFila = Math.max(altoFila, c.alto);
  }
  const alto = -y + altoFila + 2 * margen;
  // coordenadas finales con el origen abajo a la izquierda
  const final = grupos.map((g, i) => ({
    ...g,
    porTalla: g.porTalla.map((t) => ({ ...t, d: moverDibujo(t.d, lugar[i].dx, lugar[i].dy + alto) })),
  }));
  return { ancho: anchoUtil + 2 * margen, alto, grupos: final, tallas: tallas.map((t) => t.talla) };
}
