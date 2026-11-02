// Planes de acceso. Son pagos únicos (no suscripción) para poder aceptar
// OXXO además de tarjeta: mucha gente en México no tiene tarjeta de crédito.

export interface Plan {
  id: "semana" | "mes" | "anio";
  nombre: string;
  /** Precio en pesos mexicanos */
  precio: number;
  dias: number;
  nota: string;
  destacado?: boolean;
}

export const PLANES: Plan[] = [
  { id: "semana", nombre: "1 semana", precio: 49, dias: 7, nota: "Para probar" },
  { id: "mes", nombre: "1 mes", precio: 129, dias: 30, nota: "El más elegido", destacado: true },
  { id: "anio", nombre: "1 año", precio: 699, dias: 365, nota: "Ahorras 55 %" },
];

export function buscarPlan(id: string | null | undefined): Plan | undefined {
  return PLANES.find((p) => p.id === id);
}

/**
 * Enlace de pago de Stripe (Payment Link) de cada plan. Se configuran en las
 * variables STRIPE_ENLACE_SEMANA, STRIPE_ENLACE_MES y STRIPE_ENLACE_ANIO.
 * Mientras no existan, los pagos aparecen como "próximamente".
 */
export function enlaceDePago(plan: Plan): string | null {
  const v = process.env[`STRIPE_ENLACE_${plan.id.toUpperCase()}`];
  return v && v.startsWith("https://") ? v : null;
}

export function pagosActivos(): boolean {
  return PLANES.some((p) => enlaceDePago(p) !== null);
}

/** El webhook reconoce el plan por el monto cobrado (en centavos de MXN). */
export function planPorMonto(centavos: number | null | undefined): Plan | undefined {
  return PLANES.find((p) => p.precio * 100 === centavos);
}
