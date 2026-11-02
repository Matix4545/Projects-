// Busca empresas nuevas para data/empresas.json.
//
//   npm run descubrir              → solo muestra qué encontró
//   npm run descubrir -- --guardar → además las agrega a data/empresas.json
//   npm run descubrir -- --workable → también prueba Workable (limita mucho las consultas)
//   npm run descubrir -- --guardar --solo-latam → guarda solo las que hoy tienen vacantes para LATAM
//
// Lee data/candidatas.txt (una empresa por línea: "Nombre | tipo | slug1, slug2…"),
// prueba cada slug en cada sistema de reclutamiento y se queda con las empresas
// que tienen al menos una vacante que sirve desde LATAM. Las que ya están en
// empresas.json no se tocan.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { leerVacantes } from "../lib/fuentes/index.ts";
import { normalizar } from "../lib/normalizar.ts";
import type { Ats, Empresa } from "../lib/tipos.ts";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const guardar = process.argv.includes("--guardar");
const conWorkable = process.argv.includes("--workable");
const soloLatam = process.argv.includes("--solo-latam");

interface Candidata {
  nombre: string;
  tipo: "local" | "remoto" | "global";
  slugs: string[];
}

const candidatas: Candidata[] = readFileSync(join(raiz, "data/candidatas.txt"), "utf8")
  .split("\n")
  .map((l) => l.replace(/#.*/, "").trim())
  .filter(Boolean)
  .map((l) => {
    const [nombre, tipo, slugs] = l.split("|").map((x) => x.trim());
    if (!["local", "remoto", "global"].includes(tipo)) throw new Error(`Tipo inválido en: ${l}`);
    return { nombre, tipo: tipo as Candidata["tipo"], slugs: (slugs ?? "").split(",").map((s) => s.trim()).filter(Boolean) };
  });

const archivoEmpresas = join(raiz, "data/empresas.json");
const empresas: Empresa[] = JSON.parse(readFileSync(archivoEmpresas, "utf8"));
const yaEsta = (ats: Ats, board: string) => empresas.some((e) => e.ats === ats && e.board.toLowerCase() === board.toLowerCase());
const nombreYaEsta = (nombre: string) => empresas.some((e) => e.nombre.toLowerCase() === nombre.toLowerCase());

const SISTEMAS: Ats[] = ["greenhouse", "lever", "ashby", "recruitee", "smartrecruiters", "bamboohr", "teamtailor", ...(conWorkable ? (["workable"] as Ats[]) : [])];

/** SmartRecruiters responde 200 aunque la empresa no exista: primero revisamos que tenga vacantes. */
async function existeEnSmartRecruiters(board: string): Promise<boolean> {
  try {
    const r = await fetch(`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(board)}/postings?limit=1`, {
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) return false;
    return ((await r.json()) as { totalFound?: number }).totalFound! > 0;
  } catch {
    return false;
  }
}

interface Hallazgo {
  empresa: Empresa;
  total: number;
  latam: number;
}

async function probar(c: Candidata): Promise<Hallazgo | null> {
  let mejor: Hallazgo | null = null;
  for (const slug of c.slugs) {
    for (const ats of SISTEMAS) {
      if (yaEsta(ats, slug)) return null;
      if (ats === "smartrecruiters" && !(await existeEnSmartRecruiters(slug))) continue;
      const empresa: Empresa = {
        slug: c.slugs[0].toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        nombre: c.nombre,
        ats,
        board: slug,
        tipo: c.tipo === "local" ? "local" : "remoto",
        ...(c.tipo === "global" ? { remotoGlobal: true } : {}),
      };
      try {
        const crudas = await leerVacantes(empresa);
        if (crudas.length === 0) continue;
        const latam = crudas.map((x) => normalizar(x, empresa)).filter((v) => v.acepta_latam).length;
        if (!mejor || latam > mejor.latam) mejor = { empresa, total: crudas.length, latam };
      } catch {
        /* no existe en este sistema */
      }
    }
  }
  return mejor;
}

async function enParalelo<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const res: R[] = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const k = i++;
        res[k] = await fn(items[k]);
      }
    }),
  );
  return res;
}

const pendientes = candidatas.filter((c) => !nombreYaEsta(c.nombre));
console.log(`Probando ${pendientes.length} empresas candidatas (${candidatas.length - pendientes.length} ya están)…\n`);
const hallazgos = (await enParalelo(pendientes, 8, probar)).filter((h): h is Hallazgo => h !== null);

const utiles = hallazgos.filter((h) => h.latam > 0).sort((a, b) => b.latam - a.latam);
const sinLatam = hallazgos.filter((h) => h.latam === 0);
const noEncontradas = pendientes.filter((c) => !hallazgos.some((h) => h.empresa.nombre === c.nombre));

for (const h of utiles) {
  console.log(`✓ ${h.empresa.nombre.padEnd(28)} ${h.empresa.ats.padEnd(15)} ${h.empresa.board.padEnd(24)} ${String(h.latam).padStart(4)} de ${h.total} sirven desde LATAM`);
}
console.log(`\n${utiles.length} con vacantes para LATAM · ${sinLatam.length} sin vacantes para LATAM hoy · ${noEncontradas.length} no encontradas`);
if (sinLatam.length) console.log(`Sin LATAM hoy: ${sinLatam.map((h) => h.empresa.nombre).join(", ")}`);
if (noEncontradas.length) console.log(`No encontradas: ${noEncontradas.map((c) => c.nombre).join(", ")}`);

// Por defecto también se guardan las que hoy no tienen vacantes para LATAM:
// el recolector diario las revisa y en cuanto publiquen una, aparece.
const aGuardar = soloLatam ? utiles : [...utiles, ...sinLatam];
if (guardar && aGuardar.length) {
  // Evitar slugs repetidos
  for (const h of aGuardar) {
    let s = h.empresa.slug;
    for (let n = 2; empresas.some((e) => e.slug === s); n++) s = `${h.empresa.slug}-${n}`;
    empresas.push({ ...h.empresa, slug: s });
  }
  // Mismo formato que el archivo original: una empresa por línea
  writeFileSync(archivoEmpresas, `[\n${empresas.map((e) => `  ${JSON.stringify(e)}`).join(",\n")}\n]\n`);
  console.log(`\nAgregadas ${aGuardar.length} empresas a data/empresas.json (total: ${empresas.length})`);
}
