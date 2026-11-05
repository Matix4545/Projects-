// Piezas de partida que comparten varios modelos.
import type { Medidas } from "../medidas.ts";
import { type Cuerpo, cuerpoBase, delanteroConPinza } from "../bases/cuerpo.ts";
import { mangaBase } from "../bases/manga.ts";
import { alargar } from "../bases/utiles.ts";
import type { Pieza } from "../pieza.ts";

/** Largo de una blusa básica desde la cintura (a la cadera + 2 cm). */
export const largoBlusa = (m: Medidas) => m.alturaCadera + 2;

/**
 * Blusa base: delantero con pinza de costado, espalda sin pinza de hombro
 * (va embebida), ambas alargadas a la cadera con pinzas de pez, y manga base.
 */
export function blusaBase(m: Medidas, o: { largo?: number; pinza?: Parameters<typeof delanteroConPinza>[1] } = {}): {
  cuerpo: Cuerpo;
  delantero: Pieza;
  espalda: Pieza;
  manga: Pieza;
} {
  const cuerpo = cuerpoBase(m);
  const largo = o.largo ?? largoBlusa(m);
  const anchoD = m.cadera / 4 + 1.5 + 0.5;
  const anchoE = m.cadera / 4 + 1.5 - 0.5;
  const del = delanteroConPinza(cuerpo, o.pinza ?? "costado");
  const delantero = alargar(del, m, { anchoCadera: anchoD, largo, nombre: "Delantero" });
  const espalda = alargar(cuerpo.espalda, m, { anchoCadera: anchoE, largo, nombre: "Espalda" });
  const { manga } = mangaBase(m, cuerpo);
  return { cuerpo, delantero, espalda, manga };
}
