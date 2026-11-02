import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { supabaseAdmin, supabaseConfigurado } from "./supabase/servidor.ts";
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
  vacantes: Vacante[];
  total: number;
}

/**
 * Busca vacantes. Con Supabase configurado consulta la base de datos; si no,
 * usa data/vacantes.json (generado por "npm run recolectar") para probar en local.
 *
 * `buscarEnEmpresa` solo se activa para usuarios con acceso: si no, alguien
 * podría escribir "Stripe" en el buscador y descubrir de qué empresa es cada vacante.
 */
export async function buscarVacantes(f: Filtros, buscarEnEmpresa: boolean): Promise<Resultado> {
  if (supabaseConfigurado()) return buscarEnSupabase(f, buscarEnEmpresa);
  return buscarEnArchivo(f, buscarEnEmpresa);
}

async function buscarEnSupabase(f: Filtros, buscarEnEmpresa: boolean): Promise<Resultado> {
  let q = supabaseAdmin().from("vacantes").select("*", { count: "exact" }).eq("activa", true).eq("acepta_latam", true);
  if (f.q) {
    // Quitar caracteres que rompen la sintaxis de filtros de PostgREST
    const texto = f.q.replace(/[,()%*\\]/g, " ").trim();
    if (texto) q = buscarEnEmpresa ? q.or(`titulo.ilike.%${texto}%,empresa_nombre.ilike.%${texto}%`) : q.ilike("titulo", `%${texto}%`);
  }
  if (f.categoria) q = q.eq("categoria", f.categoria);
  if (f.pais) q = q.contains("paises", [f.pais]);
  if (f.modalidad) q = q.eq("modalidad", f.modalidad);
  if (f.nivel) q = q.eq("nivel", f.nivel);
  if (f.tipo) q = q.eq("empresa_tipo", f.tipo);
  if (f.conSueldo) q = q.not("sueldo_max", "is", null);
  if (f.dias) q = q.gte("publicada", new Date(Date.now() - f.dias * 86_400_000).toISOString());
  const desde = (f.pagina - 1) * POR_PAGINA;
  const { data, count, error } = await q.order("publicada", { ascending: false }).range(desde, desde + POR_PAGINA - 1);
  if (error) throw new Error(`Error buscando vacantes: ${error.message}`);
  return { vacantes: (data ?? []) as Vacante[], total: count ?? 0 };
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

async function buscarEnArchivo(f: Filtros, buscarEnEmpresa: boolean): Promise<Resultado> {
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
  return { vacantes: filtradas.slice(desde, desde + POR_PAGINA), total: filtradas.length };
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

type FilaLigera = Pick<Vacante, "empresa_slug" | "empresa_nombre" | "empresa_tipo" | "modalidad" | "paises">;

async function filasLigeras(): Promise<FilaLigera[]> {
  if (!supabaseConfigurado()) return todasLocales();
  const filas: FilaLigera[] = [];
  // PostgREST devuelve máximo 1000 filas por consulta: paginamos
  for (let desde = 0; desde < 100_000; desde += 1000) {
    const { data, error } = await supabaseAdmin()
      .from("vacantes")
      .select("empresa_slug, empresa_nombre, empresa_tipo, modalidad, paises")
      .eq("activa", true)
      .eq("acepta_latam", true)
      .range(desde, desde + 999);
    if (error) throw new Error(`Error leyendo vacantes: ${error.message}`);
    filas.push(...((data ?? []) as FilaLigera[]));
    if (!data || data.length < 1000) break;
  }
  return filas;
}

export async function resumen(): Promise<Resumen> {
  const filas = await filasLigeras();
  return {
    total: filas.length,
    empresas: new Set(filas.map((f) => f.empresa_slug)).size,
    remotas: filas.filter((f) => f.modalidad === "remoto").length,
    enMexico: filas.filter((f) => f.paises.includes("MX")).length,
  };
}

export async function empresasConVacantes(): Promise<EmpresaConVacantes[]> {
  const mapa = new Map<string, EmpresaConVacantes>();
  for (const f of await filasLigeras()) {
    const e = mapa.get(f.empresa_slug) ?? { slug: f.empresa_slug, nombre: f.empresa_nombre, tipo: f.empresa_tipo, total: 0, remotas: 0, paises: [] };
    e.total++;
    if (f.modalidad === "remoto") e.remotas++;
    for (const p of f.paises) if (!e.paises.includes(p)) e.paises.push(p);
    mapa.set(f.empresa_slug, e);
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total);
}
