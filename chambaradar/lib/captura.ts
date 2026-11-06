// Llena los campos de una vacante a partir del texto pegado de una publicación
// (p. ej. de un grupo de empleo). Es una ayuda: el administrador revisa y corrige
// todo antes de publicar. Funciones puras para poder probarlas.

import { detectarCategoria, plano } from "./normalizar.ts";
import type { Categoria, Modalidad } from "./tipos.ts";

export interface DatosVacante {
  empresa: string;
  puesto: string;
  categoria: Categoria;
  modalidad: Modalidad;
  ubicacion: string;
  sueldo_min: number | null;
  sueldo_max: number | null;
  periodo: "hora" | "semana" | "mes" | "año" | null;
  horario: string;
  descripcion: string;
  contacto_whatsapp: string;
  contacto_correo: string;
  contacto_url: string;
}

const EMOJIS = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu;

function limpiarLinea(l: string): string {
  return l.replace(EMOJIS, " ").replace(/[*_•▪►✅✔️☑️📌📍👉]+/g, " ").replace(/\s+/g, " ").trim();
}

function aNumero(s: string): number {
  const n = Number(s.replace(/[,\s]/g, "").replace(/\.(?=\d{3}\b)/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Primer número de teléfono mexicano de 10 dígitos (con o sin +52, espacios, guiones o paréntesis). */
export function extraerTelefono(texto: string): string {
  for (const m of texto.matchAll(/(?:\+?\s*52[\s.-]*)?(?:1[\s.-]*)?\(?(\d{3})\)?[\s.-]*(\d{3})[\s.-]*(\d{4})\b/g)) {
    const d = `${m[1]}${m[2]}${m[3]}`;
    if (!/^(\d)\1{9}$/.test(d)) return d;
  }
  return "";
}

/** "$2,500 a $3,000 semanales", "Sueldo: 9000 mensual", "$150 por hora", "$600 diarios"… */
export function extraerSueldo(texto: string): Pick<DatosVacante, "sueldo_min" | "sueldo_max" | "periodo"> {
  const t = plano(texto);
  const m = t.match(
    /(?:sueldo|salario|pago|pagamos|ofrecemos|ganancias?)?[^\d$\n]{0,15}\$?\s?(\d{1,3}(?:[,.]\d{3})+|\d{3,6})(?:\s*(?:-|a|–|al|hasta)\s*\$?\s?(\d{1,3}(?:[,.]\d{3})+|\d{3,6}))?\s*(?:pesos|mxn)?\s*(semanal(?:es)?|por semana|a la semana|quincenal(?:es)?|por quincena|mensual(?:es)?|al mes|por mes|diari[oa]s?|por dia|al dia|por hora|la hora)?/,
  );
  if (!m || (!/\$|sueldo|salario|pago|pagamos|ofrecemos|ganancia/.test(t))) return { sueldo_min: null, sueldo_max: null, periodo: null };
  // Debe parecer dinero: tiene "$" o la palabra sueldo/salario cerca
  const ventana = t.slice(Math.max(0, (m.index ?? 0) - 25), (m.index ?? 0) + m[0].length);
  if (!/\$|sueldo|salario|pago|ofrecemos|ganancia/.test(ventana)) return { sueldo_min: null, sueldo_max: null, periodo: null };
  let min = aNumero(m[1]);
  let max = m[2] ? aNumero(m[2]) : null;
  // El periodo puede ir después ("$4,500 quincenales") o antes ("pago quincenal de $4,500")
  const p = m[3] ?? ventana.match(/semanal|quincenal|mensual|diari[oa]|por hora/)?.[0] ?? "";
  let periodo: DatosVacante["periodo"] = /seman/.test(p) ? "semana" : /quincen/.test(p) ? "mes" : /mes|mensual/.test(p) ? "mes" : /dia|diari/.test(p) ? "semana" : /hora/.test(p) ? "hora" : null;
  if (/quincen/.test(p)) {
    min *= 2;
    if (max) max *= 2;
  }
  if (/dia|diari/.test(p)) {
    min *= 6;
    if (max) max *= 6;
  }
  if (!periodo) periodo = (max ?? min) < 20_000 ? "semana" : "mes";
  if (min < 50) return { sueldo_min: null, sueldo_max: null, periodo: null };
  return { sueldo_min: min, sueldo_max: max && max > min ? max : null, periodo };
}

const PALABRAS_PUESTO =
  /(?:se\s+solicita[n]?|solicitamos|se\s+busca[n]?|buscamos|estamos\s+contratando|contratando|vacante(?:s)?(?:\s+de)?|se\s+necesita[n]?|necesitamos|ofrecemos\s+empleo\s+de|empleo\s+de)\s*:?\s*/i;

export function extraerPuesto(lineas: string[]): string {
  for (const [i, l] of lineas.entries()) {
    // "SE SOLICITA:" solo en su línea: el puesto viene en la siguiente
    if (new RegExp(`^${PALABRAS_PUESTO.source}$`, "i").test(l) && lineas[i + 1]) return capitalizar(lineas[i + 1].replace(/[!.:]+$/g, ""));
    const m = l.match(new RegExp(`${PALABRAS_PUESTO.source}(.{3,80})`, "i"));
    if (m) {
      const p = m[1].replace(/\b(para|en)\s+(trabajar|laborar)\b.*$/i, "").replace(/[!.:¡]+$/g, "").trim();
      if (p.length >= 3 && !/^(personal|urgente)$/i.test(p)) return capitalizar(p);
      if (lineas[i + 1]) return capitalizar(lineas[i + 1].replace(/[!.:]+$/g, ""));
    }
  }
  return capitalizar((lineas.find((l) => l.length >= 4 && !/^(urgente|hola|buen[oa]s)/i.test(l)) ?? "").slice(0, 80));
}

function capitalizar(t: string): string {
  const s = t.trim();
  if (!s) return s;
  const letras = s.replace(/[^\p{L}]/gu, "");
  const base = letras && letras === letras.toUpperCase() ? s.toLowerCase() : s;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export function extraerEmpresa(lineas: string[], texto: string): string {
  const m = texto.match(/(?:empresa|negocio|restaurante|tienda|sucursal|agencia|cl[ií]nica|grupo)\s*:\s*([^\n,]{2,60})/i);
  if (m) return capitalizar(m[1]);
  const conRazon = lineas.find((l) => /\b(s\.?a\.?(\s+de\s+c\.?v\.?)?|s\. de r\.l\.|sapi)\b/i.test(l));
  if (conRazon) return conRazon.slice(0, 80);
  return "";
}

export function extraerHorario(texto: string): string {
  const m =
    texto.match(/horarios?\s*:?\s*([^\n]{4,80})/i) ??
    texto.match(/((?:lunes|l)\s*a\s*(?:viernes|s[aá]bado|v|s)[^\n]{0,60})/i) ??
    texto.match(/(turnos?\s+[^\n]{3,60})/i);
  return m ? limpiarLinea(m[1]) : "";
}

export function extraerUbicacion(texto: string): string {
  const t = plano(texto);
  if (/home office|trabajo remoto|desde casa|100% remoto/.test(t)) return "Remoto";
  for (const [patron, nombre] of [
    [/navojoa/, "Navojoa, Sonora"],
    [/hermosillo/, "Hermosillo, Sonora"],
    [/guaymas/, "Guaymas, Sonora"],
    [/empalme/, "Empalme, Sonora"],
    [/esperanza/, "Esperanza, Cajeme, Sonora"],
    [/pueblo yaqui/, "Pueblo Yaqui, Cajeme, Sonora"],
    [/bacum/, "Bácum, Sonora"],
  ] as const) {
    if (patron.test(t)) return nombre;
  }
  return "Cd. Obregón, Sonora";
}

/** Lee el texto pegado y propone todos los campos. */
export function leerPublicacion(texto: string): DatosVacante {
  const lineas = texto.split(/\n+/).map(limpiarLinea).filter(Boolean);
  const plano_ = plano(texto);
  const puesto = extraerPuesto(lineas);
  return {
    empresa: extraerEmpresa(lineas, texto),
    puesto,
    categoria: detectarCategoria(puesto),
    modalidad: /home office|remoto|desde casa/.test(plano_) ? "remoto" : /hibrid/.test(plano_) ? "hibrido" : "presencial",
    ubicacion: extraerUbicacion(texto),
    ...extraerSueldo(texto),
    horario: extraerHorario(texto),
    descripcion: lineas.join("\n").slice(0, 4000),
    contacto_whatsapp: extraerTelefono(texto),
    contacto_correo: texto.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0]?.toLowerCase() ?? "",
    contacto_url: texto.match(/https?:\/\/[^\s)]+/)?.[0] ?? "",
  };
}
