// Descarga las vacantes de las empresas de data/empresas.json, se queda con
// las que sirven desde México/LATAM y las guarda.
//
//   npm run recolectar            → todas las empresas
//   npm run recolectar -- kavak   → solo una empresa
//
// Con NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY y CHAMBARADAR_CLAVE
// (en .env.local o en el entorno) las guarda en Supabase. Si no, escribe
// data/vacantes.json para probar la web sin base de datos.
//
// En producción esto lo hace solo la función programada de Netlify
// (netlify/functions/recolectar.mts), un turno de empresas cada hora.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { guardarEnSupabase, recolectar } from "../lib/recolector.ts";
import type { Empresa } from "../lib/tipos.ts";

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
const lista = soloEmpresa ? empresas.filter((e) => e.slug === soloEmpresa) : empresas;
if (lista.length === 0) throw new Error(`No hay ninguna empresa con slug "${soloEmpresa}" en data/empresas.json`);

const ahora = new Date();
const r = await recolectar(lista, { ahora, alAvanzar: (t) => console.log(t) });
console.log(
  `\nTotal: ${r.vacantes.length} vacantes de ${r.respondieron.length} empresas` +
    (r.fallidas.length ? ` (fallaron: ${r.fallidas.map((f) => f.slug).join(", ")})` : ""),
);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clavePublica = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const claveApp = process.env.CHAMBARADAR_CLAVE;

if (!url || !clavePublica || !claveApp) {
  writeFileSync(join(raiz, "data/vacantes.json"), JSON.stringify(r.vacantes));
  console.log("Sin Supabase configurado: guardé data/vacantes.json");
} else {
  const { guardadas, cerradas } = await guardarEnSupabase(r, { url, clavePublica, claveApp, ahora });
  console.log(`Supabase: ${guardadas} guardadas, ${cerradas} cerradas porque ya no aparecen`);
}

// Si fallan demasiadas empresas, salir con error
if (r.fallidas.length > lista.length / 2) process.exit(1);
