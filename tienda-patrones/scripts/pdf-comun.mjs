// Utilidades compartidas por los scripts de PDF.
import { rgb } from "pdf-lib";

export const MM = 72 / 25.4; // puntos PDF por milímetro

export const PAPELES = {
  carta: { nombre: "Carta", ancho: 215.9, alto: 279.4 },
  a4: { nombre: "A4", ancho: 210, alto: 297 },
};

export const TINTA = rgb(0.17, 0.14, 0.13);
export const GRIS = rgb(0.55, 0.52, 0.5);
export const ACENTO = rgb(0.76, 0.33, 0.18);

/**
 * Dibuja el cuadro de prueba: 5 × 5 cm con su medida en pulgadas (2") al lado.
 * (x, y) es la esquina inferior izquierda, en puntos.
 */
export function cuadroDePrueba(pagina, fuente, x, y) {
  const lado = 50 * MM;
  pagina.drawRectangle({ x, y, width: lado, height: lado, borderColor: TINTA, borderWidth: 1 });
  // marcas cada centímetro
  for (let i = 1; i < 5; i++) {
    const d = i * 10 * MM;
    pagina.drawLine({ start: { x: x + d, y }, end: { x: x + d, y: y + 3 * MM }, thickness: 0.6, color: TINTA });
    pagina.drawLine({ start: { x, y: y + d }, end: { x: x + 3 * MM, y: y + d }, thickness: 0.6, color: TINTA });
  }
  pagina.drawText("5 cm", { x: x + lado / 2 - 12, y: y + lado / 2 + 2, size: 11, font: fuente, color: TINTA });
  pagina.drawText("cuadro de prueba", { x: x + lado / 2 - 34, y: y + lado / 2 - 12, size: 8, font: fuente, color: GRIS });

  const pul = 2 * 25.4 * MM;
  const x2 = x + lado + 6 * MM;
  pagina.drawRectangle({ x: x2, y, width: pul, height: pul, borderColor: GRIS, borderWidth: 0.8, borderDashArray: [3, 2] });
  pagina.drawText('2"', { x: x2 + pul / 2 - 5, y: y + pul / 2 - 4, size: 10, font: fuente, color: GRIS });
}
