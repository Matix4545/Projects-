// Calculadora "¿Cuánto te cuestan los baches?" (/herramientas/costo-baches). Usa el mismo método
// y los mismos supuestos que la estimación de /estadisticas (lib/economia.ts), pero para UN auto.
import { costoExtraPorKm, type Escenario } from "../economia.ts";

/** Estado de las calles por donde manejas → IRI aproximado (m/km). DGST: bueno < 2.5, no satisfactorio > 3.5 */
export const ESTADOS_CALLE = [
  { id: "regulares", nombre: "Con algunos baches", iri: 4 },
  { id: "malas", nombre: "Malas", iri: 6 },
  { id: "muy_malas", nombre: "Muy malas (baches por todos lados)", iri: 8 },
] as const;
export type EstadoCalle = (typeof ESTADOS_CALLE)[number]["id"];

export const PORCENTAJES = [25, 50, 75, 100] as const;

export type CostoAnual = {
  kmMalosAnio: number;
  porEscenario: Record<Escenario, { total: number; gasolina: number; llantas: number; reparaciones: number }>;
};

/** Costo extra al año (pesos) por manejar `kmSemana` km, de los que `pctMalas` % son por calles en ese estado */
export function costoAnual(kmSemana: number, pctMalas: number, estado: EstadoCalle): CostoAnual {
  const iri = ESTADOS_CALLE.find((e) => e.id === estado)?.iri ?? 4;
  const km = Math.max(0, kmSemana) * 52 * (Math.min(Math.max(pctMalas, 0), 100) / 100);
  const porEscenario = {} as CostoAnual["porEscenario"];
  for (const e of ["bajo", "medio", "alto"] as const) {
    const c = costoExtraPorKm(iri, e);
    porEscenario[e] = { total: c.total * km, gasolina: c.gasolina * km, llantas: c.llantas * km, reparaciones: c.reparaciones * km };
  }
  return { kmMalosAnio: km, porEscenario };
}

/** 1234.5 → "$1,235" */
export const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`;
