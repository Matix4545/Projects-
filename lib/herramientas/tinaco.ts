// Calculadora "¿Cuántos días me dura el agua?" (/herramientas/tinaco). Todo se calcula en el
// celular; no se guarda nada.

/** Litros por persona al día dentro de la casa. Estimaciones redondas, no datos de OOMAPASC */
export const CONSUMOS = [
  { id: "normal", nombre: "Normal", litros: 150, nota: "Regadera diaria, lavadora y trastes como siempre" },
  { id: "cuidando", nombre: "Cuidando el agua", litros: 100, nota: "Baños cortos, cubeta en el excusado, lavadora llena" },
  { id: "minimo", nombre: "Solo lo indispensable", litros: 50, nota: "Beber, cocinar, aseo con jícara y excusado con cubeta" },
] as const;
export type Consumo = (typeof CONSUMOS)[number]["id"];

/** Tamaños comunes de tinaco y cisterna, en litros */
export const CAPACIDADES = [450, 600, 750, 1100, 2500, 5000] as const;

export const NIVELES = [
  { nombre: "Lleno", fraccion: 1 },
  { nombre: "3/4", fraccion: 0.75 },
  { nombre: "La mitad", fraccion: 0.5 },
  { nombre: "1/4", fraccion: 0.25 },
] as const;

/** Días que alcanza el agua guardada (0 si algún dato no tiene sentido) */
export function diasDeAgua(litros: number, personas: number, litrosPorPersona: number): number {
  if (!(litros > 0) || !(personas > 0) || !(litrosPorPersona > 0)) return 0;
  return litros / (personas * litrosPorPersona);
}

/** 0.4 → "unas 10 horas" · 2.6 → "2 días y medio" · 12.2 → "12 días" */
export function textoDias(dias: number): string {
  if (!(dias > 0)) return "nada";
  if (dias < 1) {
    const horas = Math.max(1, Math.round(dias * 24));
    return horas === 1 ? "una hora" : `unas ${horas} horas`;
  }
  if (dias >= 10) return `${Math.round(dias)} días`;
  const medios = Math.round(dias * 2) / 2;
  const enteros = Math.floor(medios);
  const medio = medios % 1 !== 0;
  if (enteros === 1) return medio ? "un día y medio" : "un día";
  return medio ? `${enteros} días y medio` : `${enteros} días`;
}
