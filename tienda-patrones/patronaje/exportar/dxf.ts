// DXF (AutoCAD R12, ASCII) en milímetros, escala 1:1.
// Capas: una por talla (TALLA-XS, TALLA-S, …) con línea de corte, pinzas, piquetes y
// líneas internas; INFO con nombres, hilo y textos. Con una sola talla también se
// dibuja la línea de costura (capa COSTURA, punteada).
import type { Pt } from "../geometria.ts";
import type { Pliego } from "./acomodo.ts";
import { textoSeguro } from "./salida.ts";

const MM = 10;
// colores de AutoCAD (ACI) por talla, en orden
const COLORES = [1, 30, 2, 3, 4, 5, 6, 8, 140, 200];

function n(v: number) {
  return (Math.round(v * MM * 1000) / 1000).toString();
}

class Escritor {
  partes: string[] = [];
  par(c: number, v: string | number) {
    this.partes.push(String(c), String(v));
  }
  linea(capa: string, a: Pt, b: Pt, tipo?: string) {
    this.par(0, "LINE");
    this.par(8, capa);
    if (tipo) this.par(6, tipo);
    this.par(10, n(a.x)); this.par(20, n(a.y)); this.par(30, 0);
    this.par(11, n(b.x)); this.par(21, n(b.y)); this.par(31, 0);
  }
  polilinea(capa: string, pts: Pt[], cerrada: boolean, tipo?: string) {
    if (pts.length < 2) return;
    this.par(0, "POLYLINE");
    this.par(8, capa);
    if (tipo) this.par(6, tipo);
    this.par(66, 1);
    this.par(10, 0); this.par(20, 0); this.par(30, 0);
    this.par(70, cerrada ? 1 : 0);
    for (const p of pts) {
      this.par(0, "VERTEX");
      this.par(8, capa);
      this.par(10, n(p.x)); this.par(20, n(p.y)); this.par(30, 0);
    }
    this.par(0, "SEQEND");
    this.par(8, capa);
  }
  circulo(capa: string, c: Pt, r: number) {
    this.par(0, "CIRCLE");
    this.par(8, capa);
    this.par(10, n(c.x)); this.par(20, n(c.y)); this.par(30, 0);
    this.par(40, n(r));
  }
  texto(capa: string, p: Pt, h: number, s: string, ang = 0) {
    this.par(0, "TEXT");
    this.par(8, capa);
    this.par(10, n(p.x)); this.par(20, n(p.y)); this.par(30, 0);
    this.par(40, n(h));
    this.par(1, textoSeguro(s));
    if (ang) this.par(50, ((ang * 180) / Math.PI).toFixed(3));
    this.par(72, 1); // centrado
    this.par(11, n(p.x)); this.par(21, n(p.y)); this.par(31, 0);
  }
}

export function dxf(pliego: Pliego, modelo: string): Buffer {
  const w = new Escritor();
  const capas = pliego.tallas.map((t, i) => ({ nombre: `TALLA-${t.replace(/\s+/g, "_").toUpperCase()}`, color: COLORES[i % COLORES.length] }));
  const una = pliego.tallas.length === 1;
  // ── encabezado ──
  w.par(0, "SECTION"); w.par(2, "HEADER");
  w.par(9, "$ACADVER"); w.par(1, "AC1009");
  w.par(9, "$DWGCODEPAGE"); w.par(3, "ANSI_1252");
  w.par(9, "$EXTMIN"); w.par(10, 0); w.par(20, 0); w.par(30, 0);
  w.par(9, "$EXTMAX"); w.par(10, n(pliego.ancho)); w.par(20, n(pliego.alto)); w.par(30, 0);
  w.par(9, "$LTSCALE"); w.par(40, 1);
  w.par(0, "ENDSEC");
  // ── tablas: tipos de línea y capas ──
  w.par(0, "SECTION"); w.par(2, "TABLES");
  w.par(0, "TABLE"); w.par(2, "LTYPE"); w.par(70, 2);
  w.par(0, "LTYPE"); w.par(2, "CONTINUOUS"); w.par(70, 0); w.par(3, "Solid line"); w.par(72, 65); w.par(73, 0); w.par(40, 0);
  w.par(0, "LTYPE"); w.par(2, "DASHED"); w.par(70, 0); w.par(3, "Dashed __ __ __"); w.par(72, 65); w.par(73, 2); w.par(40, 9); w.par(49, 6); w.par(49, -3);
  w.par(0, "ENDTAB");
  const todas = [...capas, { nombre: "INFO", color: 7 }, ...(una ? [{ nombre: "COSTURA", color: 8 }] : [])];
  w.par(0, "TABLE"); w.par(2, "LAYER"); w.par(70, todas.length);
  for (const c of todas) {
    w.par(0, "LAYER"); w.par(2, c.nombre); w.par(70, 0); w.par(62, c.color); w.par(6, "CONTINUOUS");
  }
  w.par(0, "ENDTAB");
  w.par(0, "ENDSEC");
  // ── entidades ──
  w.par(0, "SECTION"); w.par(2, "ENTITIES");
  const iRef = Math.floor(pliego.tallas.length / 2);
  for (const g of pliego.grupos) {
    g.porTalla.forEach(({ d }, i) => {
      const capa = capas[i].nombre;
      w.polilinea(capa, d.corte, true);
      if (una) w.polilinea("COSTURA", d.costura, true, "DASHED");
      for (const p of d.pinzas) w.polilinea(capa, p, false);
      for (const [a, b] of d.piquetes) w.linea(capa, a, b);
      for (const t of d.taladros) w.circulo(capa, t, 0.2);
      for (const l of d.lineas) w.polilinea(capa, l.pts, false, l.estilo === "doblez" || l.estilo === "pliegue" || l.estilo === "guia" ? "DASHED" : undefined);
      for (const b of d.botones) w.circulo(capa, b.p, b.r);
      for (const [a, b] of d.ojales) w.linea(capa, a, b);
      if (i === iRef) {
        if (d.hilo) {
          const [a, b] = d.hilo;
          w.linea("INFO", a, b);
          // puntas de flecha
          for (const [p, q] of [[a, b], [b, a]] as [Pt, Pt][]) {
            const dx = q.x - p.x, dy = q.y - p.y;
            const l = Math.hypot(dx, dy) || 1;
            const ux = dx / l, uy = dy / l;
            w.linea("INFO", p, { x: p.x + ux * 1 - uy * 0.4, y: p.y + uy * 1 + ux * 0.4 });
            w.linea("INFO", p, { x: p.x + ux * 1 + uy * 0.4, y: p.y + uy * 1 - ux * 0.4 });
          }
        }
        for (const t of d.textos) w.texto("INFO", t.p, t.h, t.s, t.ang);
      }
    });
  }
  w.texto("INFO", { x: pliego.ancho / 2, y: pliego.alto - 0.8 }, 0.8, `${modelo} · Unidades: milímetros · Escala 1:1 · Tallas: ${pliego.tallas.join(", ")}`);
  w.par(0, "ENDSEC");
  w.par(0, "EOF");
  return Buffer.from(w.partes.join("\r\n") + "\r\n", "latin1");
}
