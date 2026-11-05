// PDF a escala real (1:1) del tamaño del pliego, con una capa por talla para que
// se puedan apagar en Acrobat Reader. Este PDF es el "plotter"; el script
// scripts/mosaico.mjs lo convierte en hojas Carta y A4 conservando las capas.
import {
  PDFDocument,
  PDFName,
  PDFOperator,
  PDFString,
  type PDFRef,
  StandardFonts,
  closePath,
  degrees,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  setDashPattern,
  setLineWidth,
  setStrokingRgbColor,
  stroke,
  fill,
  setFillingRgbColor,
  appendBezierCurve,
} from "pdf-lib";
import type { Pt } from "../geometria.ts";
import type { Pliego } from "./acomodo.ts";

const PT = 72 / 2.54; // puntos por cm

// colores por talla (RGB 0–1), en el mismo orden que el DXF
const COLORES: [number, number, number][] = [
  [0.85, 0.1, 0.1],
  [0.9, 0.45, 0.0],
  [0.75, 0.62, 0.0],
  [0.1, 0.6, 0.2],
  [0.0, 0.6, 0.7],
  [0.1, 0.3, 0.85],
  [0.6, 0.2, 0.75],
  [0.35, 0.35, 0.35],
  [0.55, 0.35, 0.2],
  [0.9, 0.2, 0.55],
];

