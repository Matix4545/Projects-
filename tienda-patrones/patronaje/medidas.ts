// Medidas del cuerpo (cm). Tabla de tallas de mujer XS–4XL para estatura de 1.60 m
// y cálculo de medidas faltantes para patrones a la medida.

export type Medidas = {
  talla: string;
  estatura: number;
  busto: number;
  cintura: number;
  cadera: number;
  /** Nuca a cintura por la espalda. */
  talleEspalda: number;
  cuello: number;
  /** Ancho de espalda (de sisa a sisa, a media altura). */
  anchoEspalda: number;
  /** Ancho de pecho (de sisa a sisa por delante, arriba del busto). */
  anchoPecho: number;
  hombro: number;
  /** Distancia entre los dos puntos de busto. */
  separacionBusto: number;
  /** Cintura a la línea de cadera. */
  alturaCadera: number;
  /** Hombro a muñeca con el brazo ligeramente doblado. */
  largoBrazo: number;
  /** Contorno de brazo (bíceps). */
  brazo: number;
  muneca: number;
  /** Tiro: de la cintura al asiento, sentada. */
  tiro: number;
  /** Entrepierna: de la entrepierna al piso. */
  largoPierna: number;
  rodilla: number;
  tobillo: number;
  /** Cintura a rodilla. */
  largoRodilla: number;
};

export const CLAVES: (keyof Omit<Medidas, "talla">)[] = [
  "estatura", "busto", "cintura", "cadera", "talleEspalda", "cuello", "anchoEspalda", "anchoPecho", "hombro",
  "separacionBusto", "alturaCadera", "largoBrazo", "brazo", "muneca", "tiro", "largoPierna", "rodilla", "tobillo", "largoRodilla",
];

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Completa las medidas que falten a partir de busto, cintura, cadera y estatura. */
export function completar(base: Partial<Medidas> & { busto: number; cintura: number; cadera: number }): Medidas {
  const e = base.estatura ?? 160;
  const B = base.busto;
  const H = base.cadera;
  const k = e / 160; // ajuste de largos por estatura
  const calc: Medidas = {
    talla: base.talla ?? "a medida",
    estatura: e,
    busto: B,
    cintura: base.cintura,
    cadera: H,
    talleEspalda: r1((38 + (B - 80) * 0.065) * k),
    cuello: r1(22.2 + B * 0.168),
    anchoEspalda: r1(22.5 + B * 0.135),
    anchoPecho: r1(19 + B * 0.15),
    hombro: r1(11.8 + (B - 80) * 0.02),
    separacionBusto: r1(9 + B * 0.1),
    alturaCadera: r1((19 + (B - 80) * 0.02) * k),
    largoBrazo: r1((56 + (B - 80) * 0.02) * k),
    brazo: r1(7.5 + B * 0.24),
    muneca: r1(15 + (B - 80) * 0.05),
    tiro: r1((17.5 + H * 0.1) * Math.sqrt(k)),
    largoPierna: r1(72 * k),
    rodilla: r1(12 + H * 0.25),
    tobillo: r1(21 + (H - 86) * 0.05),
    largoRodilla: r1((56 + (H - 86) * 0.02) * k),
  };
  const r = { ...calc };
  for (const c of CLAVES) {
    const v = base[c];
    if (typeof v === "number" && v > 0) (r as Record<string, number | string>)[c] = v;
  }
  if (base.talla) r.talla = base.talla;
  return r;
}

/** Tabla de tallas (medidas del cuerpo). Coincide con la tabla publicada en la tienda. */
export const TALLAS: Medidas[] = [
  { talla: "XS", busto: 80, cintura: 62, cadera: 86 },
  { talla: "S", busto: 84, cintura: 66, cadera: 90 },
  { talla: "M", busto: 90, cintura: 72, cadera: 96 },
  { talla: "L", busto: 96, cintura: 78, cadera: 102 },
  { talla: "XL", busto: 102, cintura: 84, cadera: 108 },
  { talla: "2XL", busto: 110, cintura: 92, cadera: 116 },
  { talla: "3XL", busto: 118, cintura: 100, cadera: 124 },
  { talla: "4XL", busto: 126, cintura: 108, cadera: 132 },
].map((t) => completar(t));

export function talla(nombre: string): Medidas {
  const t = TALLAS.find((x) => x.talla.toLowerCase() === nombre.toLowerCase());
  if (!t) throw new Error(`Talla desconocida: ${nombre}. Usa ${TALLAS.map((x) => x.talla).join(", ")}`);
  return t;
}
