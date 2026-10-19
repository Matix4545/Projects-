// =====================================================================
// Reporta Cajeme · Leer colonias desde un archivo
// Formatos: GeoJSON (.geojson/.json), KML (.kml), KMZ (.kmz) y Shapefile en .zip
// (con su .prj: si viene en UTM u otra proyección, se convierte a lat/lng).
// Devuelve zonas listas para importar_zonas() con fuente "oficial".
// =====================================================================

import { readFileSync } from "node:fs";
import { extname, isAbsolute, relative, resolve } from "node:path";
import { DOMParser } from "@xmldom/xmldom";
import { kml } from "@tmcw/togeojson";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import shp from "shpjs";
import area from "@turf/area";

export const EXTENSIONES = [".geojson", ".json", ".kml", ".kmz", ".zip"];

// Columnas donde suele venir el nombre de la colonia (se comparan sin mayúsculas)
const CAMPOS_NOMBRE = [
  "nombre", "name", "nom_col", "nom_colonia", "nombre_col", "colonia", "nomcol", "nom_asen", "d_asenta",
  "asentamiento", "nom_asenta", "nom_fracc", "fraccionamiento", "nombre_asentamiento", "nom", "label",
];

// Zona amplia alrededor de Cajeme para descartar polígonos de otros lugares
const LIMITES = { sur: 27.3, norte: 27.65, oeste: -110.15, este: -109.75 };

/** Abre el archivo y devuelve un arreglo de "features" GeoJSON (sin procesar). */
async function abrir(ruta) {
  const ext = extname(ruta).toLowerCase();
  const datos = readFileSync(ruta);
  if (ext === ".geojson" || ext === ".json") return aFeatures(JSON.parse(datos.toString("utf8")));
  if (ext === ".kml") return aFeatures(kmlAGeojson(datos.toString("utf8")));
  if (ext === ".kmz") {
    const archivos = unzipSync(new Uint8Array(datos));
    const nombreKml = Object.keys(archivos).find((n) => n.toLowerCase().endsWith(".kml"));
    if (!nombreKml) throw new Error("El KMZ no contiene ningún archivo .kml");
    return aFeatures(kmlAGeojson(strFromU8(archivos[nombreKml])));
  }
  if (ext === ".zip") return abrirShapefile(datos);
  throw new Error(`Formato no soportado (${ext || "sin extensión"}). Usa: ${EXTENSIONES.join(", ")}`);
}

/**
 * Shapefile en .zip. Muchos Shapefiles mexicanos traen los acentos en Latin-1 sin decirlo
 * (sin archivo .cpg); si al leerlos aparecen caracteres rotos (�), se vuelven a leer como Windows-1252.
 */
async function abrirShapefile(datos) {
  const archivos = unzipSync(new Uint8Array(datos));
  const nombres = Object.keys(archivos);
  const shpArchivo = nombres.find((n) => n.toLowerCase().endsWith(".shp"));
  if (!shpArchivo) throw new Error("El .zip no contiene un Shapefile (.shp)");
  if (!nombres.some((n) => n.toLowerCase().endsWith(".prj"))) {
    console.log("• Aviso: el Shapefile no trae .prj; se asume que ya está en latitud/longitud (WGS84).");
  }
  let features = aFeatures(await shp(datos));
  const roto = features.some((f) => Object.values(f.properties ?? {}).some((v) => typeof v === "string" && v.includes("\uFFFD")));
  if (roto && !nombres.some((n) => n.toLowerCase().endsWith(".cpg"))) {
    console.log("• Acentos en Latin-1 detectados; se vuelve a leer como Windows-1252.");
    const base = shpArchivo.slice(0, -4);
    const conCpg = zipSync({ ...archivos, [`${base}.cpg`]: strToU8("windows-1252") });
    features = aFeatures(await shp(Buffer.from(conCpg)));
  }
  return features;
}

function kmlAGeojson(texto) {
  return kml(new DOMParser().parseFromString(texto, "text/xml"));
}

function aFeatures(gj) {
  if (Array.isArray(gj)) return gj.flatMap(aFeatures); // shpjs devuelve una lista si hay varias capas
  if (gj?.type === "FeatureCollection") return gj.features ?? [];
  if (gj?.type === "Feature") return [gj];
  throw new Error("El archivo no tiene un formato GeoJSON válido");
}

/** Solo polígonos (también saca los polígonos de un GeometryCollection). */
function poligonos(geom) {
  if (!geom) return [];
  if (geom.type === "Polygon") return [geom.coordinates];
  if (geom.type === "MultiPolygon") return geom.coordinates;
  if (geom.type === "GeometryCollection") return geom.geometries.flatMap(poligonos);
  return [];
}

const round6 = (n) => Math.round(n * 1e6) / 1e6;
const redondear = (c) => (typeof c[0] === "number" ? [round6(c[0]), round6(c[1])] : c.map(redondear));

function centro(coords) {
  const anillo = coords[0][0];
  const [x, y] = anillo.reduce(([a, b], [px, py]) => [a + px, b + py], [0, 0]);
  return [x / anillo.length, y / anillo.length];
}

const PALABRAS_MENORES = new Set(["de", "del", "la", "las", "los", "el", "y", "e", "en"]);
const SIGLAS = new Set(["IMSS", "ISSSTE", "ISSSTESON", "FOVISSSTE", "INFONAVIT", "ITSON", "CERESO", "CDAO", "CFE", "UNISON", "CBTIS", "CONALEP", "DIF", "PRI", "PAN", "SNTE", "CTM", "CNOP"]);
const ROMANOS = /^(i{1,3}|iv|v|vi{1,3}|ix|x{1,3})$/i;

