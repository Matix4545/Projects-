#!/usr/bin/env node
// =====================================================================
// Reporta Cajeme · Importar localidades (comisarías, ejidos y campos del municipio)
//
// Las colonias oficiales solo cubren Ciudad Obregón. Este script agrega una zona por cada
// localidad del municipio de Cajeme que no esté ya dentro de una colonia, para que ahí
// también se pueda reportar el agua. No toca las colonias ni los reportes existentes.
//
// Uso:
//   npm run importar-localidades                  → descarga de OpenStreetMap y sube a Supabase
//   npm run importar-localidades -- --sin-subir   → solo genera data/localidades.geojson y muestra la lista
//
// Cómo funciona:
//   1. Descarga de OpenStreetMap (Overpass) el límite del municipio, sus localidades
//      (place=town/village/hamlet/…) y sus calles residenciales.
//   2. Descarta las localidades que ya caen dentro de una colonia.
//   3. Dibuja cada localidad con hexágonos H3 (resolución 9, ~0.1 km²): los de sus calles a
//      menos de 2 km y, si no tiene calles en el mapa, un círculo de hexágonos alrededor.
//   4. Sube las zonas con importar_zonas() (fuente "osm", id "node/…": se pueden volver a importar).
// =====================================================================

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config as cargarEnv } from "dotenv";
import { cellToLatLng, cellsToMultiPolygon, gridDisk, latLngToCell } from "h3-js";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { createClient } from "@supabase/supabase-js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
cargarEnv({ path: join(RAIZ, ".env.local") });
cargarEnv({ path: join(RAIZ, ".env") });

const SIN_SUBIR = process.argv.includes("--sin-subir");
const RES = 9;
/** Calles a más de esto de cualquier localidad no se asignan (son de otra cosa: ranchos, carreteras) */
const MAX_DISTANCIA_M = 2000;
/** Localidad sin calles en el mapa: círculo de hexágonos de este radio (anillos H3, ~350 m por anillo) */
const ANILLOS_SIN_CALLES = 2;
const ARCHIVO = join(RAIZ, "data", "localidades.geojson");
const SERVIDORES = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

const CONSULTA = `[out:json][timeout:240];
rel["boundary"="administrative"]["admin_level"="6"]["name"="Cajeme"];
out geom;
map_to_area->.m;
node(area.m)["place"~"^(town|village|hamlet|suburb|neighbourhood|quarter|locality|isolated_dwelling)$"]["name"];
out body;
way(area.m)["highway"~"^(residential|living_street)$"];
out geom;`;

const log = (...m) => console.log("•", ...m);

