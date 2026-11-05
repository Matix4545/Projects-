// Bloque base de pantalón recto de tiro a la cintura.
// Holgura: 4 cm en cadera, 2 cm en cintura, 1 cm en el tiro.
import { P, curva, dir, lerp, dist, escalar, suma } from "../geometria.ts";
import type { Medidas } from "../medidas.ts";
import { type Pieza, agregarPinza, crear, espejarX, margen, piquete } from "../pieza.ts";

export type OpcionesPantalon = {
  holguraCadera?: number;
  holguraCintura?: number;
  /** Ancho total de la bastilla (cm). */
  bastilla?: number;
  /** Ancho total en la rodilla (cm). */
  rodilla?: number;
  /** Largo desde la cintura; por defecto al tobillo. */
  largo?: number;
};

export type Pantalon = {
  delantero: Pieza;
  espalda: Pieza;
  ref: { cadera: number; tiro: number; rodilla: number; bajo: number; rayaDelantero: number; rayaEspalda: number };
};

export function pantalonBase(m: Medidas, o: OpcionesPantalon = {}): Pantalon {
  const H = m.cadera;
  const hc = (o.holguraCadera ?? 4) / 4;
  const hw = (o.holguraCintura ?? 2) / 4;
  const yCad = -m.alturaCadera;
  const yTiro = -(m.tiro + 1);
  const largo = o.largo ?? m.tiro + m.largoPierna - 4;
  const yBajo = -largo;
  const yRod = -(m.largoRodilla + 0);
  const bastilla = o.bastilla ?? Math.round(H * 0.42);
  const rodillaT = o.rodilla ?? bastilla + 4;

  // ── Delantero: costado en x≈0, centro delantero hacia x>0 ──
  const anchoD = H / 4 + hc - 0.5;
  const extD = H / 16;
  const cintD = m.cintura / 4 + hw + 0.5;
  const xCentroCint = anchoD - 1;
  const sobraD = xCentroCint - cintD;
  const pinzaD = Math.min(2.5, Math.max(0, sobraD - 2.5));
  const costD = sobraD - pinzaD;
  const rayaD = (anchoD + extD) / 2 - 0.3;
  const hD = bastilla / 4 - 1; // media bastilla delantera
  const rD = rodillaT / 4 - 1;
  const tiroD = P(anchoD + extD, yTiro);
  const inicioCurvaD = P(anchoD, yTiro + (yCad - yTiro) * 0.55);
  const curvaTiroD = curva(inicioCurvaD, P(0, -1), tiroD, P(1, 0), 0.55, 0.5);
  const entrepiernaD = curva(tiroD, dir(tiroD, P(rayaD + rD, yRod)), P(rayaD + rD, yRod), P(0, -1), 0.35, 0.4);
  const ladoD = curva(P(costD, 0.7), dir(P(costD, 0.7), P(0, yCad * 0.5)), P(0, yCad), P(0, -1), 0.4, 0.45);
  const ladoBajoD = curva(P(0, yCad), P(0, -1), P(rayaD - rD, yRod), dir(P(0, yTiro), P(rayaD - rD, yRod)), 0.4, 0.4);
  let delantero = crear(
    "Pantalón delantero",
    [
      { x: rayaD - hD, y: yBajo, n: "costadoBajo" },
      { x: rayaD + hD, y: yBajo, n: "entrepiernaBajo" },
      { x: rayaD + rD, y: yRod, n: "entrepiernaRodilla" },
      ...[...entrepiernaD].reverse().slice(1, -1),
      { ...tiroD, n: "tiro" },
      ...[...curvaTiroD].reverse().slice(1, -1),
      { ...inicioCurvaD, n: "centroCadera" },
      { x: xCentroCint, y: 0, n: "centroCintura" },
      { x: costD, y: 0.7, n: "costadoCintura" },
      ...ladoD.slice(1, -1),
      { x: 0, y: yCad, n: "cadera" },
      ...ladoBajoD.slice(1, -1),
      { x: rayaD - rD, y: yRod, n: "costadoRodilla" },
    ],
    { cortar: "Cortar 2 en tela (un par)", ancla: P(rayaD, yTiro) },
  );
  if (pinzaD > 0.4) agregarPinza(delantero, "pinza", P(rayaD, 0.35), P(rayaD, -9.5), pinzaD, 0);
  margen(delantero, "costadoBajo", "entrepiernaBajo", 3);
  delantero.hilo = [P(rayaD, yTiro - 4), P(rayaD, yBajo + 10)];
  delantero.marcas.push({ t: "linea", pts: [P(rayaD, yCad), P(rayaD, yBajo)], estilo: "pliegue" });
  piquete(delantero, "cadera");

  // ── Espalda: costado en x≈0, centro espalda hacia x>0 (luego se refleja) ──
  const anchoE = H / 4 + hc + 0.5;
  const cintE = m.cintura / 4 + hw - 0.5;
  const inclin = 0.21; // pendiente del centro espalda
  const subida = 2.5;
  const xCentroCadE = anchoE;
  const centroCintE = P(anchoE - (subida - yCad) * inclin, subida);
  const xCentroTiro = anchoE + (yCad - yTiro) * inclin;
  const extE = H / 10 + 0.5;
  const tiroE = P(xCentroTiro + extE, yTiro - 0.7);
  const inicioCurvaE = lerp(P(xCentroCadE, yCad), P(xCentroTiro, yTiro), 0.45);
  const curvaTiroE = curva(inicioCurvaE, dir(P(xCentroCadE, yCad), P(xCentroTiro, yTiro)), tiroE, P(1, 0), 0.5, 0.55);
  const rayaE = (xCentroTiro + extE) / 2 - 0.5;
  const hE = bastilla / 4 + 1;
  const rE = rodillaT / 4 + 1;
  // costado de la cintura: lo que sobra va a pinzas (máx. 2 de 2.5 cm) y al costado
  const largoCintSinCostado = dist(P(0, 0.5), centroCintE);
  const sobraE = largoCintSinCostado - cintE;
  const costE = Math.min(2.5, Math.max(1, sobraE * 0.35));
  const pinzasE = sobraE - costE;
  const nE = pinzasE > 3 ? 2 : 1;
  const cintCostE = P(costE, 0.5);
  const ladoE = curva(cintCostE, dir(cintCostE, P(0, yCad * 0.5)), P(0, yCad), P(0, -1), 0.4, 0.45);
  const ladoBajoE = curva(P(0, yCad), P(0, -1), P(rayaE - rE, yRod), dir(P(0, yTiro), P(rayaE - rE, yRod)), 0.4, 0.4);
  const entrepiernaE = curva(tiroE, dir(tiroE, P(rayaE + rE, yRod)), P(rayaE + rE, yRod), P(0, -1), 0.3, 0.4);
  let espalda = crear(
    "Pantalón espalda",
    [
      { x: rayaE - hE, y: yBajo, n: "costadoBajo" },
      { x: rayaE + hE, y: yBajo, n: "entrepiernaBajo" },
      { x: rayaE + rE, y: yRod, n: "entrepiernaRodilla" },
      ...[...entrepiernaE].reverse().slice(1, -1),
      { ...tiroE, n: "tiro" },
      ...[...curvaTiroE].reverse().slice(1, -1),
      { ...inicioCurvaE, n: "centroCadera" },
      { ...centroCintE, n: "centroCintura" },
      { ...cintCostE, n: "costadoCintura" },
      ...ladoE.slice(1, -1),
      { x: 0, y: yCad, n: "cadera" },
      ...ladoBajoE.slice(1, -1),
      { x: rayaE - rE, y: yRod, n: "costadoRodilla" },
    ],
    { cortar: "Cortar 2 en tela (un par)", ancla: P(rayaE, yTiro) },
  );
  const anchoP = pinzasE / nE;
  for (let k = 0; k < nE; k++) {
    const t = nE === 1 ? 0.5 : 0.36 + k * 0.3;
    const c = lerp(cintCostE, centroCintE, t);
    agregarPinza(espalda, `pinza${k + 1}`, c, suma(c, escalar(P(0.12, -1), k === 0 ? 12 : 11)), anchoP, 0);
  }
  margen(espalda, "costadoBajo", "entrepiernaBajo", 3);
  margen(espalda, "centroCadera", "centroCintura", 2); // costura de centro espalda con margen para ajustar
  espalda.hilo = [P(rayaE, yTiro - 4), P(rayaE, yBajo + 10)];
  espalda.marcas.push({ t: "linea", pts: [P(rayaE, yTiro), P(rayaE, yBajo)], estilo: "pliegue" });
  piquete(espalda, "cadera");
  // espalda con el centro a la izquierda (como el cuerpo y la falda)
  espalda = espejarX(espalda, 0);
  return {
    delantero,
    espalda,
    ref: { cadera: yCad, tiro: yTiro, rodilla: yRod, bajo: yBajo, rayaDelantero: rayaD, rayaEspalda: -rayaE },
  };
}
