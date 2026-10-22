#!/usr/bin/env node
// =====================================================================
// Reporta Cajeme · Importar secciones electorales del INE (solo Cajeme)
//
// Uso:
//   npm run importar-secciones -- --archivo data/secciones.zip
//        → Shapefile en .zip (la capa SECCION de la cartografía del INE), GeoJSON, KML o KMZ
//   npm run importar-secciones -- --archivo "https://www.arcgis.com/…?webmap=<id>" [--capa 2]
//        → capa de secciones de un mapa PÚBLICO de ArcGIS
//   Opciones: --sin-subir (solo revisar) · --municipio 18 · --campo-seccion SECCION
//
// Cómo elige las secciones de Cajeme:
//   · Si el archivo trae la columna MUNICIPIO, usa el municipio que cubre el centro de
//     Ciudad Obregón (o el que indiques con --municipio) y guarda todas sus secciones.
//   · Si no la trae, guarda las secciones cuyo centro cae dentro del área de la app.
// Las secciones son de uso interno del equipo: no se muestran al público.
// =====================================================================

import { readFileSync } from "node:fs";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as cargarEnv } from "dotenv";
import shp from "shpjs";
import { createClient } from "@supabase/supabase-js";
import { abrir, centro, poligonos, redondear } from "./leer-colonias.mjs";
import { descargarDeArcgis, esEntradaArcgis } from "./descargar-arcgis.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
cargarEnv({ path: join(RAIZ, ".env.local") });
cargarEnv({ path: join(RAIZ, ".env") });

