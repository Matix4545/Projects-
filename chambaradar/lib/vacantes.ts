import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { vistaDeVacante, vistaDesdeBase, type FilaBase, type VacanteVista } from "./muro.ts";
import { supabaseConfigurado, supabaseSesion } from "./supabase/servidor.ts";
import { CATEGORIAS, NIVELES, PAISES, type Categoria, type Modalidad, type Nivel, type Vacante } from "./tipos.ts";

export const POR_PAGINA = 20;

export interface Filtros {
  q: string;
  categoria: Categoria | "";
  pais: string;
  modalidad: Modalidad | "";
  nivel: Nivel | "";
  tipo: "local" | "remoto" | "";
  conSueldo: boolean;
  dias: number;
  pagina: number;
}

type Params = Record<string, string | string[] | undefined>;

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Lee los filtros de la URL y descarta valores inválidos. */
export function leerFiltros(p: Params): Filtros {
  const categoria = uno(p.categoria);
  const modalidad = uno(p.modalidad);
  const nivel = uno(p.nivel);
  const tipo = uno(p.tipo);
  const pais = uno(p.pais).toUpperCase();
  const dias = Number(uno(p.dias));
  return {
    q: uno(p.q).trim().slice(0, 80),
    categoria: (CATEGORIAS as readonly string[]).includes(categoria) ? (categoria as Categoria) : "",
    pais: pais in PAISES ? pais : "",
    modalidad: ["remoto", "hibrido", "presencial"].includes(modalidad) ? (modalidad as Modalidad) : "",
    nivel: (NIVELES as readonly string[]).includes(nivel) ? (nivel as Nivel) : "",
    tipo: tipo === "local" || tipo === "remoto" ? tipo : "",
    conSueldo: uno(p.sueldo) === "1",
    dias: [1, 7, 30].includes(dias) ? dias : 0,
    pagina: Math.min(Math.max(1, Math.floor(Number(uno(p.pagina))) || 1), 500),
  };
}

export interface Resultado {
  vacantes: VacanteVista[];
  total: number;
  /** ¿Quien pregunta ve empresas y enlaces? */
  acceso: boolean;
}

/**
 * Busca vacantes. Con Supabase, la función buscar_vacantes() de la base aplica
 * el muro de pago según quién tiene la sesión. Sin Supabase usa
 * data/vacantes.json (generado por "npm run recolectar") para probar en local.
 */
export async function buscarVacantes(f: Filtros, accesoEnLocal: boolean): Promise<Resultado> {
  if (!supabaseConfigurado()) return buscarEnArchivo(f, accesoEnLocal);
  const sb = await supabaseSesion();
  const { data, error } = await sb.rpc("buscar_vacantes", {
    p_q: f.q,
    p_categoria: f.categoria,
    p_pais: f.pais,
    p_modalidad: f.modalidad,
    p_nivel: f.nivel,
    p_tipo: f.tipo,
    p_con_sueldo: f.conSueldo,
    p_dias: f.dias,
    p_pagina: f.pagina,
    p_por_pagina: POR_PAGINA,
  });
  if (error) throw new Error(`Error buscando vacantes: ${error.message}`);
  const r = data as { total: number; acceso: boolean; vacantes: FilaBase[] };
  return { total: r.total, acceso: r.acceso, vacantes: r.vacantes.map(vistaDesdeBase) };
}

// --- Modo local (sin Supabase) ---------------------------------------------

let cache: { vacantes: Vacante[]; leido: number } | null = null;

async function todasLocales(): Promise<Vacante[]> {
  if (cache && Date.now() - cache.leido < 60_000) return cache.vacantes;
  try {
    const texto = await readFile(join(process.cwd(), "data/vacantes.json"), "utf8");
    const vacantes = (JSON.parse(texto) as Vacante[]).sort((a, b) => b.publicada.localeCompare(a.publicada));
    cache = { vacantes, leido: Date.now() };
  } catch {
    cache = { vacantes: [], leido: Date.now() };
  }
  return cache.vacantes;
}

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

async function buscarEnArchivo(f: Filtros, acceso: boolean): Promise<Resultado> {
  // Sin acceso solo se busca en el título; si no, escribir "Stripe" revelaría qué vacantes son de quién
  const buscarEnEmpresa = acceso;
  const limite = f.dias ? new Date(Date.now() - f.dias * 86_400_000).toISOString() : "";
  const q = sinAcentos(f.q);
  const filtradas = (await todasLocales()).filter(
    (v) =>
      v.acepta_latam &&
      (!q || sinAcentos(v.titulo).includes(q) || (buscarEnEmpresa && sinAcentos(v.empresa_nombre).includes(q))) &&
      (!f.categoria || v.categoria === f.categoria) &&
      (!f.pais || v.paises.includes(f.pais)) &&
      (!f.modalidad || v.modalidad === f.modalidad) &&
      (!f.nivel || v.nivel === f.nivel) &&
      (!f.tipo || v.empresa_tipo === f.tipo) &&
      (!f.conSueldo || v.sueldo_max != null) &&
      (!limite || v.publicada >= limite),
  );
  const desde = (f.pagina - 1) * POR_PAGINA;
  return { vacantes: filtradas.slice(desde, desde + POR_PAGINA).map((v) => vistaDeVacante(v, acceso)), total: filtradas.length, acceso };
}

// --- Números para la portada y la página de empresas -------------------------

export interface Resumen {
  total: number;
  empresas: number;
  remotas: number;
  enMexico: number;
}

export interface EmpresaConVacantes {
  slug: string;
  nombre: string;
  tipo: "local" | "remoto";
  total: number;
  remotas: number;
  paises: string[];
}

type FilaLigera = Pick<Vacante, "empresa_slug" | "empresa_nombre" | "empresa_tipo" | "modalidad" | "paises" | "acepta_latam">;

export async function resumen(): Promise<Resumen> {
  if (supabaseConfigurado()) {
    const { data, error } = await (await supabaseSesion()).rpc("resumen_vacantes");
    if (error) throw new Error(`Error leyendo el resumen: ${error.message}`);
    return data as Resumen;
  }
  const filas: FilaLigera[] = (await todasLocales()).filter((f) => f.acepta_latam);
  return {
    total: filas.length,
    empresas: new Set(filas.map((f) => f.empresa_slug)).size,
    remotas: filas.filter((f) => f.modalidad === "remoto").length,
    enMexico: filas.filter((f) => f.paises.includes("MX")).length,
  };
}

export async function empresasConVacantes(): Promise<EmpresaConVacantes[]> {
  if (supabaseConfigurado()) {
    const { data, error } = await (await supabaseSesion()).rpc("empresas_con_vacantes");
    if (error) throw new Error(`Error leyendo empresas: ${error.message}`);
    return data as EmpresaConVacantes[];
  }
  const mapa = new Map<string, EmpresaConVacantes>();
  for (const f of (await todasLocales()).filter((v) => v.acepta_latam)) {
    const e = mapa.get(f.empresa_slug) ?? { slug: f.empresa_slug, nombre: f.empresa_nombre, tipo: f.empresa_tipo, total: 0, remotas: 0, paises: [] };
    e.total++;
    if (f.modalidad === "remoto") e.remotas++;
    for (const p of f.paises) if (!e.paises.includes(p)) e.paises.push(p);
    mapa.set(f.empresa_slug, e);
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total);
}