/**
 * Corrige nombres escritos en MAYÚSCULAS (aunque sea en parte):
 * "VALLE DE HEROES 1ra AMP" → "Valle de Heroes 1ra Amp"; respeta números romanos y siglas.
 * Los nombres que ya vienen bien escritos se dejan igual. Un nombre sin letras ("?") se considera vacío.
 */
export function arreglarNombre(nombre) {
  const limpio = String(nombre ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  const letras = limpio.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, "");
  if (!letras) return "";
  const mayusculas = letras.replace(/[^A-ZÁÉÍÓÚÜÑ]/g, "").length;
  const conviene = mayusculas / letras.length >= 0.6;
  return limpio
    .split(" ")
    .map((p, i) => {
      const base = p.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, "");
      if (SIGLAS.has(base.toUpperCase())) return p.toUpperCase();
      if (ROMANOS.test(base) && i > 0) return p.toUpperCase();
      if (!conviene) return p;
      const minus = p.toLowerCase();
      if (i > 0 && PALABRAS_MENORES.has(minus)) return minus;
      return minus.replace(/^([^a-záéíóúüñ0-9]*)([a-záéíóúüñ])/, (_, pre, l) => pre + l.toUpperCase());
    })
    .join(" ");
}

function slug(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "colonia";
}

function campoDeNombre(features, forzado) {
  const claves = new Set(features.flatMap((f) => Object.keys(f.properties ?? {})));
  if (forzado) {
    const real = [...claves].find((k) => k.toLowerCase() === forzado.toLowerCase());
    if (!real) throw new Error(`No existe la columna "${forzado}". Columnas disponibles: ${[...claves].join(", ") || "(ninguna)"}`);
    return real;
  }
  for (const candidato of CAMPOS_NOMBRE) {
    const real = [...claves].find((k) => k.toLowerCase() === candidato);
    if (real) return real;
  }
  return null;
}

/**
 * Lee el archivo de colonias y devuelve zonas {type, properties:{nombre, fuente:"oficial", osm_id}, geometry}.
 * @param {string} ruta  ruta dentro del proyecto (p. ej. data/colonias.kmz)
 * @param {string} raiz  carpeta del proyecto (no se aceptan rutas fuera de ella)
 * @param {{campoNombre?: string}} opciones
 */
export async function leerColonias(ruta, raiz, { campoNombre } = {}) {
  const absoluta = resolve(raiz, ruta);
  const rel = relative(raiz, absoluta);
  if (rel.startsWith("..") || isAbsolute(rel)) throw new Error("La ruta del archivo debe estar dentro del proyecto (p. ej. data/colonias.kmz)");
  if (!EXTENSIONES.includes(extname(absoluta).toLowerCase())) {
    throw new Error(`Formato no soportado. Usa: ${EXTENSIONES.join(", ")}`);
  }

  const crudas = await abrir(absoluta);
  console.log(`• Elementos en el archivo: ${crudas.length}`);

  const conPoligono = crudas
    .map((f) => ({ props: f.properties ?? {}, coords: poligonos(f.geometry) }))
    .filter((f) => f.coords.length > 0);
  if (conPoligono.length === 0) throw new Error("El archivo no contiene polígonos (solo puntos o líneas).");

  const [x0, y0] = centro(conPoligono[0].coords);
  if (Math.abs(x0) > 180 || Math.abs(y0) > 90) {
    throw new Error(
      "Las coordenadas parecen estar en metros (UTM) y no en latitud/longitud. " +
        "Sube el Shapefile completo en .zip (incluyendo el archivo .prj) o expórtalo como KMZ.",
    );
  }

  const columnas = [...new Set(conPoligono.flatMap((f) => Object.keys(f.props)))];
  console.log(`• Columnas del archivo: ${columnas.join(", ") || "(ninguna)"}`);
  const campo = campoDeNombre(conPoligono.map((f) => ({ properties: f.props })), campoNombre);
  console.log(`• Columna usada para el nombre: ${campo ?? "(no se encontró; se numerarán)"}`);

  const usados = new Map();
  const zonas = [];
  const nombresFuera = [];
  let fuera = 0;
  let descartadas = 0;
  conPoligono.forEach((f, i) => {
    const [lng, lat] = centro(f.coords);
    if (lat < LIMITES.sur || lat > LIMITES.norte || lng < LIMITES.oeste || lng > LIMITES.este) {
      fuera++;
      nombresFuera.push(arreglarNombre(campo ? f.props[campo] : "") || "(sin nombre)");
      return;
    }
    const geometry = { type: "MultiPolygon", coordinates: redondear(f.coords) };
    const km2 = area({ type: "Feature", properties: {}, geometry }) / 1e6;
    if (km2 < 0.0005 || km2 > 20) {
      descartadas++;
      return;
    }
    const nombre = arreglarNombre(campo ? f.props[campo] : "") || `Colonia ${i + 1}`;
    const base = slug(nombre);
    const n = (usados.get(base) ?? 0) + 1;
    usados.set(base, n);
    zonas.push({
      type: "Feature",
      properties: { nombre, fuente: "oficial", osm_id: `archivo/${n > 1 ? `${base}-${n}` : base}` },
      geometry,
    });
  });

  if (fuera) console.log(`• Omitidas ${fuera} zonas fuera del área de la app: ${nombresFuera.join(", ")}`);
  if (descartadas) console.log(`• Omitidas ${descartadas} zonas demasiado pequeñas o enormes (p. ej. el límite del municipio)`);
  if (zonas.length === 0) throw new Error("No quedó ninguna colonia dentro de Cajeme. ¿Es el archivo correcto?");
  console.log(`• Colonias leídas del archivo: ${zonas.length}`);
  return zonas;
}