const argv = process.argv.slice(2);
function opcion(nombre) {
  const i = argv.indexOf(nombre);
  if (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--")) return argv[i + 1].trim();
  const conIgual = argv.find((a) => a.startsWith(`${nombre}=`));
  return conIgual ? conIgual.slice(nombre.length + 1).trim() : "";
}
const ENTRADA = opcion("--archivo");
const SIN_SUBIR = argv.includes("--sin-subir");
const MUNICIPIO = opcion("--municipio");
const CAMPO_SECCION = opcion("--campo-seccion");
const CAPA = opcion("--capa");

// Área de la app y centro urbano de Ciudad Obregón (lng, lat)
const LIMITES = { sur: 27.3, norte: 27.65, oeste: -110.15, este: -109.75 };
const CENTRO_OBREGON = { sur: 27.46, norte: 27.51, oeste: -109.97, este: -109.91 };
const dentro = ([lng, lat], c) => lat >= c.sur && lat <= c.norte && lng >= c.oeste && lng <= c.este;

const log = (...m) => console.log("•", ...m);

/** Busca una columna sin importar mayúsculas: SECCION, Seccion, seccion… */
function columna(props, candidatos) {
  const claves = Object.keys(props);
  for (const c of candidatos) {
    const real = claves.find((k) => k.toLowerCase() === c.toLowerCase());
    if (real) return real;
  }
  return null;
}

/** Shapefile .zip: si trae varias capas (ENTIDAD, MUNICIPIO, SECCION, MANZANA…), usa la de secciones. */
async function abrirZip(ruta) {
  const capas = [await shp(readFileSync(ruta))].flat();
  if (capas.length === 1) return capas[0].features;
  const nombres = capas.map((c) => c.fileName ?? "(sin nombre)");
  log(`Capas en el .zip: ${nombres.join(", ")}`);
  const elegida = CAPA
    ? capas.find((c) => (c.fileName ?? "").toLowerCase().includes(CAPA.toLowerCase()))
    : capas.find((c) => /secci/i.test(c.fileName ?? "") && !/manzana/i.test(c.fileName ?? ""));
  if (!elegida) throw new Error(`No encontré la capa de secciones. Indica cuál con --capa (opciones: ${nombres.join(", ")})`);
  log(`Usando la capa: ${elegida.fileName}`);
  return elegida.features;
}

async function leer(entrada) {
  if (esEntradaArcgis(entrada)) return (await descargarDeArcgis(entrada, { capa: CAPA })).features;
  const absoluta = resolve(RAIZ, entrada);
  const rel = relative(RAIZ, absoluta);
  if (rel.startsWith("..") || isAbsolute(rel)) throw new Error("El archivo debe estar dentro del proyecto (p. ej. data/secciones.zip)");
  return extname(absoluta).toLowerCase() === ".zip" ? abrirZip(absoluta) : abrir(absoluta);
}

async function main() {
  if (!ENTRADA) throw new Error("Falta --archivo (Shapefile .zip, GeoJSON, KML/KMZ o enlace de ArcGIS)");
  const crudas = (await leer(ENTRADA)).map((f) => ({ props: f.properties ?? {}, coords: poligonos(f.geometry) })).filter((f) => f.coords.length);
  if (crudas.length === 0) throw new Error("El archivo no contiene polígonos.");
  log(`Polígonos en el archivo: ${crudas.length}`);
  log(`Columnas: ${Object.keys(crudas[0].props).join(", ")}`);

  const [x0, y0] = centro(crudas[0].coords);
  if (Math.abs(x0) > 180 || Math.abs(y0) > 90) {
    throw new Error("Las coordenadas están en metros: sube el Shapefile completo en .zip, con su archivo .prj.");
  }

  const cSeccion = CAMPO_SECCION || columna(crudas[0].props, ["SECCION", "seccion", "SECC", "CVE_SECC", "seccion_electoral"]);
  if (!cSeccion) throw new Error("No encontré la columna del número de sección. Indícala con --campo-seccion");
  const cMunicipio = columna(crudas[0].props, ["MUNICIPIO", "CVE_MUN", "municipio_id"]);
  const cLocal = columna(crudas[0].props, ["DISTRITO_L", "DISTRITO_LOCAL", "DIST_LOCAL", "distrito_local"]);
  const cFederal = columna(crudas[0].props, ["DISTRITO_F", "DISTRITO", "DISTRITO_FEDERAL", "DIST_FED", "distrito_federal"]);
  log(`Columna de sección: ${cSeccion} · municipio: ${cMunicipio ?? "—"} · distrito local: ${cLocal ?? "—"} · federal: ${cFederal ?? "—"}`);

  let elegidas;
  if (cMunicipio) {
    let municipio = MUNICIPIO;
    if (!municipio) {
      // El municipio que más aparece en el centro de Ciudad Obregón es Cajeme
      const votos = new Map();
      for (const f of crudas) {
        if (!dentro(centro(f.coords), CENTRO_OBREGON)) continue;
        const m = String(f.props[cMunicipio]);
        votos.set(m, (votos.get(m) ?? 0) + 1);
      }
      municipio = [...votos].sort((a, b) => b[1] - a[1])[0]?.[0];
      if (!municipio) throw new Error("Ninguna sección cae en Ciudad Obregón. ¿Es el archivo de Sonora?");
      log(`Municipio detectado para Cajeme: ${municipio} (puedes forzarlo con --municipio)`);
    }
    elegidas = crudas.filter((f) => String(f.props[cMunicipio]) === String(municipio));
  } else {
    elegidas = crudas.filter((f) => dentro(centro(f.coords), LIMITES));
    log("El archivo no trae municipio: se usan las secciones dentro del área de la app.");
  }

  const num = (v) => {
    const n = Number.parseInt(String(v ?? ""), 10);
    return Number.isFinite(n) ? n : null;
  };
  const secciones = elegidas
    .map((f) => ({
      seccion: num(f.props[cSeccion]),
      distrito_local: cLocal ? num(f.props[cLocal]) : null,
      distrito_federal: cFederal ? num(f.props[cFederal]) : null,
      geometria: { type: "MultiPolygon", coordinates: redondear(f.coords) },
    }))
    .filter((s) => s.seccion !== null);
  if (secciones.length === 0) throw new Error("No quedó ninguna sección de Cajeme.");
  const numeros = [...new Set(secciones.map((s) => s.seccion))].sort((a, b) => a - b);
  log(`Secciones de Cajeme: ${numeros.length} (de la ${numeros[0]} a la ${numeros.at(-1)})`);

  if (SIN_SUBIR) {
    log("Modo revisión: no se cambió la base de datos.");
    return;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY");
  const db = createClient(url, clave, { auth: { persistSession: false } });
  const LOTE = 40;
  let total = 0;
  for (let i = 0; i < secciones.length; i += LOTE) {
    const { data, error } = await db.rpc("importar_secciones", {
      p_secciones: secciones.slice(i, i + LOTE),
      p_borrar_antes: i === 0,
    });
    if (error) throw new Error(`Supabase: ${error.message}. ¿Ya corriste 01, 02 y 03 .sql?`);
    total += data;
    process.stdout.write(`\r• Subiendo… ${Math.min(i + LOTE, secciones.length)}/${secciones.length}`);
  }
  console.log();
  log(`Listo: ${total} polígonos guardados en ${numeros.length} secciones.`);
}

main().catch((e) => {
  console.error("✖", e.message);
  process.exit(1);
});
