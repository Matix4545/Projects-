// ─────────────────────────────────────────────────────────────────────────────
//  MOSAICO: convierte el PDF de tu patrón (exportado de AutoCAD a escala 1:1)
//  en hojas tamaño Carta y/o A4 listas para imprimir en casa.
//
//  Uso:
//    npm run mosaico -- mi-patron.pdf
//    npm run mosaico -- mi-patron.pdf --papel a4 --nombre "Vestido Amapola"
//    npm run mosaico -- mi-patron.pdf --papel ambos --margen 12 --salida salida/
//
//  Qué hace:
//    · Hoja 1: portada con instrucciones, cuadro de prueba de 5 cm y mapa de armado.
//    · Demás hojas: el patrón partido en cuadrícula (A1, A2, B1…), con línea de
//      recorte, rombos de unión en cada orilla y número de hoja.
//    · CONSERVA LAS CAPAS de AutoCAD: si exportaste con una capa por talla,
//      la clienta puede apagar las tallas que no usa en Acrobat Reader.
// ─────────────────────────────────────────────────────────────────────────────
import { parseArgs } from "node:util";
import { PAPELES } from "./pdf-comun.mjs";
import { generarMosaico } from "./mosaico-lib.mjs";

const { values: op, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    papel: { type: "string", default: "ambos" }, // carta | a4 | ambos
    margen: { type: "string", default: "12" }, // mm sin imprimir alrededor de cada hoja
    nombre: { type: "string" },
    tienda: { type: "string", default: process.env.NOMBRE_TIENDA || "Trazo" },
    salida: { type: "string", default: "salida" },
  },
});

if (!positionals[0]) {
  console.error('Uso: npm run mosaico -- patron.pdf [--papel carta|a4|ambos] [--nombre "Vestido Amapola"]');
  process.exit(1);
}
const papeles = op.papel === "ambos" ? ["carta", "a4"] : [op.papel];
for (const p of papeles) if (!PAPELES[p]) throw new Error(`Papel desconocido: ${p} (usa carta, a4 o ambos)`);
for (const papel of papeles) {
  await generarMosaico({ entrada: positionals[0], papel, nombre: op.nombre, tienda: op.tienda, margen: Number(op.margen), salida: op.salida });
}
