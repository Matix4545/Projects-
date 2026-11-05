// Bloque base de cuerpo (delantero y espalda) — sistema proporcional.
// Holgura: 10 cm en busto y 4 cm en cintura. Pinza de busto con ápice en el punto
// de busto (para poder trasladarla) y pinzas de cintura delantera y de espalda.
//
// Medidas que usa: busto, cintura, cadera, talle de espalda, cuello, ancho de
// espalda, ancho de pecho, separación de busto, altura de cadera.
import { type Pt, P, curva, dist, grados, polar, rotar, resta, suma, escalar, perp, unitario } from "../geometria.ts";
import type { Medidas } from "../medidas.ts";
import { type Pieza, type V, agregarPinza, crear, doblez, fusionarPinzas, insertar, piqueteDesdeFin, piqueteEn, trasladarPinza, v, largoTramo } from "../pieza.ts";

export type OpcionesCuerpo = {
  /** Holgura total de busto (cm). */
  holguraBusto?: number;
  /** Holgura total de cintura (cm). */
  holguraCintura?: number;
};

export type Cuerpo = {
  delantero: Pieza;
  espalda: Pieza;
  /** Puntos de referencia del trazo (coordenadas de cada pieza). */
  ref: {
    bp: Pt;
    lineaBusto: number;
    cintura: number;
    anchoTotal: number;
    sisaDelantera: number;
    sisaEspalda: number;
    /** Profundidad de sisa promedio con la pinza cerrada. */
    profundidadSisa: number;
  };
};

export function cuerpoBase(m: Medidas, o: OpcionesCuerpo = {}): Cuerpo {
  const hb = (o.holguraBusto ?? 10) / 2;
  const hc = (o.holguraCintura ?? 4) / 2;
  const B = m.busto;
  const Hw = B / 2 + hb; // medio contorno con holgura
  const yBL = -(B / 12 + 13.5); // línea de busto (fondo de sisa)
  const yW = -m.talleEspalda; // línea de cintura
  const xAE = m.anchoEspalda / 2 + 1; // línea de ancho de espalda
  const xAP = Hw - (m.anchoPecho / 2 + 0.7); // línea de ancho de pecho (desde centro delantero)
  const xCostado = (xAE + (xAP - B / 32)) / 2;

  // ── Escotes ──
  const anchoCuelloD = m.cuello / 5 - 0.3;
  const anchoCuelloE = anchoCuelloD + 0.2;
  const yTopD = yBL + B / 5 + 8.3; // línea superior del delantero (más alta: volumen del busto)
  const snpE = P(anchoCuelloE, anchoCuelloE / 3);
  const snpD = P(Hw - anchoCuelloD, yTopD);
  const cuelloD = P(Hw, yTopD - (anchoCuelloD + 0.5));

  // ── Hombros ──
  const angD = grados(22);
  const hombroD = P(xAP - 1.8, snpD.y - (snpD.x - (xAP - 1.8)) * Math.tan(angD));
  const largoHombro = dist(snpD, hombroD);
  const pinzaHombroE = B / 32 - 0.8;
  const hombroE = polar(snpE, grados(-18), largoHombro + pinzaHombroE);

  // ── Punto de busto y pinza de busto (en la sisa) ──
  const bp = P(Hw - m.separacionBusto / 2, yBL - (1.5 + (B - 80) * 0.03));
  const alfa = grados(B / 4 - 2.5);
  const G = P(xAP, yBL + (hombroD.y - yBL) * 0.55); // pata superior, sobre la línea de ancho de pecho
  const G2 = rotar(G, bp, alfa); // pata inferior

  // ── Sisas (perpendiculares al hombro arriba y al costado abajo) ──
  const sisaBajo = P(xCostado, yBL);
  const dirHombroE = unitario(resta(hombroE, snpE));
  const dirHombroD = unitario(resta(hombroD, snpD));
  const anchoE = P(xAE, (hombroE.y + yBL) / 2);
  const sisaEa = curva(hombroE, escalar(perp(dirHombroE), -1), anchoE, P(0, -1), 0.4, 0.4);
  const sisaEb = curva(anchoE, P(0, -1), sisaBajo, P(1, 0), 0.5, 0.55);
  const sisaDa = curva(hombroD, perp(dirHombroD), G, P(0, -1), 0.4, 0.4);
  const tanG2 = rotar(P(0, -1), P(0, 0), alfa);
  const sisaDb = curva(G2, tanG2, sisaBajo, P(-1, 0), 0.3, 0.55);

  // ── Escotes: perpendiculares al centro y al hombro ──
  const escoteE = curva(P(0, 0), P(1, 0), snpE, perp(dirHombroE), 0.5, 0.45);
  const escoteD = curva(snpD, perp(dirHombroD), cuelloD, P(1, 0), 0.45, 0.55);

  // ── Cintura: costados y pinzas ──
  const cinturaE = m.cintura / 4 + hc / 2 - 0.5; // espalda terminada
  const cinturaD = m.cintura / 4 + hc / 2 + 0.5; // delantero terminado
  const sobraE = xCostado - cinturaE;
  const sobraD = Hw - xCostado - cinturaD;
  const costE = Math.min(2.5, Math.max(1, sobraE * 0.35));
  const costD = Math.min(2.5, Math.max(1, sobraD * 0.35));
  const pinzaCinturaE = sobraE - costE;
  const pinzaCinturaD = sobraD - costD;

  // ── Espalda (centro espalda en x = 0) ──
  const contE: V[] = [
    { x: 0, y: yW, n: "centroCintura" },
    { x: xCostado - costE, y: yW, n: "costadoCintura" },
    { ...sisaBajo, n: "sisaBajo" },
    ...[...sisaEb].reverse().slice(1, -1),
    { ...anchoE, n: "sisaMedio" },
    ...[...sisaEa].reverse().slice(1, -1),
    { ...hombroE, n: "hombro" },
    { ...snpE, n: "cuelloHombro" },
    ...[...escoteE].reverse().slice(1, -1),
    { x: 0, y: 0, n: "centroCuello" },
  ];
  const espalda = crear("Espalda", contE, { cortar: "Cortar 1 al doblez en tela", ancla: P(0, yW) });
  // pinza de hombro (hacia el omóplato)
  const medioHombro = suma(snpE, escalar(dirHombroE, (largoHombro + pinzaHombroE) / 2));
  const apiceHombroE = suma(medioHombro, escalar(perp(dirHombroE), -7.5));
  agregarPinza(espalda, "pinzaHombro", medioHombro, apiceHombroE, pinzaHombroE, 0);
  // pinza de cintura
  const xPinzaE = (xCostado - costE) * 0.48;
  agregarPinza(espalda, "pinzaCintura", P(xPinzaE, yW), P(xPinzaE, yBL - 1), pinzaCinturaE, 0);
  doblez(espalda, "centroCuello", "centroCintura");
  espalda.hilo = [P(4, yW + 6), P(4, yBL + 6)];
  piqueteEn(espalda, "sisaBajo", "hombro", largoTramo(espalda, "sisaBajo", "hombro") * 0.33, true);

  // ── Delantero (centro delantero en x = Hw) ──
  const contD: V[] = [
    { x: Hw, y: yW, n: "centroCintura" },
    { ...cuelloD, n: "centroCuello" },
    ...[...escoteD].reverse().slice(1, -1),
    { ...snpD, n: "cuelloHombro" },
    { ...hombroD, n: "hombro" },
    ...sisaDa.slice(1, -1),
    { ...G, n: "pinzaBustoA" },
    { ...bp, n: "pinzaBusto" },
    { ...G2, n: "pinzaBustoB" },
    ...sisaDb.slice(1, -1),
    { ...sisaBajo, n: "sisaBajo" },
    { x: xCostado + costD, y: yW, n: "costadoCintura" },
  ];
  const delantero = crear("Delantero", contD, {
    cortar: "Cortar 1 al doblez en tela",
    ancla: P(Hw, yW),
    pinzas: [{ a: "pinzaBustoA", apice: "pinzaBusto", b: "pinzaBustoB", retiro: 2 }],
  });
  agregarPinza(delantero, "pinzaCintura", P(bp.x, yW), bp, pinzaCinturaD, 2.5);
  doblez(delantero, "centroCintura", "centroCuello");
  delantero.hilo = [P(Hw - 4, yW + 6), P(Hw - 4, yBL + 6)];
  delantero.marcas.push({ t: "taladro", p: bp });

  // Largos de sisa (con la pinza cerrada) para la manga
  const sisaDelantera = largoTramo(delantero, "hombro", "sisaBajo");
  const sisaEspalda = largoTramo(espalda, "sisaBajo", "hombro");
  piqueteDesdeFin(delantero, "hombro", "sisaBajo", sisaDelantera * 0.33);

  // profundidad de sisa con la pinza cerrada
  const hombroDcerrado = rotar(hombroD, bp, alfa);
  const profundidadSisa = ((hombroE.y - yBL) + (hombroDcerrado.y - yBL)) / 2;

  return {
    delantero,
    espalda,
    ref: { bp, lineaBusto: yBL, cintura: yW, anchoTotal: Hw, sisaDelantera, sisaEspalda, profundidadSisa },
  };
}

