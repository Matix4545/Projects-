// Genera public/cuadro-de-prueba.pdf (Carta) y public/cuadro-de-prueba-a4.pdf
// Uso:  npm run cuadro-prueba
import { writeFile } from "node:fs/promises";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { ACENTO, GRIS, MM, PAPELES, TINTA, cuadroDePrueba } from "./pdf-comun.mjs";

const NOMBRE_TIENDA = process.env.NOMBRE_TIENDA || "Trazo";

for (const [clave, salida] of [
  ["carta", "public/cuadro-de-prueba.pdf"],
  ["a4", "public/cuadro-de-prueba-a4.pdf"],
]) {
  const papel = PAPELES[clave];
  const doc = await PDFDocument.create();
  doc.setTitle(`Hoja de prueba de impresión (${papel.nombre})`);
  doc.setAuthor(NOMBRE_TIENDA);
  const negrita = await doc.embedFont(StandardFonts.HelveticaBold);
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const W = papel.ancho * MM;
  const H = papel.alto * MM;
  const p = doc.addPage([W, H]);
  const m = 20 * MM;

  p.drawText(NOMBRE_TIENDA, { x: m, y: H - m - 6, size: 20, font: negrita, color: ACENTO });
  p.drawText(`Hoja de prueba de impresión · ${papel.nombre}`, { x: m, y: H - m - 30, size: 14, font: negrita, color: TINTA });
  const pasos = [
    "1. Imprime esta hoja en \"Tamaño real\" o \"Escala 100 %\" (nunca \"Ajustar a la página\").",
    "2. Mide el cuadro con una regla: debe medir exactamente 5 cm por lado.",
    "3. Si mide distinto, revisa la configuración de tu impresora antes de imprimir el patrón.",
  ];
  pasos.forEach((t, i) => p.drawText(t, { x: m, y: H - m - 58 - i * 16, size: 10.5, font: normal, color: TINTA }));

  cuadroDePrueba(p, negrita, m, H - m - 58 - 3 * 16 - 70 * MM);

  // Regla de 15 cm
  const yR = H / 2 - 40 * MM;
  p.drawText("Regla de control (15 cm)", { x: m, y: yR + 12 * MM, size: 10, font: negrita, color: TINTA });
  p.drawLine({ start: { x: m, y: yR }, end: { x: m + 150 * MM, y: yR }, thickness: 1, color: TINTA });
  for (let mm = 0; mm <= 150; mm++) {
    const largo = mm % 10 === 0 ? 6 : mm % 5 === 0 ? 4 : 2;
    p.drawLine({ start: { x: m + mm * MM, y: yR }, end: { x: m + mm * MM, y: yR + largo * MM }, thickness: 0.4, color: TINTA });
    if (mm % 10 === 0) p.drawText(String(mm / 10), { x: m + mm * MM - 2, y: yR + 7.5 * MM, size: 7, font: normal, color: TINTA });
  }

  // Marco de margen: si no se ve completo, la impresora recorta
  p.drawRectangle({ x: 10 * MM, y: 10 * MM, width: W - 20 * MM, height: H - 20 * MM, borderColor: GRIS, borderWidth: 0.5, borderDashArray: [4, 3] });
  p.drawText("Si no ves completo este marco punteado, tu impresora recorta más de 1 cm de margen.", {
    x: m, y: 14 * MM, size: 8, font: normal, color: GRIS,
  });

  await writeFile(salida, await doc.save());
  console.log("✓", salida);
}
