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
//   npm run importar-zonas -- --estricto         → si OSM no responde, falla en vez de usar el contorno aproximado
//   npm run importar-zonas -- --conservar        → no retira las zonas viejas que ya no aparecen
//   npm run importar-zonas -- --archivo data/colonias.kmz [--campo-nombre NOMBRE]
//        → usa las colonias de un archivo (KMZ, KML, GeoJSON o Shapefile en .zip) en lugar de OSM
//   npm run importar-zonas -- --archivo "https://www.arcgis.com/…?webmap=<id>" [--capa 2]
//        → descarga las colonias de un mapa o servicio PÚBLICO de ArcGIS
//
// Cómo funciona:
//   1. Descarga de OpenStreetMap (Overpass) los polígonos de colonias de Ciudad Obregón.
//   2. Calcula la mancha urbana: hexágonos H3 (resolución 8, ~0.74 km²) donde hay calles residenciales.
//   3. Usa las colonias de OSM donde existen y rellena con hexágonos donde no hay colonia.
//   4. Guarda data/zonas.geojson y lo sube a Supabase con la función importar_zonas().
//   5. Retira las zonas viejas (p. ej. "Sector N" que ahora cubre una colonia real),
//      pasando antes sus reportes a la zona nueva con retirar_zonas_viejas().
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
import { leerColonias } from "./leer-colonias.mjs";
import { descargarDeArcgis, esEntradaArcgis } from "./descargar-arcgis.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
cargarEnv({ path: join(RAIZ, ".env.local") });
cargarEnv({ path: join(RAIZ, ".env") });

const argv = process.argv.slice(2);
const args = new Set(argv);
/** Valor de una opción: "--archivo ruta" o "--archivo=ruta" */
function opcion(nombre) {
  const i = argv.indexOf(nombre);
  if (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--")) return argv[i + 1].trim();
  const conIgual = argv.find((a) => a.startsWith(`${nombre}=`));
  return conIgual ? conIgual.slice(nombre.length + 1).trim() : "";
}
const ARCHIVO_COLONIAS = opcion("--archivo");
const RES_H3 = 8;
// Caja que contiene Ciudad Obregón (sur, oeste, norte, este)
const BBOX = [27.40, -110.03, 27.56, -109.85];
const ARCHIVO = join(RAIZ, "data", "zonas.geojson");
const SERVIDORES = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
// Los servidores gratuitos de Overpass se saturan seguido: se reintenta varias rondas
const RONDAS = 4;
const ESPERA_ENTRE_RONDAS_S = [0, 30, 90, 180];

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
  for (let ronda = 0; ronda < RONDAS; ronda++) {
    if (ronda > 0) {
      log(`Todos los servidores están ocupados. Reintento ${ronda + 1}/${RONDAS} en ${ESPERA_ENTRE_RONDAS_S[ronda]} s…`);
      await new Promise((r) => setTimeout(r, ESPERA_ENTRE_RONDAS_S[ronda] * 1000));
    }
    for (const url of SERVIDORES) {
      try {
        log(`Consultando ${new URL(url).host}…`);
        const res = await fetch(url, {
          method: "POST",
          body: new URLSearchParams({ data: consulta }),
          headers: { "User-Agent": "reporta-cajeme/1.0 (importador de colonias)" },
          signal: AbortSignal.timeout(100_000),
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
  throw new Error(
    `No se pudo consultar OpenStreetMap (${ultimoError?.message}). ` +
      "Sus servidores gratuitos están saturados; vuelve a intentarlo en un rato.",
  );
}

/** Revisa las variables ANTES de descargar, para no esperar minutos y fallar al final. */
function revisarVariables() {
  const faltan = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].filter((v) => !process.env[v]?.trim());
  if (faltan.length) {
    throw new Error(
      `Falta: ${faltan.join(" y ")}. ` +
        "En tu computadora van en .env.local; en GitHub Actions, en Settings → Secrets and variables → Actions " +
        "(el nombre debe ser exactamente igual). O usa --sin-subir para solo generar el archivo.",
    );
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL.trim();
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url) && !/^http:\/\/localhost/.test(url)) {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL debe verse como https://xxxx.supabase.co (sin /rest/v1). Recibí: "${url}"`,
    );
  }
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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
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

  if (args.has("--conservar")) return;
  const osm = features.filter((f) => f.properties.fuente !== "h3").map((f) => f.properties.osm_id);
  const h3 = features.filter((f) => f.properties.fuente === "h3").map((f) => f.properties.h3_index);
  const { data: retiradas, error } = await db.rpc("retirar_zonas_viejas", { p_osm: osm, p_h3: h3 });
  if (error) {
    throw new Error(
      `No se pudieron retirar las zonas viejas: ${error.message}. ` +
        "¿Ya volviste a correr supabase/02_funciones.sql y 03_seguridad.sql en Supabase?",
    );
  }
  log(`Zonas viejas retiradas: ${retiradas} (sus reportes se pasaron a la zona nueva).`);
}

async function main() {
  let features;
  if (!args.has("--sin-subir")) revisarVariables();

  if (args.has("--desde-archivo")) {
    features = JSON.parse(readFileSync(ARCHIVO, "utf8")).features;
    log(`Leídas ${features.length} zonas de ${ARCHIVO}`);
  } else {
    let colonias = [];
    let hexes;
    let lugares = [];

    // Colonias de un archivo (oficial o dibujado a mano). Si el archivo falla, se detiene todo.
    if (ARCHIVO_COLONIAS) {
      let ruta = ARCHIVO_COLONIAS;
      if (esEntradaArcgis(ARCHIVO_COLONIAS)) {
        const gj = await descargarDeArcgis(ARCHIVO_COLONIAS, { capa: opcion("--capa") });
        ruta = "data/colonias-arcgis.geojson";
        mkdirSync(join(RAIZ, "data"), { recursive: true });
        writeFileSync(join(RAIZ, ruta), JSON.stringify(gj));
      }
      colonias = await leerColonias(ruta, RAIZ, { campoNombre: opcion("--campo-nombre") });
      if (args.has("--sin-subir")) {
        const nombres = colonias.map((c) => c.properties.nombre).sort((a, b) => a.localeCompare(b, "es"));
        log(`Colonias encontradas (${nombres.length}):\n    ${nombres.slice(0, 600).join(" · ")}`);
      }
    }

    if (args.has("--aproximado")) {
      hexes = hexagonosAproximados();
    } else {
      try {
        if (!args.has("--solo-h3") && !ARCHIVO_COLONIAS) colonias = await descargarColonias();
        const calles = await descargarCallesYNombres();
        lugares = calles.lugares;
        hexes = hexagonosUrbanos(calles.puntosCalle);
        if (hexes.length < 30) {
          log("Se encontraron muy pocas calles; se usará el contorno aproximado de la ciudad.");
          hexes = hexagonosAproximados();
        }
      } catch (e) {
        if (args.has("--estricto")) throw e;
        log(e.message);
        log("Usando el contorno aproximado de la ciudad para el relleno de hexágonos.");
        if (!ARCHIVO_COLONIAS) colonias = [];
        hexes = hexagonosAproximados();
      }
    }

    const relleno = zonasHex(hexes, colonias, lugares);
    features = [...colonias, ...relleno];
    log(`Total: ${colonias.length} colonias ${ARCHIVO_COLONIAS ? "del archivo" : "de OSM"} + ${relleno.length} hexágonos de respaldo = ${features.length} zonas`);

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
