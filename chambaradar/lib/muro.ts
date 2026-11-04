// Muro de pago. Quien no ha pagado ve el puesto, el sueldo, la ubicación y
// la fecha, pero el nombre de la empresa y la descripción llegan revueltos
// desde el servidor y sin enlace. Así no se pueden "destapar" desde el navegador.

import type { Vacante } from "./tipos.ts";

export type VacanteVista = Omit<Vacante, "url" | "empresa_nombre" | "empresa_slug" | "descripcion"> & {
  url: string | null;
  empresa_nombre: string;
  empresa_slug: string | null;
  descripcion: string;
  bloqueada: boolean;
};

const LETRAS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** Generador pseudoaleatorio con semilla, para que el texto revuelto no cambie en cada visita. */
function generador(semilla: string) {
  let h = 2166136261;
  for (let i = 0; i < semilla.length; i++) h = Math.imul(h ^ semilla.charCodeAt(i), 16777619);
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 1_000_000) / 1_000_000;
  };
}

/** Cambia cada letra por otra al azar; conserva espacios y saltos de línea. */
export function revolver(texto: string, semilla: string): string {
  const azar = generador(semilla);
  return texto.replace(/[^\s•.,]/g, () => LETRAS[Math.floor(azar() * LETRAS.length)]);
}

/** Algunas empresas ponen su nombre en el título ("Account Executive - Stripe"); se tapa. */
export function taparEmpresa(texto: string, v: Pick<Vacante, "empresa_nombre" | "empresa_slug">): string {
  // "Wellhub (Gympass)" → "Wellhub (Gympass)", "Wellhub", "Gympass" y el slug
  const alias = v.empresa_nombre.match(/\(([^)]+)\)/)?.[1] ?? "";
  const nombres = [v.empresa_nombre, v.empresa_nombre.replace(/\s*\(.*\)\s*/, ""), alias, v.empresa_slug]
    .map((n) => n.trim())
    .filter((n) => n.length >= 3);
  let t = texto;
  for (const n of nombres) {
    const escapado = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Solo palabras completas: "Clara" no debe tapar "declaración"
    t = t.replace(new RegExp(`(^|[^\\p{L}\\p{N}])${escapado}(?![\\p{L}\\p{N}])`, "giu"), "$1•••");
  }
  return t;
}

/** Siempre completas para todos: las vacantes que publican los negocios directo. */
export function esGratis(v: Vacante): boolean {
  return v.id.startsWith("directa:");
}

/** Lo que ve quien no tiene plan en lugar del nombre de la empresa. Nunca lleva el nombre real. */
export function etiquetaOculta(tipo: Vacante["empresa_tipo"]): string {
  return tipo === "remoto" ? "Empresa extranjera" : "Empresa oculta";
}

export function vistaDeVacante(v: Vacante, conAcceso: boolean): VacanteVista {
  if (conAcceso || esGratis(v)) return { ...v, bloqueada: false };
  return {
    ...v,
    titulo: taparEmpresa(v.titulo, v),
    ubicacion: taparEmpresa(v.ubicacion, v),
    // El id real lleva el nombre de la empresa ("stripe:123"), así que también se oculta
    id: `v${Math.floor(generador(v.id)() * 1e12).toString(36)}`,
    url: null,
    empresa_slug: null,
    empresa_nombre: etiquetaOculta(v.empresa_tipo),
    descripcion: revolver(v.descripcion.slice(0, 280), `${v.id}:d`),
    bloqueada: true,
  };
}

/** Fila como la devuelve buscar_empleos() en Supabase (ya bloqueada o no por la base). */
export type FilaBase = Omit<Vacante, "url" | "empresa_nombre" | "empresa_slug" | "descripcion"> & {
  url: string | null;
  empresa_nombre: string | null;
  empresa_slug: string | null;
  descripcion: string | null;
  bloqueada: boolean;
  largo_empresa?: number;
  largo_descripcion?: number;
};

/**
 * La base ya quitó la empresa, el enlace y la descripción de las filas
 * bloqueadas; aquí solo se rellenan con texto al azar del mismo largo para
 * que la tarjeta se vea igual (borrosa).
 */
export function vistaDesdeBase(f: FilaBase): VacanteVista {
  if (!f.bloqueada) return { ...f, empresa_nombre: f.empresa_nombre ?? "", descripcion: f.descripcion ?? "", bloqueada: false };
  const relleno = (n: number) => "x".repeat(Math.max(1, n)).replace(/x{6}/g, (m) => `${m} `);
  return {
    ...f,
    url: null,
    empresa_slug: null,
    empresa_nombre: etiquetaOculta(f.empresa_tipo),
    descripcion: f.largo_descripcion ? revolver(relleno(Math.min(f.largo_descripcion, 280)), `${f.id}:d`) : "",
    bloqueada: true,
  };
}
