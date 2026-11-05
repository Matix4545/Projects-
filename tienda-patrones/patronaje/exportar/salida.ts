// Convierte una pieza (geometría de trazo) en el dibujo final: línea de corte con
// márgenes, línea de costura, pinzas cerradas, piquetes, hilo y textos.
import { type Pt, angulo, areaFirmada, caja, dentro, desplazarCerrado, dir, dist, escalar, hacia, masCercano, medio, perp, resta, suma, unitario } from "../geometria.ts";
import type { Pieza } from "../pieza.ts";

export type Texto = { p: Pt; s: string; h: number; ang: number };

/** Deja el texto en caracteres que entienden Helvetica (PDF) y AutoCAD R12 (Latin-1). */
export function textoSeguro(s: string): string {
  const cambios: Record<string, string> = { "−": "-", "–": "-", "—": "-", "×": "x", "“": '"', "”": '"', "‘": "'", "’": "'", "…": "...", "≈": "~", "→": "->", "←": "<-", "≤": "<=", "≥": ">=", "½": "1/2", "¼": "1/4", "¾": "3/4" };
  return [...s]
    .map((c) => cambios[c] ?? c)
    .join("")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

export type Dibujo = {
  nombre: string;
  corte: Pt[];
  costura: Pt[];
  pinzas: Pt[][];
  taladros: Pt[];
  piquetes: [Pt, Pt][];
  lineas: { pts: Pt[]; estilo: string }[];
  hilo: [Pt, Pt] | null;
  textos: Texto[];
  botones: { p: Pt; r: number }[];
  ojales: [Pt, Pt][];
};

/** Centroide del polígono; si cae afuera, el punto interior más cercano a él. */
export function centro(poli: Pt[]): Pt {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < poli.length; i++) {
    const p = poli[i];
    const q = poli[(i + 1) % poli.length];
    const f = p.x * q.y - q.x * p.y;
    a += f;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
  }
  const c = a ? { x: cx / (3 * a), y: cy / (3 * a) } : poli[0];
  if (dentro(c, poli)) return c;
  const bb = caja(poli);
  let mejor = c;
  let md = Infinity;
  for (let i = 1; i < 20; i++)
    for (let j = 1; j < 20; j++) {
      const q = { x: bb.x0 + (bb.ancho * i) / 20, y: bb.y0 + (bb.alto * j) / 20 };
      if (!dentro(q, poli)) continue;
      const d = dist(q, c) - masCercano(poli, q).d * 0.8;
      if (d < md) {
        md = d;
        mejor = q;
      }
    }
  return mejor;
}

export function dibujar(pz: Pieza, o: { etiqueta?: string; modelo?: string } = {}): Dibujo {
  const apices = new Set(pz.pinzas.map((p) => p.apice));
  const cont = pz.contorno.filter((q) => !(q.n && apices.has(q.n)));
  const margenes = cont.map((q) => (q.d ? 0 : q.m ?? pz.margen));
  const costura = cont.map((q) => ({ x: q.x, y: q.y }));
  const corte = desplazarCerrado(costura, margenes);
  const d: Dibujo = {
    nombre: pz.nombre,
    corte,
    costura,
    pinzas: [],
    taladros: [],
    piquetes: [],
    lineas: [],
    hilo: pz.hilo,
    textos: [],
    botones: [],
    ojales: [],
  };
  const sentido = areaFirmada(costura) >= 0 ? 1 : -1;
  const normalEn = (p: Pt) => {
    const c = masCercano(costura, p);
    const a = costura[c.i];
    const b = costura[(c.i + 1) % costura.length];
    const t = dir(a, b);
    return { n: escalar({ x: t.y, y: -t.x }, sentido), m: margenes[c.i], p: c.p };
  };
  const piquete = (p: Pt, doble = false) => {
    const { n, m, p: q } = normalEn(p);
    const tang = perp(n);
    const desfases = doble ? [-0.25, 0.25] : [0];
    for (const s of desfases) {
      const base = suma(q, escalar(tang, s));
      const afuera = suma(base, escalar(n, m));
      d.piquetes.push([afuera, suma(afuera, escalar(n, -Math.min(0.7, m + 0.5)))]);
    }
  };

  for (const pin of pz.pinzas) {
    const a = pz.contorno.find((q) => q.n === pin.a);
    const b = pz.contorno.find((q) => q.n === pin.b);
    const ap = pz.contorno.find((q) => q.n === pin.apice);
    if (!a || !b || !ap) continue;
    const base = medio(a, b);
    const fin = pin.retiro ? hacia(ap, base, Math.min(pin.retiro, Math.max(0, dist(ap, base) - 0.5))) : ap;
    d.pinzas.push([a, fin, b]);
    d.taladros.push(hacia(fin, base, Math.min(1, dist(fin, base) * 0.2)));
    piquete(a);
    piquete(b);
  }
  for (const mk of pz.marcas) {
    switch (mk.t) {
      case "piquete":
        piquete(mk.p, mk.doble);
        break;
      case "taladro":
        break; // el punto de busto es referencia de trazo; no se marca en la tela
      case "linea":
        d.lineas.push({ pts: mk.pts, estilo: mk.estilo });
        break;
      case "pinzaInterna":
        d.pinzas.push(mk.pts);
        break;
      case "texto":
        d.textos.push({ p: mk.p, s: mk.s, h: mk.h ?? 1, ang: 0 });
        break;
      case "boton":
        d.botones.push({ p: mk.p, r: mk.r ?? 0.6 });
        break;
      case "ojal": {
        const u = { x: Math.cos(mk.ang), y: Math.sin(mk.ang) };
        d.ojales.push([suma(mk.p, escalar(u, -mk.l / 2)), suma(mk.p, escalar(u, mk.l / 2))]);
        break;
      }
    }
  }
  // doblez: texto a lo largo del tramo
  for (let i = 0; i < cont.length; i++) {
    if (!cont[i].d) continue;
    const a = cont[i];
    const b = cont[(i + 1) % cont.length];
    if (dist(a, b) < 6) continue;
    const t = unitario(resta(b, a));
    const n = escalar({ x: t.y, y: -t.x }, -sentido);
    const m = suma(medio(a, b), escalar(n, 1.2));
    let ang = angulo(t);
    if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI;
    d.textos.push({ p: m, s: "DOBLEZ DE TELA", h: 0.8, ang });
    d.lineas.push({ pts: [suma(a, escalar(n, 0.6)), suma(b, escalar(n, 0.6))], estilo: "doblez" });
  }
  // textos de identificación
  const c = centro(costura);
  const bb = caja(costura);
  const h = Math.max(0.7, Math.min(1.4, Math.min(bb.ancho, bb.alto) / 14));
  const lineasTxt = [o.modelo, pz.nombre.toUpperCase(), o.etiqueta ? `Talla ${o.etiqueta}` : undefined, pz.cortar].filter(Boolean) as string[];
  lineasTxt.forEach((s, k) => d.textos.push({ p: { x: c.x, y: c.y - k * h * 1.6 + (lineasTxt.length * h * 1.6) / 2 }, s, h: k === 1 ? h * 1.2 : h, ang: 0 }));
  return d;
}

/** Caja que contiene la línea de corte. */
export function cajaDibujo(d: Dibujo) {
  return caja(d.corte);
}

export { resta };
