// Precio aproximado en la moneda de cada país, solo para mostrar. El cobro
// sigue siendo el mismo plan en pesos mexicanos: Stripe (Adaptive Pricing) lo
// cobra en la moneda local donde puede; donde no, el banco hace la conversión.

/** Moneda más usada en cada país (El Salvador, Panamá y Ecuador usan dólares). */
export const MONEDA_PAIS: Record<string, string> = {
  MX: "MXN",
  PE: "PEN",
  GT: "GTQ",
  HN: "HNL",
  SV: "USD",
  NI: "NIO",
  CR: "CRC",
  PA: "USD",
  DO: "DOP",
  CO: "COP",
  EC: "USD",
  BO: "BOB",
  PY: "PYG",
  UY: "UYU",
  VE: "USD",
  AR: "ARS",
  CL: "CLP",
};

/** Países donde Stripe cobra directo en su moneda (lista de Adaptive Pricing de Stripe). */
const STRIPE_EN_MONEDA_LOCAL = new Set(["PE", "GT", "HN", "CR", "PA", "DO", "CO", "BO", "PY", "UY", "CL", "BR"]);

const NOMBRE_MONEDA: Record<string, string> = {
  PEN: "soles",
  GTQ: "quetzales",
  HNL: "lempiras",
  USD: "dólares",
  NIO: "córdobas",
  CRC: "colones",
  DOP: "pesos dominicanos",
  COP: "pesos colombianos",
  BOB: "bolivianos",
  PYG: "guaraníes",
  UYU: "pesos uruguayos",
  ARS: "pesos argentinos",
  CLP: "pesos chilenos",
};

/** Pesos mexicanos → otra moneda (respaldo si no responde el servicio de tipo de cambio). Noviembre 2026. */
const RESPALDO: Record<string, number> = {
  PEN: 0.185, GTQ: 0.411, HNL: 1.447, USD: 0.0533, NIO: 1.98, CRC: 24.4, DOP: 3.25, COP: 173, BOB: 0.651, PYG: 318, UYU: 2.16, ARS: 70, CLP: 50,
};

/** La conversión de Stripe incluye una comisión (~2-4 %): se redondea hacia arriba con 3 % para no prometer de menos. */
const MARGEN = 1.03;

async function tipos(): Promise<Record<string, number>> {
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/MXN", { next: { revalidate: 43_200 }, signal: AbortSignal.timeout(2500) });
    if (!r.ok) return RESPALDO;
    const d = (await r.json()) as { result?: string; rates?: Record<string, number> };
    return d.result === "success" && d.rates ? { ...RESPALDO, ...d.rates } : RESPALDO;
  } catch {
    return RESPALDO;
  }
}

/** "S/ 9", "Q20", "US$2.70", "L71" (redondeado hacia arriba). */
export function formatoMoneda(monto: number, moneda: string): string {
  const decimales = moneda === "USD" ? 2 : 0;
  const factor = 10 ** decimales;
  const redondo = Math.ceil(monto * factor) / factor;
  const simbolo: Record<string, string> = { PEN: "S/ ", GTQ: "Q", HNL: "L", USD: "US$", NIO: "C$", CRC: "₡", DOP: "RD$", COP: "COL$", BOB: "Bs ", PYG: "₲", UYU: "$U ", ARS: "AR$", CLP: "CLP$" };
  const numero = redondo.toLocaleString("es-MX", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
  return `${simbolo[moneda] ?? `${moneda} `}${numero}`;
}

/** Pesos mexicanos por una unidad de `moneda` (por ejemplo, pesos por dólar). */
export async function pesosPor(moneda: string): Promise<number> {
  const tasa = (await tipos())[moneda];
  return tasa ? 1 / tasa : 1 / (RESPALDO[moneda] ?? 1);
}

/** "≈ S/ 25" para un monto en MXN, o null en México / país sin moneda conocida. */
export async function aproximadoLocal(pais: string | null | undefined, mxn: number): Promise<string | null> {
  const moneda = pais ? MONEDA_PAIS[pais] : undefined;
  if (!pais || pais === "MX" || !moneda) return null;
  const tasa = (await tipos())[moneda];
  return tasa ? `≈ ${formatoMoneda(mxn * tasa * MARGEN, moneda)}` : null;
}

/** Nombre de la moneda del país ("soles"), para los textos. */
export function nombreMoneda(pais: string | null | undefined): string | null {
  const m = pais ? MONEDA_PAIS[pais] : undefined;
  return m && pais !== "MX" ? (NOMBRE_MONEDA[m] ?? m) : null;
}

export interface PreciosLocales {
  /** "$49" en México, "≈ S/ 10" afuera */
  semana: string;
  mes: string;
  /** Aclaración del cobro afuera de México; vacío en México */
  nota: string;
  /** ¿Hay OXXO? (solo México) */
  oxxo: boolean;
  /** "ahorras $67" en México, "ahorras 34 %" afuera (el plan de 1 mes frente a 4 semanas) */
  ahorroMes: string;
}

/** ¿Se puede pagar en OXXO? Solo en México (o cuando no sabemos el país: casi todo el tráfico es de México). */
export const hayOxxo = (pais: string | null | undefined) => !pais || pais === "MX";

/** Precios para mostrar a un visitante de `pais` (null o México: en pesos, con OXXO). */
export async function preciosPara(pais: string | null | undefined, semanaMxn: number, mesMxn: number): Promise<PreciosLocales> {
  const moneda = pais ? MONEDA_PAIS[pais] : undefined;
  const ahorroPesos = semanaMxn * 4 - mesMxn;
  const ahorroPct = `ahorras ${Math.round((ahorroPesos / (semanaMxn * 4)) * 100)} %`;
  if (!pais || pais === "MX" || !moneda) return { semana: `$${semanaMxn}`, mes: `$${mesMxn}`, nota: "", oxxo: hayOxxo(pais), ahorroMes: `ahorras $${ahorroPesos}` };
  const tasa = (await tipos())[moneda];
  if (!tasa) return { semana: `$${semanaMxn} MXN`, mes: `$${mesMxn} MXN`, nota: "", oxxo: false, ahorroMes: ahorroPct };
  const local = (mxn: number) => `≈ ${formatoMoneda(mxn * tasa * MARGEN, moneda)}`;
  const nota = STRIPE_EN_MONEDA_LOCAL.has(pais)
    ? `$${semanaMxn} pesos mexicanos; pagas en ${NOMBRE_MONEDA[moneda] ?? moneda}`
    : `$${semanaMxn} pesos mexicanos; tu banco lo convierte a ${NOMBRE_MONEDA[moneda] ?? moneda}`;
  return { semana: local(semanaMxn), mes: local(mesMxn), nota, oxxo: false, ahorroMes: ahorroPct };
}
