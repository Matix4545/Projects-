import type { Periodo } from "./tipos.ts";

const PERIODO: Record<Periodo, string> = { hora: "hora", mes: "mes", "año": "año" };

function cifra(n: number, moneda: string): string {
  const compacto = n >= 10_000;
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: moneda,
    currencyDisplay: "narrowSymbol",
    notation: compacto ? "compact" : "standard",
    // $170 k, $138.7 k → $139 k; montos chicos sin decimales
    ...(compacto ? { maximumSignificantDigits: 3 } : { maximumFractionDigits: 0 }),
  }).format(n);
}

/** "$120 mil – $140 mil USD al año" */
export function formatoSueldo(min: number | null, max: number | null, moneda: string | null, periodo: Periodo | null): string | null {
  if (!moneda || (min == null && max == null)) return null;
  try {
    const partes = [min, max].filter((n): n is number => n != null);
    const rango = min != null && max != null && min !== max ? `${cifra(min, moneda)} – ${cifra(max, moneda)}` : cifra(partes[0], moneda);
    return `${rango} ${moneda} al ${PERIODO[periodo ?? "año"]}`;
  } catch {
    return null;
  }
}

/** "hoy", "ayer", "hace 3 días", "hace 2 semanas"… */
export function haceCuanto(fecha: string, ahora = new Date()): string {
  const dias = Math.floor((ahora.getTime() - new Date(fecha).getTime()) / 86_400_000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 7) return `hace ${dias} días`;
  if (dias < 30) return `hace ${Math.floor(dias / 7)} sem.`;
  if (dias < 365) return `hace ${Math.floor(dias / 30)} meses`;
  return "hace más de un año";
}

export function numero(n: number): string {
  return new Intl.NumberFormat("es-MX").format(n);
}
