// Lógica del recolector, compartida por scripts/recolectar.ts (a mano o en
// tu computadora) y por la función programada de Netlify (todos los días).

import { createClient } from "@supabase/supabase-js";
import { leerVacantes } from "./fuentes/index.ts";
import { esRelevanteObregon, normalizar } from "./normalizar.ts";
import type { Empresa, Vacante } from "./tipos.ts";

export interface ResultadoRecoleccion {
  vacantes: Vacante[];
  /** Empresas que respondieron (aunque no tengan vacantes para LATAM) */
  respondieron: string[];
  fallidas: { slug: string; error: string }[];
}

/** Corre tareas con un máximo de N a la vez para no saturar las APIs. */
async function enParalelo<T>(items: T[], n: number, fn: (x: T) => Promise<void>): Promise<void> {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) await fn(items[i++]);
    }),
  );
}

/**
 * Qué vacantes se guardan. "obregon" (lanzamiento): solo Sonora y remotas
 * abiertas a México. "latam": todo lo que sirve desde LATAM.
 * Se cambia con la variable CHAMBARADAR_ENFOQUE.
 */
export type Enfoque = "obregon" | "latam";
export function enfoqueActual(): Enfoque {
  return process.env.CHAMBARADAR_ENFOQUE === "latam" ? "latam" : "obregon";
}

export async function recolectar(
  empresas: Empresa[],
  {
    paralelo = 6,
    ahora = new Date(),
    alAvanzar,
    enfoque = enfoqueActual(),
  }: { paralelo?: number; ahora?: Date; alAvanzar?: (texto: string) => void; enfoque?: Enfoque } = {},
): Promise<ResultadoRecoleccion> {
  const sirve = (v: Vacante) => v.acepta_latam && (enfoque === "latam" || esRelevanteObregon(v));
  const mapa = new Map<string, Vacante>();
  const respondieron: string[] = [];
  const fallidas: ResultadoRecoleccion["fallidas"] = [];

  await enParalelo(empresas, paralelo, async (empresa) => {
    try {
      const crudas = await leerVacantes(empresa);
      const utiles = crudas.map((c) => normalizar(c, empresa, ahora)).filter(sirve);
      for (const v of utiles) mapa.set(v.id, v);
      respondieron.push(empresa.slug);
      alAvanzar?.(`✓ ${empresa.nombre.padEnd(26)} ${String(utiles.length).padStart(4)} de ${crudas.length} sirven${enfoque === "obregon" ? " en Obregón/remoto MX" : " desde LATAM"}`);
    } catch (e) {
      const error = String(e instanceof Error ? e.message : e).slice(0, 160);
      fallidas.push({ slug: empresa.slug, error });
      alAvanzar?.(`✗ ${empresa.nombre.padEnd(26)} ${error}`);
    }
  });

  return { vacantes: [...mapa.values()], respondieron, fallidas };
}

/**
 * Guarda en Supabase con la función guardar_vacantes() y cierra las vacantes
 * que ya no aparecen. Solo necesita la clave pública y la clave de la app.
 */
export async function guardarEnSupabase(
  r: ResultadoRecoleccion,
  { url, clavePublica, claveApp, ahora }: { url: string; clavePublica: string; claveApp: string; ahora: Date },
): Promise<{ guardadas: number; cerradas: number }> {
  const sb = createClient(url, clavePublica, { auth: { persistSession: false } });
  let guardadas = 0;
  const filas = r.vacantes.map((v) => ({ ...v, activa: true }));
  for (let i = 0; i < filas.length; i += 300) {
    const { data, error } = await sb.rpc("guardar_vacantes", { p_clave: claveApp, p_filas: filas.slice(i, i + 300) });
    if (error) throw new Error(`Error guardando vacantes: ${error.message}`);
    guardadas += Number(data ?? 0);
  }
  let cerradas = 0;
  if (r.respondieron.length) {
    const { data, error } = await sb.rpc("cerrar_vacantes", { p_clave: claveApp, p_empresas: r.respondieron, p_antes: ahora.toISOString() });
    if (error) throw new Error(`Error cerrando vacantes viejas: ${error.message}`);
    cerradas = Number(data ?? 0);
  }
  return { guardadas, cerradas };
}

/** Empresas que tocan en esta hora: el día se reparte en `partes` turnos para que cada corrida sea corta. */
export function turnoDeEmpresas(empresas: Empresa[], hora: number, partes = 24): Empresa[] {
  return empresas.filter((_, i) => i % partes === hora % partes);
}