async function overpass(consulta) {
  // Para pruebas sin red: OVERPASS_ARCHIVO=ruta/a/respuesta.json
  if (process.env.OVERPASS_ARCHIVO) return JSON.parse(readFileSync(process.env.OVERPASS_ARCHIVO, "utf8"));
  let ultimoError;
  for (const espera of [0, 30, 90, 180]) {
    if (espera) {
      log(`Los servidores están ocupados; reintento en ${espera} s…`);
      await new Promise((r) => setTimeout(r, espera * 1000));
    }
    for (const url of SERVIDORES) {
      try {
        log(`Consultando ${new URL(url).host}…`);
        const res = await fetch(url, {
          method: "POST",
          body: new URLSearchParams({ data: consulta }),
          headers: { "User-Agent": "reporta-cajeme/1.0 (importador de localidades)" },
          signal: AbortSignal.timeout(240_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const datos = await res.json();
        if (datos.remark && /runtime error|timed out/i.test(datos.remark)) throw new Error(datos.remark);
        return datos;
      } catch (e) {
        ultimoError = e;
        log(`  falló (${e.message})`);
      }
    }
  }
  throw new Error(`No se pudo consultar OpenStreetMap (${ultimoError?.message}).`);
}

/** Distancia aproximada en metros (suficiente para unos km) */
function distanciaM([lat1, lng1], [lat2, lng2]) {
  const kx = 111_320 * Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180);
  return Math.hypot((lng2 - lng1) * kx, (lat2 - lat1) * 110_574);
}

/**
 * Colonias ya cargadas en Supabase, para no encimar localidades sobre ellas.
 * Las localidades de una importación anterior (fuente "osm") no cuentan: se vuelven a dibujar.
 */
async function zonasExistentes(db) {
  const { data, error } = await db.rpc("zonas_geojson");
  if (error) throw new Error(`No se pudieron leer las colonias de Supabase: ${error.message}`);
  return data.features.filter((f) => f.properties?.fuente !== "osm");
}

/**
 * Arma las zonas de las localidades.
 * datos: respuesta de Overpass · existentes: polígonos GeoJSON de las colonias actuales
 */
export function armarLocalidades(datos, existentes) {
  const dentroDeColonia = (lat, lng) => existentes.some((f) => booleanPointInPolygon([lng, lat], f));
  const lugares = datos.elements
    .filter((e) => e.type === "node" && e.tags?.place && e.tags?.name)
    .map((e) => ({ id: e.id, nombre: e.tags.name.trim(), tipo: e.tags.place, pos: [e.lat, e.lon] }));
  const nuevos = lugares.filter((l) => !dentroDeColonia(...l.pos));
  log(`${lugares.length} localidades en OpenStreetMap; ${lugares.length - nuevos.length} ya están dentro de una colonia.`);

  // Hexágonos con calles, cada uno a la localidad más cercana (si está a menos de 2 km)
  const celdas = new Map(nuevos.map((l) => [l.id, new Set()]));
  const vistos = new Set();
  for (const w of datos.elements.filter((e) => e.type === "way" && e.geometry)) {
    for (const { lat, lon } of w.geometry) {
      const h = latLngToCell(lat, lon, RES);
      if (vistos.has(h)) continue;
      vistos.add(h);
      const centro = cellToLatLng(h);
      if (dentroDeColonia(...centro)) continue;
      let mejor = null;
      let min = MAX_DISTANCIA_M;
      for (const l of nuevos) {
        const d = distanciaM(centro, l.pos);
        if (d < min) [mejor, min] = [l, d];
      }
      if (mejor) celdas.get(mejor.id).add(h);
    }
  }

  // Nombres repetidos (p. ej. dos "Campo 5"): se distinguen con el tipo de lugar o un número
  const repetidos = new Map();
  for (const l of nuevos) repetidos.set(l.nombre, (repetidos.get(l.nombre) ?? 0) + 1);
  const usados = new Map();

  const zonas = [];
  for (const l of nuevos) {
    const propias = celdas.get(l.id);
    // El centro siempre cuenta; sin calles en el mapa, un círculo alrededor
    const centro = latLngToCell(l.pos[0], l.pos[1], RES);
    const extra = propias.size === 0 ? gridDisk(centro, ANILLOS_SIN_CALLES) : [centro];
    for (const h of extra) if (!dentroDeColonia(...cellToLatLng(h))) propias.add(h);
    if (propias.size === 0) continue;
    let nombre = l.nombre;
    if ((repetidos.get(nombre) ?? 0) > 1) {
      const n = (usados.get(nombre) ?? 0) + 1;
      usados.set(nombre, n);
      nombre = `${nombre} (${n})`;
    }
    zonas.push({
      nombre,
      fuente: "osm",
      osm_id: `node/${l.id}`,
      tipo: l.tipo,
      celdas: propias.size,
      geometria: { type: "MultiPolygon", coordinates: cellsToMultiPolygon([...propias], true) },
    });
  }
  return zonas.sort((a, b) => b.celdas - a.celdas);
}

/** Caja del municipio (para ajustar LIMITES_CAJEME en lib/constantes.ts) */
function cajaMunicipio(datos) {
  const rel = datos.elements.find((e) => e.type === "relation");
  const puntos = (rel?.members ?? []).flatMap((m) => m.geometry ?? []);
  if (puntos.length === 0) return null;
  const lats = puntos.map((p) => p.lat);
  const lngs = puntos.map((p) => p.lon);
  const r = (x) => Math.round(x * 1000) / 1000;
  return { sur: r(Math.min(...lats)), norte: r(Math.max(...lats)), oeste: r(Math.min(...lngs)), este: r(Math.max(...lngs)) };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.");
  const db = createClient(url, clave, { auth: { persistSession: false } });

  log("Descargando de OpenStreetMap el municipio de Cajeme, sus localidades y calles…");
  const datos = await overpass(CONSULTA);
  const caja = cajaMunicipio(datos);
  log(caja ? `Límite del municipio: ${JSON.stringify(caja)}` : "No se encontró el límite del municipio en OpenStreetMap.");

  const existentes = await zonasExistentes(db);
  log(`${existentes.length} colonias ya cargadas.`);
  const zonas = armarLocalidades(datos, existentes);

  mkdirSync(dirname(ARCHIVO), { recursive: true });
  writeFileSync(
    ARCHIVO,
    JSON.stringify({
      type: "FeatureCollection",
      features: zonas.map(({ geometria, ...p }) => ({ type: "Feature", properties: p, geometry: geometria })),
    }),
  );
  log(`${zonas.length} localidades nuevas (guardadas en data/localidades.geojson):`);
  for (const z of zonas) console.log(`   ${z.nombre} · ${z.tipo} · ${z.celdas} hexágonos (~${(z.celdas * 0.105).toFixed(1)} km²)`);

  if (SIN_SUBIR) return log("Solo revisión: no se cambió nada en Supabase.");
  if (zonas.length === 0) return log("Nada que subir.");
  for (let i = 0; i < zonas.length; i += 50) {
    const lote = zonas.slice(i, i + 50).map(({ nombre, fuente, osm_id, geometria }) => ({ nombre, fuente, osm_id, geometria }));
    const { data, error } = await db.rpc("importar_zonas", { p_zonas: lote });
    if (error) throw new Error(`Error al subir: ${error.message}`);
    log(`Subidas ${i + data} de ${zonas.length}`);
  }
  log("Listo: las localidades ya aparecen en el mapa y aceptan reportes de agua.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error("✗", e.message);
    process.exit(1);
  });
}
