// Descarga las vacantes de todas las empresas de data/empresas.json,
// se queda con las que sirven desde México/LATAM y las guarda.
//
//   npm run recolectar
//
// Si hay NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY, las guarda en
// Supabase (y marca como cerradas las que ya no aparecen). Si no, escribe
// data/vacantes.json para poder probar la web sin base de datos.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { leerVacantes } from "../lib/fuentes/index.ts";
import { normalizar } from "../lib/normalizar.ts";
import type { Empresa, Vacante } from "../lib/tipos.ts";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");

// Variables de .env.local (si existe) sin depender de librerías
try {
  for (const linea of readFileSync(join(raiz, ".env.local"), "utf8").split("\n")) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  /* sin .env.local */
}

const empresas: Empresa[] = JSON.parse(readFileSync(join(raiz, "data/empresas.json"), "utf8"));
const soloEmpresa = process.argv[2];
const ahora = new Date();

/** Corre tareas con un máximo de N a la vez para no saturar las APIs. */
async function enParalelo<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const resultados: R[] = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const indice = i++;
        resultados[indice] = await fn(items[indice]);
      }
    }),
  );
  return resultados;
}

const lista = soloEmpresa ? empresas.filter((e) => e.slug === soloEmpresa) : empresas;
const fallidas: string[] = [];
const porEmpresa = await enParalelo(lista, 6, async (empresa) => {
  try {
    const crudas = await leerVacantes(empresa);
    const utiles = crudas.map((c) => normalizar(c, empresa, ahora)).filter((v) => v.acepta_latam);
    console.log(`✓ ${empresa.nombre.padEnd(22)} ${String(utiles.length).padStart(4)} de ${crudas.length} sirven desde LATAM`);
    return utiles;
  } catch (e) {
    fallidas.push(empresa.slug);
    console.warn(`✗ ${empresa.nombre.padEnd(22)} ${String(e instanceof Error ? e.message : e).slice(0, 120)}`);
    return [] as Vacante[];
  }
});

// Quitar duplicados (algunas empresas repiten la misma vacante)
const vacantes = [...new Map(porEmpresa.flat().map((v) => [v.id, v])).values()];
console.log(`\nTotal: ${vacantes.length} vacantes de ${lista.length - fallidas.length} empresas${fallidas.length ? ` (fallaron: ${fallidas.join(", ")})` : ""}`);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !clave) {
  writeFileSync(join(raiz, "data/vacantes.json"), JSON.stringify(vacantes));
  console.log("Sin Supabase configurado: guardé data/vacantes.json");
} else {
  const sb = createClient(url, clave, { auth: { persistSession: false } });
  const filas = vacantes.map((v) => ({ ...v, activa: true }));
  for (let i = 0; i < filas.length; i += 500) {
    const { error } = await sb.from("vacantes").upsert(filas.slice(i, i + 500), { onConflict: "id" });
    if (error) throw new Error(`Error guardando vacantes: ${error.message}`);
  }
  // Las empresas que sí respondieron y ya no publican una vacante: se cierra.
  const respondieron = lista.map((e) => e.slug).filter((s) => !fallidas.includes(s));
  const { error } = await sb
    .from("vacantes")
    .update({ activa: false })
    .in("empresa_slug", respondieron)
    .lt("vista", ahora.toISOString());
  if (error) throw new Error(`Error cerrando vacantes viejas: ${error.message}`);
  console.log(`Guardadas en Supabase: ${filas.length}`);
}

// Si fallan demasiadas empresas, avisar con código de error (para GitHub Actions)
if (fallidas.length > lista.length / 2) process.exit(1);
