// Cálculo aproximado de sueldo neto en México (2026): ISR mensual (art. 96 LISR,
// Anexo 8 RMF 2026), subsidio para el empleo (decreto DOF 31-dic-2025) y cuotas
// obreras del IMSS. Es una estimación: cada empresa puede tener otros descuentos.

/** UMA 2026 (vigente desde el 1 de febrero de 2026). */
export const UMA_DIARIA = 117.31;
export const UMA_MENSUAL = 3566.22;

/** Tarifa mensual del ISR 2026: [límite inferior, cuota fija, % sobre excedente]. */
export const TARIFA_ISR_MENSUAL: [number, number, number][] = [
  [0.01, 0, 1.92],
  [844.6, 16.22, 6.4],
  [7168.52, 420.95, 10.88],
  [12598.03, 1011.68, 16.0],
  [14644.65, 1339.14, 17.92],
  [17533.65, 1856.84, 21.36],
  [35362.84, 5665.16, 23.52],
  [55736.69, 10457.09, 30.0],
  [106410.51, 25659.23, 32.0],
  [141880.67, 37009.69, 34.0],
  [425642.0, 133488.54, 35.0],
];

/** Subsidio para el empleo 2026: 15.02 % de la UMA mensual si la base no pasa de $11,492.66. */
export const SUBSIDIO_TOPE = 11492.66;
export const SUBSIDIO_MENSUAL = Math.round(UMA_MENSUAL * 0.1502 * 100) / 100; // ≈ 535.65

/** Cuotas obreras del IMSS (porcentaje del salario base de cotización). */
const IMSS_OBRERO_FIJO = 0.25 + 0.375 + 0.625 + 1.125; // prestaciones en dinero + gastos médicos pensionados + invalidez y vida + cesantía y vejez = 2.375 %
const IMSS_OBRERO_EXCEDENTE = 0.4; // enfermedad y maternidad, sobre lo que pasa de 3 UMA diarias
/** Factor de integración con prestaciones de ley (aguinaldo 15 días, prima vacacional 25 % de 12 días). */
const FACTOR_INTEGRACION = 1.0452;
const TOPE_SBC_DIARIO = 25 * UMA_DIARIA;

export interface Neto {
  bruto: number;
  isr: number;
  subsidio: number;
  imss: number;
  neto: number;
  /** ISR efectivo sobre el bruto, en % */
  tasaEfectiva: number;
}

export function isrMensual(base: number): number {
  if (base <= 0) return 0;
  let renglon = TARIFA_ISR_MENSUAL[0];
  for (const r of TARIFA_ISR_MENSUAL) if (base >= r[0]) renglon = r;
  const [limite, cuota, pct] = renglon;
  return Math.max(0, cuota + (base - limite) * (pct / 100));
}

export function imssObreroMensual(brutoMensual: number): number {
  const sbcDiario = Math.min((brutoMensual / 30.4) * FACTOR_INTEGRACION, TOPE_SBC_DIARIO);
  const fijo = sbcDiario * (IMSS_OBRERO_FIJO / 100);
  const excedente = Math.max(0, sbcDiario - 3 * UMA_DIARIA) * (IMSS_OBRERO_EXCEDENTE / 100);
  return (fijo + excedente) * 30.4;
}

/** Sueldo neto mensual aproximado a partir del bruto mensual. */
export function sueldoNeto(brutoMensual: number): Neto {
  const bruto = Math.max(0, brutoMensual);
  const isrBruto = isrMensual(bruto);
  const subsidio = bruto > 0 && bruto <= SUBSIDIO_TOPE ? Math.min(SUBSIDIO_MENSUAL, isrBruto) : 0;
  const isr = Math.max(0, isrBruto - subsidio);
  const imss = imssObreroMensual(bruto);
  const neto = bruto - isr - imss;
  return { bruto, isr, subsidio, imss, neto, tasaEfectiva: bruto ? (isr / bruto) * 100 : 0 };
}

/** Bruto mensual que deja aproximadamente `netoDeseado` (búsqueda numérica). */
export function brutoParaNeto(netoDeseado: number): number {
  let lo = netoDeseado;
  let hi = netoDeseado * 2 + 1000;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (sueldoNeto(mid).neto < netoDeseado) lo = mid;
    else hi = mid;
  }
  return Math.round(hi);
}

/** Sueldo mensual en pesos de una vacante, para comparar (USD → MXN con `tasaUsd` pesos por dólar). */
export function sueldoMensualMxn(v: { sueldo_min: number | null; sueldo_max: number | null; moneda: string | null; periodo: string | null }, tasaUsd: number): number | null {
  const monto = v.sueldo_max ?? v.sueldo_min;
  if (monto == null || !v.moneda) return null;
  const porMes = v.periodo === "hora" ? monto * 173 : v.periodo === "semana" ? monto * 4.33 : v.periodo === "año" ? monto / 12 : monto;
  if (v.moneda === "MXN") return porMes;
  if (v.moneda === "USD") return porMes * tasaUsd;
  return null;
}
