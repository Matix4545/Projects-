// Mosaico: PDF a escala 1:1 → hojas Carta/A4 (ver scripts/mosaico.mjs para el uso).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, PDFName, PDFObjectCopier, PDFPage, StandardFonts, degrees } from "pdf-lib";
import { ACENTO, GRIS, MM, PAPELES, TINTA, cuadroDePrueba } from "./pdf-comun.mjs";

/** A, B, …, Z, AA, AB… */
function letra(i) {
  let s = "";
  i += 1;
  while (i > 0) {
    const r = (i - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}

/** Elige vertical u horizontal según cuál use menos hojas. */
function planear(W, H, papel, margen) {
  const opciones = [
    [papel.ancho * MM, papel.alto * MM],
    [papel.alto * MM, papel.ancho * MM],
  ].map(([pw, ph]) => {
    const cw = pw - 2 * margen;
    const ch = ph - 2 * margen;
    const cols = Math.ceil(W / cw - 1e-6);
    const filas = Math.ceil(H / ch - 1e-6);
    return { pw, ph, cw, ch, cols, filas, total: cols * filas };
  });
  return opciones[0].total <= opciones[1].total ? opciones[0] : opciones[1];
}

/**
 * @param {{ entrada: string, papel: "carta" | "a4", nombre?: string, tienda?: string, margen?: number, salida?: string, silencioso?: boolean }} o
 * @returns {Promise<string>} ruta del PDF generado
 */
export async function generarMosaico(o) {
  const clavePapel = o.papel;
  const entrada = o.entrada;
  const base = path.basename(entrada, path.extname(entrada));
  const nombre = o.nombre || base;
  const margen = (o.margen ?? 12) * MM;
  const op = { tienda: o.tienda || "Trazo", salida: o.salida || "salida" };
  const log = o.silencioso ? () => {} : console.log;
  const papel = PAPELES[clavePapel];
  const origen = await PDFDocument.load(await readFile(entrada));
  const doc = await PDFDocument.create();
  doc.setTitle(`${nombre} · ${papel.nombre}`);
  doc.setAuthor(op.tienda);
  doc.setCreator("mosaico.mjs");
  const negrita = await doc.embedFont(StandardFonts.HelveticaBold);
  const normal = await doc.embedFont(StandardFonts.Helvetica);

  // Un solo copiador: así las páginas comparten el contenido (archivo ligero)
  // y las capas (OCG) de las páginas coinciden con las del catálogo.
  const copiador = PDFObjectCopier.for(origen.context, doc.context);
  const ocp = origen.catalog.get(PDFName.of("OCProperties"));
  if (ocp) doc.catalog.set(PDFName.of("OCProperties"), copiador.copy(ocp));

  const resumen = [];
  const paginasOrigen = origen.getPages();

  for (let n = 0; n < paginasOrigen.length; n++) {
    const fuente = paginasOrigen[n];
    if (fuente.getRotation().angle % 360 !== 0) {
      console.warn(`  ⚠ La página ${n + 1} está girada; exporta desde AutoCAD sin rotación para mejores resultados.`);
    }
    const caja = fuente.getMediaBox();
    const W = caja.width;
    const H = caja.height;
    const plan = planear(W, H, papel, margen);
    const { pw, ph, cw, ch, cols, filas } = plan;
    const offX = (cols * cw - W) / 2;
    const offY = (filas * ch - H) / 2;
    const prefijo = paginasOrigen.length > 1 ? `${n + 1}-` : "";
    resumen.push(`${(W / MM / 10).toFixed(1)} × ${(H / MM / 10).toFixed(1)} cm → ${cols} col × ${filas} filas = ${cols * filas} hojas`);

    // ── Portada con mapa de armado ──
    const portada = doc.addPage([pw, ph]);
    const m = 15 * MM;
    let y = ph - m - 14;
    portada.drawText(op.tienda, { x: m, y, size: 13, font: negrita, color: ACENTO });
    y -= 26;
    portada.drawText(nombre + (paginasOrigen.length > 1 ? ` (parte ${n + 1})` : ""), { x: m, y, size: 20, font: negrita, color: TINTA });
    y -= 18;
    portada.drawText(`Papel ${papel.nombre} · ${cols * filas} hojas (${cols} columnas × ${filas} filas)`, { x: m, y, size: 10.5, font: normal, color: GRIS });
    y -= 26;
    const pasos = [
      '1. Imprime en "Tamaño real" / "Escala 100 %". Mide el cuadro de prueba: 5 cm exactos.',
      "2. En Acrobat Reader (panel Capas) apaga las tallas que no necesitas antes de imprimir.",
      "3. Recorta por la línea gris el margen DERECHO e INFERIOR de cada hoja.",
      "4. Une las hojas en orden (A1, A2… y abajo B1, B2…) haciendo coincidir los rombos.",
    ];
    for (const t of pasos) {
      portada.drawText(t, { x: m, y, size: 9.5, font: normal, color: TINTA });
      y -= 14;
    }
    cuadroDePrueba(portada, negrita, m, y - 56 * MM);
    y -= 64 * MM;

    // Miniatura del patrón con la cuadrícula encima
    const [mini] = await doc.embedPdf(origen, [n]);
    const areaW = pw - 2 * m;
    const areaH = y - m;
    const esc = Math.min(areaW / (cols * cw), areaH / (filas * ch));
    const gx = m + (areaW - cols * cw * esc) / 2;
    const gy = m + (areaH - filas * ch * esc) / 2;
    portada.drawPage(mini, { x: gx + offX * esc, y: gy + offY * esc, xScale: esc, yScale: esc });
    for (let f = 0; f < filas; f++) {
      for (let c = 0; c < cols; c++) {
        const x = gx + c * cw * esc;
        const yy = gy + (filas - 1 - f) * ch * esc;
        portada.drawRectangle({ x, y: yy, width: cw * esc, height: ch * esc, borderColor: ACENTO, borderWidth: 0.6, borderOpacity: 0.8 });
        const etiqueta = `${prefijo}${letra(f)}${c + 1}`;
        const tam = Math.max(5, Math.min(10, cw * esc * 0.18));
        portada.drawText(etiqueta, { x: x + 2, y: yy + ch * esc - tam - 1, size: tam, font: negrita, color: ACENTO });
      }
    }

    // ── Hojas del mosaico ──
    for (let f = 0; f < filas; f++) {
      for (let c = 0; c < cols; c++) {
        // Región del patrón que cae en esta hoja (coordenadas del PDF original)
        const sx = caja.x - offX + c * cw;
        const sy = caja.y - offY + (filas - 1 - f) * ch;

        const hojaNodo = copiador.copy(fuente.node);
        const hoja = PDFPage.of(hojaNodo, doc.context.register(hojaNodo), doc);
        doc.addPage(hoja);
        for (const k of ["TrimBox", "BleedBox", "ArtBox", "Rotate", "Annots"]) hojaNodo.delete(PDFName.of(k));
        hoja.setMediaBox(sx - margen, sy - margen, pw, ph);
        hoja.setCropBox(sx - margen, sy - margen, pw, ph);

        // Recorta el dibujo al área útil (el margen queda en blanco)
        hojaNodo.normalize(); // Contents = [q, …original…, Q]
        const recorte = doc.context.register(doc.context.stream(`${sx} ${sy} ${cw} ${ch} re W n\n`));
        hojaNodo.Contents().insert(1, recorte);

        const etiqueta = `${prefijo}${letra(f)}${c + 1}`;
        const x0 = sx;
        const y0 = sy;
        // Línea de recorte
        hoja.drawRectangle({ x: x0, y: y0, width: cw, height: ch, borderColor: GRIS, borderWidth: 0.5 });
        // Etiqueta grande y tenue al centro, para armar rápido
        hoja.drawText(etiqueta, { x: x0 + cw / 2 - etiqueta.length * 14, y: y0 + ch / 2 - 18, size: 48, font: negrita, color: GRIS, opacity: 0.12 });
        // Rombos de unión: medio rombo en cada orilla que tiene vecina
        const r = 5 * MM;
        const vecinos = [
          { lado: "der", hay: c < cols - 1, txt: `${prefijo}${letra(f)}${c + 2}`, x: x0 + cw, y: y0 + ch / 2 },
          { lado: "izq", hay: c > 0, txt: `${prefijo}${letra(f)}${c}`, x: x0, y: y0 + ch / 2 },
          { lado: "arr", hay: f > 0, txt: `${prefijo}${letra(f - 1)}${c + 1}`, x: x0 + cw / 2, y: y0 + ch },
          { lado: "aba", hay: f < filas - 1, txt: `${prefijo}${letra(f + 1)}${c + 1}`, x: x0 + cw / 2, y: y0 },
        ];
        for (const v of vecinos) {
          if (!v.hay) continue;
          const pts =
            v.lado === "der" ? [[v.x, v.y - r], [v.x - r, v.y], [v.x, v.y + r]]
            : v.lado === "izq" ? [[v.x, v.y - r], [v.x + r, v.y], [v.x, v.y + r]]
            : v.lado === "arr" ? [[v.x - r, v.y], [v.x, v.y - r], [v.x + r, v.y]]
            : [[v.x - r, v.y], [v.x, v.y + r], [v.x + r, v.y]];
          const d = `M ${pts[0][0]} ${-pts[0][1]} L ${pts[1][0]} ${-pts[1][1]} L ${pts[2][0]} ${-pts[2][1]} Z`;
          hoja.drawSvgPath(d, { x: 0, y: 0, color: ACENTO, opacity: 0.85 });
          const tx = v.lado === "der" ? v.x - r - 22 : v.lado === "izq" ? v.x + r + 3 : v.x - 8;
          const ty = v.lado === "arr" ? v.y - r - 10 : v.lado === "aba" ? v.y + r + 3 : v.y - 3;
          hoja.drawText(v.txt, { x: tx, y: ty, size: 8, font: negrita, color: ACENTO });
        }
        // Pie de página en el margen
        const pie = `${nombre} · ${papel.nombre} · Hoja ${etiqueta} (fila ${letra(f)}, columna ${c + 1}) · Imprime al 100 %`;
        hoja.drawText(pie, { x: x0, y: y0 - margen + 4.5 * MM, size: 7, font: normal, color: GRIS });
        hoja.drawText(etiqueta, { x: x0 + cw - etiqueta.length * 6, y: y0 + ch + margen - 8 * MM, size: 11, font: negrita, color: TINTA });
        // Marca "recorta" en las orillas que se recortan
        if (c < cols - 1) hoja.drawText("recorta", { x: x0 + cw + 2.5 * MM, y: y0 + ch / 2 + 30, size: 6.5, font: normal, color: GRIS, rotate: degrees(-90) });
        if (f < filas - 1) hoja.drawText("recorta", { x: x0 + cw / 2 + 20, y: y0 - 4 * MM, size: 6.5, font: normal, color: GRIS });
      }
    }
  }

  await mkdir(op.salida, { recursive: true });
  const archivo = path.join(op.salida, `${base.replace(/-plotter$/, "")}-${clavePapel}.pdf`);
  await writeFile(archivo, await doc.save());
  log(`✓ ${archivo}`);
  for (const r of resumen) log(`  ${r}`);
  if (ocp) log("  Capas conservadas (una por talla).");
  else log("  El PDF no trae capas. Tip: en AutoCAD activa \"Incluir información de capas\" al exportar.");
  return archivo;
}
