#!/usr/bin/env node
// =====================================================================
// Reporta Cajeme · Importar calles (OpenStreetMap)
//
// Descarga las calles del municipio de Cajeme y las sube a Supabase (tabla "calles"). Con ellas,
// cada bache que detecta la cámara se acomoda dentro de la calle por la que iba el vehículo (el GPS
// de un celular se equivoca de 3 a 10 m) y se guarda el nombre de la calle.
//
// Uso:
//   npm run importar-calles                  → descarga de OpenStreetMap y reemplaza las calles en Supabase
//   npm run importar-calles -- --sin-subir   → solo descarga y muestra el resumen (y guarda data/calles.geojson)
//
// El ancho de cada calle sale de la etiqueta "width" de OSM; si no la tiene, del número de carriles
// ("lanes") y si tampoco, de un valor típico por tipo de calle.
// =====================================================================

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const SERVIDORES = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
const TIPOS = "motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link";
const CONSULTA = `[out:json][timeout:300];
rel["boundary"="administrative"]["admin_level"="6"]["name"="Cajeme"];
map_to_area->.m;
way(area.m)["highway"~"^(${TIPOS})$"]["area"!="yes"]["service"!~"^(parking_aisle|driveway|drive-through)$"];
out geom tags;`;

/** Ancho típico de banqueta a banqueta (m): [doble sentido, un sentido (un lado de un bulevar)] */
const ANCHO_TIPICO = {
  motorway: [22, 11],
  trunk: [20, 10.5],
  primary: [18, 10.5],
  secondary: [14, 9],
  tertiary: [11, 7.5],
  unclassified: [9, 6.5],
  residential: [9, 6.5],
  living_street: [6, 5],
  service: [5, 4],
};

/** Ancho estimado de una calle a partir de sus etiquetas de OSM */
export function anchoCalle(tags) {
  const tipo = String(tags.highway ?? "").replace(/_link$/, "");
  const unSentido = tags.oneway === "yes" || tags.oneway === "1" || tags.oneway === "-1" || tags.junction === "roundabout";
  const ancho = parseFloat(String(tags.width ?? "").replace(",", "."));
  if (Number.isFinite(ancho) && ancho >= 2.5 && ancho <= 60) return Math.round(ancho * 10) / 10;
  const carriles = parseInt(String(tags.lanes ?? ""), 10);
  if (Number.isFinite(carriles) && carriles >= 1 && carriles <= 10) return Math.round((carriles * 3.3 + (unSentido ? 1 : 2)) * 10) / 10;
  if (String(tags.highway).endsWith("_link")) return 7;
  const [doble, uno] = ANCHO_TIPICO[tipo] ?? [8, 6];
  return unSentido ? uno : doble;
}

/** Respuesta de Overpass → filas para importar_calles() */
export function aCalles(datos) {
  const filas = [];
  for (const e of datos.elements ?? []) {
    if (e.type !== "way" || !Array.isArray(e.geometry) || e.geometry.length < 2) continue;
    const t = e.tags ?? {};
    filas.push({
      osm_id: `way/${e.id}`,
      nombre: (t.name ?? t.ref ?? "").trim().slice(0, 120) || null,
      tipo: String(t.highway),
      sentido_unico: t.oneway === "yes" || t.oneway === "1" || t.oneway === "-1" || t.junction === "roundabout",
      ancho_m: anchoCalle(t),
      geom: { type: "LineString", coordinates: e.geometry.map((p) => [Math.round(p.lon * 1e7) / 1e7, Math.round(p.lat * 1e7) / 1e7]) },
    });
  }
  return filas;
}

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
          headers: { "User-Agent": "reporta-cajeme/1.0 (importador de calles)" },
          signal: AbortSignal.timeout(330_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const datos = await res.json();
        if (!datos.elements?.length) throw new Error("respuesta vacía");
        return datos;
      } catch (e) {
        ultimoError = e;
        log(`  falló: ${e.message}`);
      }
    }
  }
  throw new Error(`OpenStreetMap no respondió: ${ultimoError?.message}`);
}

function largoKm(coords) {
  let m = 0;
  for (let i = 1; i < coords.length; i++) {
    const [x1, y1] = coords[i - 1];
    const [x2, y2] = coords[i];
    const k = Math.cos((((y1 + y2) / 2) * Math.PI) / 180);
    m += Math.hypot((x2 - x1) * 111_320 * k, (y2 - y1) * 111_132);
  }
  return m / 1000;
}

async function principal() {
  const SIN_SUBIR = process.argv.includes("--sin-subir");
  log("Descargando las calles de Cajeme de OpenStreetMap (puede tardar 1–3 min)…");
  const calles = aCalles(await overpass(CONSULTA));
  if (calles.length < 100) throw new Error(`Solo llegaron ${calles.length} calles; algo salió mal. No se cambió nada.`);

  const porTipo = {};
  for (const c of calles) porTipo[c.tipo] = (porTipo[c.tipo] ?? 0) + largoKm(c.geom.coordinates);
  log(`${calles.length} tramos de calle, ${calles.filter((c) => c.nombre).length} con nombre:`);
  for (const [tipo, km] of Object.entries(porTipo).sort((a, b) => b[1] - a[1])) log(`  ${tipo.padEnd(16)} ${km.toFixed(0).padStart(6)} km`);
  writeFileSync(
    join(RAIZ, "data", "calles.geojson"),
    JSON.stringify({ type: "FeatureCollection", features: calles.map(({ geom, ...p }) => ({ type: "Feature", properties: p, geometry: geom })) }),
  );
  log("Guardado data/calles.geojson (puedes verlo en geojson.io).");
  if (SIN_SUBIR) return;

  const { config } = await import("dotenv");
  config({ path: join(RAIZ, ".env.local") });
  config({ path: join(RAIZ, ".env") });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(url, clave, { auth: { persistSession: false } });
  const LOTE = 800;
  let total = 0;
  for (let i = 0; i < calles.length; i += LOTE) {
    const { data, error } = await db.rpc("importar_calles", { p_calles: calles.slice(i, i + LOTE), p_borrar_antes: i === 0 });
    if (error) throw new Error(`Supabase: ${error.message}. ¿Ya corriste 01_esquema.sql, 02_funciones.sql y 03_seguridad.sql?`);
    total += data;
    log(`Subidas ${Math.min(i + LOTE, calles.length)} de ${calles.length}…`);
  }
  log(`✅ ${total} tramos de calle en Supabase.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  principal().catch((e) => {
    console.error("❌", e.message);
    process.exit(1);
  });
}