export async function pdf(pliego: Pliego, modelo: string, tienda = "Trazo"): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${modelo} · plotter 1:1`);
  doc.setAuthor(tienda);
  doc.setCreator("patronaje");
  const fuente = await doc.embedFont(StandardFonts.Helvetica);
  const negrita = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = pliego.ancho * PT;
  const H = (pliego.alto + 3) * PT; // franja superior para la leyenda
  const page = doc.addPage([W, H]);
  const ctx = doc.context;
  const una = pliego.tallas.length === 1;

  // capas (Optional Content Groups)
  const ocgs = pliego.tallas.map((t) => ctx.register(ctx.obj({ Type: "OCG", Name: PDFString.of(`Talla ${t}`) })));
  const ocgInfo = ctx.register(ctx.obj({ Type: "OCG", Name: PDFString.of("Información") }));
  doc.catalog.set(
    PDFName.of("OCProperties"),
    ctx.obj({ OCGs: [...ocgs, ocgInfo], D: { Order: [...ocgs, ocgInfo], ON: [...ocgs, ocgInfo], OFF: [] } }),
  );
  const props: Record<string, PDFRef> = { Info: ocgInfo };
  ocgs.forEach((o, i) => (props[`T${i}`] = o));
  // asegura el diccionario de recursos antes de agregar Properties
  page.drawText(" ", { x: 0, y: 0, size: 1, font: fuente });
  page.node.Resources()!.set(PDFName.of("Properties"), ctx.obj(props as never));

  const c = (p: Pt) => [p.x * PT, p.y * PT] as const;
  const ops: PDFOperator[] = [];
  const bdc = (nombre: string) => PDFOperator.of("BDC" as never, [PDFName.of("OC"), PDFName.of(nombre)]);
  const emc = () => PDFOperator.of("EMC" as never);
  const trazo = (pts: Pt[], cerrar: boolean) => {
    if (pts.length < 2) return;
    ops.push(moveTo(...c(pts[0])));
    for (const p of pts.slice(1)) ops.push(lineTo(...c(p)));
    if (cerrar) ops.push(closePath());
    ops.push(stroke());
  };
  const circulo = (ctr: Pt, r: number, relleno = false) => {
    const k = 0.5523 * r;
    const [x, y] = [ctr.x, ctr.y];
    ops.push(moveTo(...c({ x: x + r, y })));
    ops.push(appendBezierCurve(...c({ x: x + r, y: y + k }), ...c({ x: x + k, y: y + r }), ...c({ x, y: y + r })));
    ops.push(appendBezierCurve(...c({ x: x - k, y: y + r }), ...c({ x: x - r, y: y + k }), ...c({ x: x - r, y })));
    ops.push(appendBezierCurve(...c({ x: x - r, y: y - k }), ...c({ x: x - k, y: y - r }), ...c({ x, y: y - r })));
    ops.push(appendBezierCurve(...c({ x: x + k, y: y - r }), ...c({ x: x + r, y: y - k }), ...c({ x: x + r, y })));
    ops.push(relleno ? fill() : stroke());
  };

  const iRef = Math.floor(pliego.tallas.length / 2);
  pliego.tallas.forEach((_, i) => {
    const [r, g, b] = una ? [0.1, 0.08, 0.07] : COLORES[i % COLORES.length];
    ops.push(bdc(`T${i}`), pushGraphicsState(), setStrokingRgbColor(r, g, b), setFillingRgbColor(r, g, b));
    for (const grupo of pliego.grupos) {
      const d = grupo.porTalla[i].d;
      ops.push(setLineWidth(0.8), setDashPattern([], 0));
      trazo(d.corte, true);
      ops.push(setLineWidth(0.6));
      for (const pin of d.pinzas) trazo(pin, false);
      for (const [a, q] of d.piquetes) trazo([a, q], false);
      for (const t of d.taladros) circulo(t, 0.15, true);
      for (const bt of d.botones) circulo(bt.p, bt.r);
      ops.push(setLineWidth(1.6));
      for (const [a, q] of d.ojales) trazo([a, q], false);
      ops.push(setLineWidth(0.5), setDashPattern([6, 3, 1.5, 3], 0));
      for (const l of d.lineas) trazo(l.pts, false);
      if (una) {
        ops.push(setLineWidth(0.4), setDashPattern([4, 3], 0));
        trazo(d.costura, true);
      }
    }
    ops.push(popGraphicsState(), emc());
  });
  // información: hilo y flechas
  ops.push(bdc("Info"), pushGraphicsState(), setStrokingRgbColor(0.2, 0.17, 0.15), setLineWidth(0.7), setDashPattern([], 0));
  for (const grupo of pliego.grupos) {
    const d = grupo.porTalla[iRef].d;
    if (!d.hilo) continue;
    const [a, b] = d.hilo;
    trazo([a, b], false);
    for (const [p, q] of [[a, b], [b, a]] as [Pt, Pt][]) {
      const dx = q.x - p.x, dy = q.y - p.y;
      const l = Math.hypot(dx, dy) || 1;
      const ux = dx / l, uy = dy / l;
      trazo([{ x: p.x + ux * 1 - uy * 0.4, y: p.y + uy * 1 + ux * 0.4 }, p, { x: p.x + ux * 1 + uy * 0.4, y: p.y + uy * 1 - ux * 0.4 }], false);
    }
  }
  ops.push(popGraphicsState(), emc());
  page.pushOperators(...ops);

  // textos (capa Información)
  page.pushOperators(bdc("Info"));
  for (const grupo of pliego.grupos) {
    const d = grupo.porTalla[iRef].d;
    for (const t of d.textos) {
      const f = t.s === t.s.toUpperCase() ? negrita : fuente;
      const size = t.h * PT * 0.9;
      const ancho = f.widthOfTextAtSize(t.s, size);
      const cos = Math.cos(t.ang), sin = Math.sin(t.ang);
      page.drawText(t.s, {
        x: t.p.x * PT - (ancho / 2) * cos + (size / 3) * sin,
        y: t.p.y * PT - (ancho / 2) * sin - (size / 3) * cos,
        size,
        font: f,
        color: rgb(0.25, 0.22, 0.2),
        rotate: degrees((t.ang * 180) / Math.PI),
      });
    }
  }
  // leyenda
  const yL = H - 1.6 * PT;
  page.drawText(`${modelo}  ·  escala 1:1  ·  ${tienda}`, { x: 1.5 * PT, y: yL, size: 14, font: negrita, color: rgb(0.17, 0.14, 0.13) });
  let xL = 1.5 * PT + negrita.widthOfTextAtSize(`${modelo}  ·  escala 1:1  ·  ${tienda}`, 14) + 24;
  if (!una) {
    pliego.tallas.forEach((t, i) => {
      const [r, g, b] = COLORES[i % COLORES.length];
      page.drawRectangle({ x: xL, y: yL - 1, width: 18, height: 10, color: rgb(r, g, b) });
      page.drawText(t, { x: xL + 22, y: yL, size: 11, font: fuente, color: rgb(0.17, 0.14, 0.13) });
      xL += 30 + fuente.widthOfTextAtSize(t, 11);
    });
  } else {
    page.drawText(`Talla ${pliego.tallas[0]} · línea continua = corte · punteada = costura`, { x: xL, y: yL, size: 11, font: fuente, color: rgb(0.17, 0.14, 0.13) });
  }
  // cuadro de prueba de 5 cm
  const q = { x: pliego.ancho - 6.5, y: pliego.alto + 0.3 };
  page.drawRectangle({ x: q.x * PT, y: q.y * PT, width: 5 * PT, height: 2.5 * PT, borderColor: rgb(0.17, 0.14, 0.13), borderWidth: 0.8 });
  page.drawText("5 cm", { x: (q.x + 1.8) * PT, y: (q.y + 1) * PT, size: 10, font: fuente });
  page.pushOperators(emc());
  return doc.save();
}