export type LugarPinza = "costado" | "hombro" | "sisa" | "cintura" | "francesa" | "centro" | "escote";

/** Delantero con la pinza de busto trasladada a otro lugar (cortar y girar con centro en el punto de busto). */
export function delanteroConPinza(c: Cuerpo, lugar: LugarPinza): Pieza {
  if (lugar === "sisa") return structuredClone(c.delantero);
  const d = structuredClone(c.delantero);
  const { bp } = c.ref;
  const enTramo = (a: string, b: string, t: number) => {
    const pa = v(d, a);
    const pb = v(d, b);
    return suma(pa, escalar(resta(pb, pa), t));
  };
  let destino: string;
  switch (lugar) {
    case "costado":
      destino = insertar(d, "pinzaNueva", P(v(d, "sisaBajo").x + 0.4, v(d, "sisaBajo").y - 5));
      break;
    case "hombro":
      destino = insertar(d, "pinzaNueva", enTramo("cuelloHombro", "hombro", 0.45));
      break;
    case "cintura":
      destino = "pinzaCinturaA"; // se suma a la pinza de cintura
      break;
    case "francesa":
      destino = insertar(d, "pinzaNueva", enTramo("costadoCintura", "sisaBajo", 0.22));
      break;
    case "centro":
      destino = insertar(d, "pinzaNueva", P(c.ref.anchoTotal, bp.y));
      break;
    case "escote":
      destino = insertar(d, "pinzaNueva", enTramo("cuelloHombro", "centroCuello", 0.5));
      break;
  }
  let r = trasladarPinza(d, "pinzaBusto", destino, { nombre: "pinzaBusto", retiro: lugar === "francesa" ? 3 : 2 });
  if (lugar === "cintura") r = fusionarPinzas(r, "pinzaBusto", "pinzaCintura", "pinzaBusto");
  return r;
}
