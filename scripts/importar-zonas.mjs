#!/usr/bin/env node
// =====================================================================
// Reporta Cajeme · Importar zonas (colonias + hexágonos H3 de respaldo)
//
// Uso:
//   npm run importar-zonas                       → descarga de OSM y sube a Supabase
//   npm run importar-zonas -- --sin-subir        → solo genera data/zonas.geojson
//   npm run importar-zonas -- --desde-archivo    → sube data/zonas.geojson (p. ej. editado a mano)
//   npm run importar-zonas -- --solo-h3          → ignora colonias de OSM; todo en hexágonos
//   npm run importar-zonas -- --aproximado       → sin OSM: hexágonos sobre un contorno aproximado
//
// Cómo funciona:
//   1. Descarga de OpenStreetMap (Overpass) los polígonos de colonias de Ciudad Obregón.
//   2. Calcula la mancha urbana: hexágonos H3 (resolución 8, ~0.74 km²) donde hay calles residenciales.
//   3. Usa las colonias de OSM donde existen y rellena con hexágonos donde no hay colonia.
//   4. Guarda data/zonas.geojson y lo sube a Supabase con la función importar_zonas().
// =====================================================================

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config as cargarEnv } from "dotenv";
import { cellToBoundary, cellToLatLng, gridDisk, latLngToCell, polygonToCells } from "h3-js";
import osmtogeojson from "osmtogeojson";
import area from "@turf/area";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { createClient } from "@supabase/supabase-js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
cargarEnv({ path: join(RAIZ, ".env.local") });
cargarEnv({ path: join(RAIZ, ".env") });

const args = new Set(process.argv.slice(2));
const RES_H3 = 8;
// Caja que contiene Ciudad Obregón (sur, oeste, norte, este)
const BBOX = [27.40, -110.03, 27.56, -109.85];
const ARCHIVO = join(RAIZ, "data", "zonas.geojson");
const SERVIDORES = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

// Contorno aproximado de la mancha urbana (solo para --aproximado o si falla OSM)
const CONTORNO_APROXIMADO = [
  [-109.985, 27.455], [-109.965, 27.44], [-109.90, 27.44], [-109.885, 27.47],
  [-109.89, 27.52], [-109.92, 27.535], [-109.97, 27.53], [-109.99, 27.50], [-109.985, 27.455],
];

function log(...m) {
  console.log("•", ...m);
}

