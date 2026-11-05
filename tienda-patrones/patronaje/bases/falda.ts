// Bloque base de falda recta (delantero al doblez y espalda con costura al centro).
// Holgura: 4 cm en cadera y 2 cm en cintura.
import { P, curva, dir, perp, escalar } from "../geometria.ts";
import type { Medidas } from "../medidas.ts";
import { type Pieza, agregarPinza, crear, doblez, espejarX, margen, piquete } from "../pieza.ts";

export type OpcionesFalda = {
  /** Largo desde la cintura (por defecto, a la rodilla). */
  largo?: number;
  holguraCadera?: number;
  holguraCintura?: number;
  /** Para vestidos: usa estas pinzas de cintura en vez de calcularlas. */
  pinzasDelantero?: { x: number; ancho: number }[];
  pinzasEspalda?: { x: number; ancho: number }[];
  /** Cuánto baja el centro espalda en la cintura (cm). */
  bajadaEspalda?: number;
};

export type Falda = {
  delantero: Pieza;
  espalda: Pieza;
  ref: { cadera: number; largo: number; anchoDelantero: number; anchoEspalda: number };
};

/** Traza media falda con el centro en x=0 y el costado hacia x>0. */
function mitad(
  nombre: string,
  m: Medidas,
  anchoCadera: number,
  cinturaTerminada: number,
  largo: number,
  bajadaCentro: number,
  largosPinza: number[],
  posiciones: number[],
  pinzasDadas?: { x: number; ancho: number }[],
): Pieza {
  const yC = -m.alturaCadera;
  const sobra = anchoCadera - cinturaTerminada;
  const costado = pinzasDadas && pinzasDadas.length ? sobra - pinzasDadas.reduce((s, d) => s + d.ancho, 0) : Math.min(3, Math.max(1.2, sobra * 0.42));
  let pinzas = sobra - costado;
  let n = pinzas > 2.8 ? 2 : 1;
  // pinzas dadas (vestidos): posiciones y anchos fijos; el resto va al costado
  const dadas = pinzasDadas && pinzasDadas.length ? pinzasDadas : null;
  const xCostCint = anchoCadera - costado;
  const cintCost = P(xCostCint, 0.8);
  const cadera = P(anchoCadera, yC);
  const lado = curva(cintCost, dir(cintCost, P(anchoCadera, yC * 0.45)), cadera, P(0, -1), 0.45, 0.45);
  const tanLado = dir(lado[0], lado[1]);
  const cintura = curva(P(0, -bajadaCentro), P(1, 0), cintCost, perp(tanLado), 0.5, 0.25);
  const cont = [
    { x: 0, y: -largo, n: "centroBajo" },
    { x: anchoCadera, y: -largo, n: "costadoBajo" },
    { ...cadera, n: "cadera" },
    ...[...lado].reverse().slice(1, -1),
    { ...cintCost, n: "costadoCintura" },
    ...[...cintura].reverse().slice(1, -1),
    { x: 0, y: -bajadaCentro, n: "centroCintura" },
  ];
  const pz = crear(nombre, cont, { ancla: P(0, 0) });
  if (dadas) {
    n = dadas.length;
    pinzas = dadas.reduce((s, d) => s + d.ancho, 0);
  }
  // con mucha diferencia cadera–cintura, una tercera pinza (máx. 3.5 cm cada una)
  if (!dadas && pinzas / n > 3.5) n = Math.min(3, Math.ceil(pinzas / 3.5));
  const anchoPinza = pinzas / n;
  let xAnterior = -Infinity;
  for (let k = 0; k < n; k++) {
    const ancho = dadas ? dadas[k].ancho : anchoPinza;
    let x = dadas ? dadas[k].x : posiciones[k] ?? (xCostCint * (k + 1)) / (n + 1);
    // que las pinzas no se encimen: al menos su ancho + 1.5 cm entre centros
    if (!dadas) x = Math.max(x, xAnterior + ancho + 1.5);
    xAnterior = x;
    const lp = largosPinza[k] ?? largosPinza[largosPinza.length - 1] - 1;
    agregarPinza(pz, `pinza${k + 1}`, P(x, 0), P(x, -lp), ancho, 0);
  }
  margen(pz, "centroBajo", "costadoBajo", 3);
  piquete(pz, "cadera");
  pz.hilo = [P(Math.min(6, anchoCadera / 3), yC - 4), P(Math.min(6, anchoCadera / 3), -largo + 8)];
  return pz;
}

export function faldaBase(m: Medidas, o: OpcionesFalda = {}): Falda {
  const hc = (o.holguraCadera ?? 4) / 4;
  const hw = (o.holguraCintura ?? 2) / 4;
  const largo = o.largo ?? m.largoRodilla;
  const anchoD = m.cadera / 4 + hc + 0.5;
  const anchoE = m.cadera / 4 + hc - 0.5;
  const cintD = m.cintura / 4 + hw + 0.5;
  const cintE = m.cintura / 4 + hw - 0.5;
  const sep = m.separacionBusto / 2;
  let delantero = mitad("Falda delantero", m, anchoD, cintD, largo, 0, [9.5, 8.5], [sep, sep + 3.8], o.pinzasDelantero);
  const espalda = mitad("Falda espalda", m, anchoE, cintE, largo, o.bajadaEspalda ?? 1, [14, 12.5], [anchoE * 0.33, anchoE * 0.33 + 4.2], o.pinzasEspalda);
  // delantero con el centro a la derecha (como en el cuerpo) y al doblez
  delantero = espejarX(delantero, 0);
  doblez(delantero, "centroBajo", "centroCintura");
  delantero.cortar = "Cortar 1 al doblez en tela";
  espalda.cortar = "Cortar 2 en tela (un par)";
  margen(espalda, "centroCintura", "centroBajo", 1.5);
  espalda.marcas.push({ t: "texto", p: P(1.8, -m.alturaCadera + 1), s: "fin del cierre", h: 0.7 });
  piquete(espalda, P(0, -m.alturaCadera));
  void escalar;
  return { delantero, espalda, ref: { cadera: -m.alturaCadera, largo, anchoDelantero: anchoD, anchoEspalda: anchoE } };
}
