// Reglas de la landing "Remoto en dólares" (app/remoto-dolares). Son las mismas
// que aplica la base (supabase/20_landing_remoto_dolares.sql); aquí están para
// el modo local (sin Supabase) y para poder probarlas.

import type { Periodo, Vacante } from "./tipos.ts";

type ConSueldo = Pick<Vacante, "sueldo_min" | "sueldo_max" | "moneda" | "periodo">;

/** ¿El sueldo publicado es creíble? (hay "1 USD al mes" de relleno en algunos portales). */
export function sueldoCreible(v: ConSueldo): boolean {
  if (v.sueldo_max == null || !v.moneda) return false;
  if (v.moneda !== "USD") return v.sueldo_max > 0;
  const minimo: Record<Periodo, number> = { hora: 4, semana: 75, mes: 300, año: 5000 };
  return v.sueldo_max >= minimo[v.periodo ?? "año"];
}

/**
 * Fuera de la landing: traducciones entre idiomas que no son español/inglés
 * (nadie en México va a traducir hebreo) y trabajo de campo que dice "Remote".
 */
export function aptaRemotoDolares(titulo: string): boolean {
  const traduccion = /translat|traduc|linguist|transcri|interpret|subtitl/i.test(titulo) && !/spanish|espa[ñn]ol|english|ingl[eé]s|bilingual|biling[üu]e|latam|mexic/i.test(titulo);
  const campo = /\bfield\b|\bcampo\b|territor|on[- ]?site|presencial|in[- ]person|door[- ]to[- ]door|\bdriver\b|chofer|repartidor/i.test(titulo);
  return !traduccion && !campo;
}

const MASIVAS = new Set(["atencion-clientes", "ventas", "operaciones", "recursos-humanos", "otros", "marketing", "finanzas", "banca", "turismo"]);
const TECNICAS = new Set(["software", "datos-ia", "producto", "diseno", "seguridad"]);
const ENTRADA: Record<Vacante["nivel"], number> = { practicante: 3, junior: 3, intermedio: 2, senior: 1, gerencia: 0 };

/** Orden de la landing: con sueldo primero, luego áreas masivas y puestos de entrada, luego en español, luego lo más nuevo. */
export function compararLanding(a: Vacante, b: Vacante): number {
  const masiva = (v: Vacante) => (MASIVAS.has(v.categoria) ? 2 : TECNICAS.has(v.categoria) ? 0 : 1);
  return (
    Number(sueldoCreible(b)) - Number(sueldoCreible(a)) ||
    masiva(b) - masiva(a) ||
    ENTRADA[b.nivel] - ENTRADA[a.nivel] ||
    Number(b.idioma === "es") - Number(a.idioma === "es") ||
    b.publicada.localeCompare(a.publicada) ||
    a.id.localeCompare(b.id)
  );
}

/**
 * La misma vacante publicada en varias ciudades (mismo título + misma empresa)
 * se deja una sola vez, con `otras_ubicaciones` = cuántas más había. Se queda la
 * del país preferido (o la primera, que ya viene en el orden deseado).
 */
export function agruparRepetidas<T extends Pick<Vacante, "titulo" | "empresa_slug" | "paises">>(lista: T[], pais = "MX"): (T & { otras_ubicaciones: number })[] {
  const grupos = new Map<string, T[]>();
  for (const v of lista) {
    const k = `${v.empresa_slug}\n${v.titulo.toLowerCase()}`;
    grupos.set(k, [...(grupos.get(k) ?? []), v]);
  }
  const salida: (T & { otras_ubicaciones: number })[] = [];
  const vistos = new Set<string>();
  for (const v of lista) {
    const k = `${v.empresa_slug}\n${v.titulo.toLowerCase()}`;
    if (vistos.has(k)) continue;
    vistos.add(k);
    const grupo = grupos.get(k)!;
    const elegida = grupo.find((x) => x.paises.includes(pais)) ?? grupo[0];
    salida.push({ ...elegida, otras_ubicaciones: grupo.length - 1 });
  }
  return salida;
}

/** Sueldo al mes (min y max) en la moneda de la vacante; horas a 173 al mes. */
export function sueldoMensual(v: ConSueldo): { min: number | null; max: number | null } {
  const factor = v.periodo === "hora" ? 173 : v.periodo === "semana" ? 52 / 12 : v.periodo === "año" ? 1 / 12 : 1;
  return { min: v.sueldo_min == null ? null : v.sueldo_min * factor, max: v.sueldo_max == null ? null : v.sueldo_max * factor };
}

const redondo = (n: number) => (n >= 10_000 ? Math.round(n / 100) * 100 : n >= 100 ? Math.round(n / 10) * 10 : Math.round(n));
const cifra = (n: number) => new Intl.NumberFormat("es-MX").format(redondo(n));

/**
 * Sueldo grande para la tarjeta: "US$1,200 – 2,500 al mes" y, si es en dólares,
 * "≈ $22,000 – 46,000 MXN". `tasa` = pesos por dólar. Null si no hay sueldo creíble.
 */
export function sueldoGrande(v: ConSueldo, tasa: number): { principal: string; pesos: string | null; porHora: string | null } | null {
  if (!sueldoCreible(v)) return null;
  const m = sueldoMensual(v);
  const rango = (min: number | null, max: number | null, simbolo: string) => {
    const a = min ?? max!;
    const b = max ?? min!;
    return redondo(a) === redondo(b) ? `${simbolo}${cifra(b)}` : `${simbolo}${cifra(a)} – ${cifra(b)}`;
  };
  const simbolo = v.moneda === "USD" ? "US$" : v.moneda === "MXN" ? "$" : `${v.moneda} `;
  const principal = `${rango(m.min, m.max, simbolo)}${v.moneda === "MXN" ? " MXN" : ""} al mes`;
  const pesos = v.moneda === "USD" ? `≈ ${rango(m.min == null ? null : m.min * tasa, m.max == null ? null : m.max * tasa, "$")} MXN` : null;
  const porHora = v.periodo === "hora" ? `${rango(v.sueldo_min, v.sueldo_max, simbolo)} la hora` : null;
  return { principal, pesos, porHora };
}