async function overpass(consulta) {
  let ultimoError;
  for (const url of SERVIDORES) {
    try {
      log(`Consultando ${new URL(url).host}…`);
      const res = await fetch(url, {
        method: "POST",
        body: new URLSearchParams({ data: consulta }),
        headers: { "User-Agent": "reporta-cajeme/1.0 (importador de colonias)" },
        signal: AbortSignal.timeout(180_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      ultimoError = e;
      log(`  falló (${e.message}); probando otro servidor…`);
    }
  }
  throw new Error(`No se pudo consultar OpenStreetMap: ${ultimoError?.message}`);
}

const bboxTexto = BBOX.join(",");

async function descargarColonias() {
  const datos = await overpass(`
    [out:json][timeout:170];
    (
      relation["place"~"^(neighbourhood|suburb|quarter)$"](${bboxTexto});
      way["place"~"^(neighbourhood|suburb|quarter)$"](${bboxTexto});
      relation["boundary"="administrative"]["admin_level"~"^(9|10)$"](${bboxTexto});
      relation["landuse"="residential"]["name"](${bboxTexto});
      way["landuse"="residential"]["name"](${bboxTexto});
    );
    out geom;`);
  const gj = osmtogeojson(datos);
  const prioridad = (p) => (p.place ? 0 : p.boundary ? 1 : 2);

  const candidatas = gj.features
    .filter((f) => f.geometry && /Polygon/.test(f.geometry.type) && f.properties?.name)
    .map((f) => ({ f, km2: area(f) / 1e6 }))
    .filter(({ km2 }) => km2 > 0.004 && km2 < 6) // descarta polígonos diminutos o gigantes
    .sort((a, b) => prioridad(a.f.properties) - prioridad(b.f.properties) || a.km2 - b.km2);

  // Evita colonias duplicadas o anidadas: si el centro de una ya cae en otra aceptada, se omite
  const aceptadas = [];
  for (const { f } of candidatas) {
    const centro = centroAproximado(f.geometry);
    if (aceptadas.some((a) => booleanPointInPolygon(centro, a))) continue;
    aceptadas.push(f);
  }
  log(`Colonias con polígono en OSM: ${aceptadas.length} (de ${gj.features.length} elementos)`);
  return aceptadas.map((f) => ({
    type: "Feature",
    properties: { nombre: limpiarNombre(f.properties.name), fuente: "osm", osm_id: String(f.id) },
    geometry: redondear(f.geometry),
  }));
}

async function descargarCallesYNombres() {
  const datos = await overpass(`
    [out:json][timeout:170];
    (
      way["highway"~"^(residential|living_street)$"](${bboxTexto});
    )->.calles;
    node(w.calles)->.nodos;
    node["place"~"^(neighbourhood|suburb|quarter)$"]["name"](${bboxTexto})->.lugares;
    (.nodos; .lugares;);
    out qt;`);
  const puntosCalle = [];
  const lugares = [];
  for (const e of datos.elements) {
    if (e.type !== "node") continue;
    if (e.tags?.place && e.tags?.name) lugares.push({ nombre: limpiarNombre(e.tags.name), lat: e.lat, lng: e.lon });
    else puntosCalle.push([e.lat, e.lon]);
  }
  log(`Puntos de calles residenciales: ${puntosCalle.length}; colonias marcadas solo como punto: ${lugares.length}`);
  return { puntosCalle, lugares };
}

/** Hexágonos donde hay ciudad: muchos nodos de calles residenciales. Rellena huecos (parques, etc.). */
function hexagonosUrbanos(puntosCalle) {
  const cuenta = new Map();
  for (const [lat, lng] of puntosCalle) {
    const h = latLngToCell(lat, lng, RES_H3);
    cuenta.set(h, (cuenta.get(h) ?? 0) + 1);
  }
  const urbanos = new Set([...cuenta].filter(([, n]) => n >= 20).map(([h]) => h));
  // Rellenar huecos: un hexágono rodeado por 4+ hexágonos urbanos también cuenta
  for (const h of [...urbanos].flatMap((x) => gridDisk(x, 1))) {
    if (urbanos.has(h)) continue;
    const vecinos = gridDisk(h, 1).filter((v) => v !== h && urbanos.has(v)).length;
    if (vecinos >= 4) urbanos.add(h);
  }
  return [...urbanos];
}

function hexagonosAproximados() {
  return polygonToCells([CONTORNO_APROXIMADO], RES_H3, true);
}

function zonasHex(hexes, colonias, lugares) {
  const libres = hexes.filter((h) => {
    const [lat, lng] = cellToLatLng(h);
    return !colonias.some((c) => booleanPointInPolygon([lng, lat], c));
  });
  // Numerar de norte a sur y de oeste a este para que "Sector 1" quede arriba a la izquierda
  libres.sort((a, b) => {
    const [la, ga] = cellToLatLng(a);
    const [lb, gb] = cellToLatLng(b);
    return Math.round((lb - la) * 100) || ga - gb;
  });
  return libres.map((h, i) => {
    const [lat, lng] = cellToLatLng(h);
    const cercano = lugarMasCercano(lugares, lat, lng, 1.2);
    const anillo = cellToBoundary(h, true).map(([x, y]) => [round6(x), round6(y)]);
    return {
      type: "Feature",
      properties: {
        nombre: cercano ? `Sector ${i + 1} (${cercano})` : `Sector ${i + 1}`,
        fuente: "h3",
        h3_index: h,
      },
      geometry: { type: "Polygon", coordinates: [anillo] },
    };
  });
}

function lugarMasCercano(lugares, lat, lng, maxKm) {
  let mejor = null;
  let mejorKm = maxKm;
  for (const l of lugares) {
    const km = Math.hypot((l.lat - lat) * 111, (l.lng - lng) * 111 * Math.cos((lat * Math.PI) / 180));
    if (km < mejorKm) {
      mejor = l.nombre;
      mejorKm = km;
    }
  }
  return mejor;
}

function centroAproximado(geom) {
  const anillo = geom.type === "Polygon" ? geom.coordinates[0] : geom.coordinates[0][0];
  const [sx, sy] = anillo.reduce(([x, y], [a, b]) => [x + a, y + b], [0, 0]);
  return [sx / anillo.length, sy / anillo.length];
}

function limpiarNombre(nombre) {
  return String(nombre).replace(/\s+/g, " ").trim().slice(0, 120);
}

const round6 = (n) => Math.round(n * 1e6) / 1e6;
function redondear(geom) {
  const r = (c) => (typeof c[0] === "number" ? [round6(c[0]), round6(c[1])] : c.map(r));
  return { type: geom.type, coordinates: r(geom.coordinates) };
}

async function subir(features) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local. " +
        "Llénalas o usa --sin-subir para solo generar el archivo.",
    );
  }
  const db = createClient(url, clave, { auth: { persistSession: false } });
  const LOTE = 40;
  let total = 0;
  for (let i = 0; i < features.length; i += LOTE) {
    const lote = features.slice(i, i + LOTE).map((f) => ({ ...f.properties, geometria: f.geometry }));
    const { data, error } = await db.rpc("importar_zonas", { p_zonas: lote });
    if (error) throw new Error(`Supabase respondió: ${error.message}`);
    total += data;
    process.stdout.write(`\r• Subiendo… ${Math.min(i + LOTE, features.length)}/${features.length}`);
  }
  console.log();
  log(`Listo: ${total} zonas guardadas en Supabase.`);
}

async function main() {
  let features;

  if (args.has("--desde-archivo")) {
    features = JSON.parse(readFileSync(ARCHIVO, "utf8")).features;
    log(`Leídas ${features.length} zonas de ${ARCHIVO}`);
  } else {
    let colonias = [];
    let hexes;
    let lugares = [];

    if (args.has("--aproximado")) {
      hexes = hexagonosAproximados();
    } else {
      try {
        if (!args.has("--solo-h3")) colonias = await descargarColonias();
        const calles = await descargarCallesYNombres();
        lugares = calles.lugares;
        hexes = hexagonosUrbanos(calles.puntosCalle);
        if (hexes.length < 30) {
          log("Se encontraron muy pocas calles; se usará el contorno aproximado de la ciudad.");
          hexes = hexagonosAproximados();
        }
      } catch (e) {
        log(e.message);
        log("Usando el contorno aproximado de la ciudad (solo hexágonos).");
        colonias = [];
        hexes = hexagonosAproximados();
      }
    }

    const relleno = zonasHex(hexes, colonias, lugares);
    features = [...colonias, ...relleno];
    log(`Total: ${colonias.length} colonias de OSM + ${relleno.length} hexágonos de respaldo = ${features.length} zonas`);

    mkdirSync(dirname(ARCHIVO), { recursive: true });
    writeFileSync(ARCHIVO, JSON.stringify({ type: "FeatureCollection", features }));
    log(`Archivo guardado: data/zonas.geojson (puedes revisarlo en https://geojson.io)`);
  }

  if (args.has("--sin-subir")) return;
  await subir(features);
}

main().catch((e) => {
  console.error("\n✖", e.message);
  process.exit(1);
});
