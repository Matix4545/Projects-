// Formato de precios y conversión aproximada (funciona en navegador y servidor).
import { PAISES, TIENDA, type Pais } from "./config.ts";
export type Tasas = Record<string, number>; // unidades por 1 USD

export function paisPorCodigo(codigo: string): Pais {
  return PAISES.find((p) => p.codigo === codigo) ?? PAISES[0];
}

export function formatear(cantidad: number, moneda: string, decimales: 0 | 2 = 0, locale = "es-MX"): string {
  const texto = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: moneda,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(cantidad);
  return texto.includes("$") ? `${texto} ${moneda}` : texto;
}

/** Precio en la moneda de cobro, ej. "$129 MXN". */
export function formatearCobro(cantidad: number): string {
  return formatear(cantidad, TIENDA.monedaCobro, 0);
}

/** Convierte de la moneda de cobro a la del país y redondea a un número "limpio". */
export function convertir(cantidad: number, pais: Pais, tasas: Tasas): number {
  const origen = tasas[TIENDA.monedaCobro];
  const destino = tasas[pais.moneda];
  if (!origen || !destino) return NaN;
  const valor = (cantidad / origen) * destino;
  if (pais.decimales === 2) return Math.round(valor * 100) / 100;
  if (valor >= 10000) return Math.round(valor / 100) * 100;
  if (valor >= 1000) return Math.round(valor / 10) * 10;
  return Math.round(valor);
}
