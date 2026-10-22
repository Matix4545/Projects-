// Días sin resolver y semáforo de urgencia de un reporte.
import type { Pin } from "./datos";

const DIA_MS = 86_400_000;

/** Días completos entre dos fechas (0 = el mismo día). */
export function diasEntre(desde: string, hasta: string | number = Date.now()) {
  const fin = typeof hasta === "number" ? hasta : new Date(hasta).getTime();
  return Math.max(0, Math.floor((fin - new Date(desde).getTime()) / DIA_MS));
}

export type NivelUrgencia = "reciente" | "rezago" | "critico" | "resuelto";

const plural = (n: number) => `${n} ${n === 1 ? "día" : "días"}`;

/**
 * Semáforo: 0–7 días ámbar, 8–30 naranja, más de 30 rojo.
 * Si ya lo arreglaron: cuánto tardó.
 */
export function urgencia(
  pin: Pick<Pin, "estado" | "creado_en" | "arreglado_en">,
  ahora = Date.now(),
): { nivel: NivelUrgencia; dias: number; texto: string } {
  if (pin.estado === "arreglado") {
    const dias = diasEntre(pin.creado_en, pin.arreglado_en ?? ahora);
    return { nivel: "resuelto", dias, texto: dias === 0 ? "Resuelto el mismo día" : `Resuelto en ${plural(dias)}` };
  }
  const dias = diasEntre(pin.creado_en, ahora);
  if (dias > 30) return { nivel: "critico", dias, texto: `Lleva ${plural(dias)} sin atención` };
  if (dias > 7) return { nivel: "rezago", dias, texto: `${plural(dias)} sin resolver` };
  return { nivel: "reciente", dias, texto: dias === 0 ? "Reportado hoy" : `${plural(dias)} sin resolver` };
}

/** Folio público del reporte, p. ej. RC-00042 */
export const folio = (id: number) => `RC-${String(id).padStart(5, "0")}`;
