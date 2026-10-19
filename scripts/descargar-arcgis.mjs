// =====================================================================
// Reporta Cajeme · Descargar colonias de ArcGIS (ArcGIS Online / ArcGIS Server)
//
// Acepta:
//   · Enlace de un mapa:   https://www.arcgis.com/apps/mapviewer/index.html?webmap=<id>
//   · Enlace de un ítem:   https://www.arcgis.com/home/item.html?id=<id>
//   · Solo el id (32 caracteres hexadecimales)
//   · URL de un servicio:  https://…/FeatureServer, …/FeatureServer/0, …/MapServer/2
// Busca las capas de polígonos, elige la de colonias (o la que indiques con "capa")
// y la descarga completa en latitud/longitud como GeoJSON.
// Solo funciona con capas PÚBLICAS (sin usuario ni contraseña).
// =====================================================================

const PORTAL = "https://www.arcgis.com/sharing/rest/content/items";
const POR_PAGINA = 1000;
const PALABRAS_COLONIA = /colonia|fracc|asentamiento|barrio|neighbo|sector|zona habitacional/i;

let _fetch = (...a) => globalThis.fetch(...a);
/** Solo para pruebas: reemplaza fetch */
export function _usarFetch(f) {
  _fetch = f;
}

async function pedirJson(url) {
  const res = await _fetch(url, { headers: { "User-Agent": "reporta-cajeme/1.0" }, signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`ArcGIS respondió HTTP ${res.status} en ${url}`);
  const datos = await res.json();
  if (datos?.error) {
    const msg = datos.error.message ?? JSON.stringify(datos.error);
    if (datos.error.code === 499 || datos.error.code === 498 || /token|permission|access/i.test(msg)) {
      throw new Error(`La capa de ArcGIS no es pública (pide iniciar sesión): ${msg}`);
    }
    throw new Error(`ArcGIS respondió un error: ${msg}`);
  }
  return datos;
}

export function esEntradaArcgis(entrada) {
  return /^https?:\/\//i.test(entrada) || /^[0-9a-f]{32}$/i.test(entrada.trim());
}

function idDeItem(entrada) {
  const t = entrada.trim();
  if (/^[0-9a-f]{32}$/i.test(t)) return t;
  try {
    const u = new URL(t);
    const id = u.searchParams.get("webmap") ?? u.searchParams.get("id") ?? u.searchParams.get("appid");
    if (id && /^[0-9a-f]{32}$/i.test(id)) return id;
  } catch {
    /* no es URL */
  }
  return null;
}

const esServicio = (url) => /\/(FeatureServer|MapServer)(\/\d+)?\/?$/i.test(url.split("?")[0]);
const limpiarUrl = (url) => url.split("?")[0].replace(/\/+$/, "");

/** De una URL de servicio, lista sus capas de polígonos: [{titulo, url}] */
async function capasDeServicio(url, tituloPadre = "") {
  const base = limpiarUrl(url);
  if (/\/\d+$/.test(base)) {
    const info = await pedirJson(`${base}?f=json`);
    return info.geometryType === "esriGeometryPolygon" ? [{ titulo: info.name ?? tituloPadre, url: base }] : [];
  }
  const info = await pedirJson(`${base}?f=json`);
  const capas = [];
  for (const capa of info.layers ?? []) {
    if (capa.subLayerIds?.length) continue; // grupo de capas
    if (capa.geometryType && capa.geometryType !== "esriGeometryPolygon") continue;
    capas.push(...(await capasDeServicio(`${base}/${capa.id}`, capa.name)));
  }
  return capas;
}

/** Lista las capas de polígonos de un mapa web (incluye capas incrustadas en el mapa). */
async function capasDeMapa(id) {
  const item = await pedirJson(`${PORTAL}/${id}?f=json`);
  console.log(`• ArcGIS: "${item.title ?? id}"${item.owner ? ` (de ${item.owner})` : ""}`);
  if (item.type && item.type !== "Web Map") {
    if (item.url) return capasDeServicio(item.url, item.title);
    throw new Error(`El ítem de ArcGIS es de tipo "${item.type}" y no tiene capas que descargar`);
  }
  const datos = await pedirJson(`${PORTAL}/${id}/data?f=json`);
  const capas = [];
  const recorrer = async (lista) => {
    for (const capa of lista ?? []) {
      if (capa.layers && !capa.url && !capa.featureCollection) await recorrer(capa.layers); // grupo
      else if (capa.url) {
        try {
          capas.push(...(await capasDeServicio(capa.url, capa.title)));
        } catch (e) {
          console.log(`  · No se pudo leer la capa "${capa.title}": ${e.message}`);
        }
      } else if (capa.featureCollection) {
        for (const sub of capa.featureCollection.layers ?? []) {
          if (sub.layerDefinition?.geometryType === "esriGeometryPolygon") {
            capas.push({ titulo: capa.title ?? sub.layerDefinition?.name, incrustada: sub.featureSet });
          }
        }
      }
    }
  };
  await recorrer(datos.operationalLayers);
  return capas;
}

function elegirCapa(capas, capaPedida) {
  if (capas.length === 0) throw new Error("No se encontró ninguna capa de polígonos pública en ese enlace de ArcGIS.");
  console.log(`• Capas de polígonos encontradas:\n${capas.map((c, i) => `    ${i + 1}. ${c.titulo}`).join("\n")}`);
  if (capaPedida) {
    const n = Number(capaPedida);
    const porNumero = Number.isInteger(n) && n >= 1 && n <= capas.length ? capas[n - 1] : null;
    const porNombre = capas.find((c) => c.titulo?.toLowerCase().includes(capaPedida.toLowerCase()));
    const elegida = porNumero ?? porNombre;
    if (!elegida) throw new Error(`No hay ninguna capa "${capaPedida}". Escribe el número o parte del nombre de la lista de arriba.`);
    return elegida;
  }
  const deColonias = capas.filter((c) => PALABRAS_COLONIA.test(c.titulo ?? ""));
  if (deColonias.length >= 1) return deColonias[0];
  if (capas.length === 1) return capas[0];
  throw new Error('Hay varias capas y no sé cuál es la de colonias. Vuelve a correrlo escribiendo en "capa" su número o parte de su nombre.');
}

// ---------- Conversión Esri JSON → GeoJSON ----------
const R = 6378137;
function mercatorALatLng([x, y]) {
  return [(x / R) * (180 / Math.PI), (Math.atan(Math.exp(y / R)) * 2 - Math.PI / 2) * (180 / Math.PI)];
}
function areaFirmada(anillo) {
  let s = 0;
  for (let i = 0; i < anillo.length - 1; i++) s += (anillo[i + 1][0] - anillo[i][0]) * (anillo[i + 1][1] + anillo[i][1]);
  return s; // > 0 = sentido horario (en Esri, anillo exterior)
}
function puntoEnAnillo([x, y], anillo) {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i];
    const [xj, yj] = anillo[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}
/** Anillos Esri (exterior horario, huecos antihorario) → coordenadas de MultiPolygon */
export function anillosAMultipoligono(anillos, sr) {
  const mercator = [102100, 102113, 3857, 900913].includes(sr?.latestWkid ?? sr?.wkid);
  const conv = anillos.map((a) => (mercator ? a.map(mercatorALatLng) : a.map((p) => [p[0], p[1]])));
  const poligonos = [];
  const huecos = [];
  for (const a of conv) (areaFirmada(a) > 0 ? poligonos.push([a]) : huecos.push(a));
  if (poligonos.length === 0) return huecos.map((h) => [h]); // orientación invertida: se toman todos como exteriores
  for (const h of huecos) {
    const dueno = poligonos.find((p) => puntoEnAnillo(h[0], p[0]));
    if (dueno) dueno.push(h);
  }
  return poligonos;
}
function esriAGeojson(features, sr) {
  return features
    .filter((f) => f.geometry?.rings?.length)
    .map((f) => ({
      type: "Feature",
      properties: f.attributes ?? {},
      geometry: { type: "MultiPolygon", coordinates: anillosAMultipoligono(f.geometry.rings, f.geometry.spatialReference ?? sr) },
    }));
}

/** Descarga todos los elementos de una capa, por páginas, en lat/lng. */
async function descargarCapa(url) {
  const features = [];
  let usarGeojson = true;
  for (let offset = 0; offset < 200_000; ) {
    const q = new URLSearchParams({
      where: "1=1",
      outFields: "*",
      outSR: "4326",
      returnGeometry: "true",
      resultOffset: String(offset),
      resultRecordCount: String(POR_PAGINA),
      f: usarGeojson ? "geojson" : "json",
    });
    let datos;
    try {
      datos = await pedirJson(`${url}/query?${q}`);
    } catch (e) {
      if (usarGeojson && offset === 0 && !/no es pública/.test(e.message)) {
        usarGeojson = false; // servidores viejos no soportan f=geojson
        continue;
      }
      throw e;
    }
    const pagina = usarGeojson ? (datos.features ?? []) : esriAGeojson(datos.features ?? [], datos.spatialReference);
    features.push(...pagina);
    const hayMas = datos.exceededTransferLimit || datos.properties?.exceededTransferLimit || pagina.length === POR_PAGINA;
    if (!hayMas || pagina.length === 0) break;
    offset += pagina.length;
    process.stdout.write(`\r• Descargando… ${features.length}`);
  }
  if (features.length > POR_PAGINA) console.log();
  return features;
}

/**
 * Descarga la capa de colonias de un enlace de ArcGIS y devuelve un FeatureCollection en lat/lng.
 * @param {string} entrada  enlace del mapa, del ítem, id o URL del servicio
 * @param {{capa?: string}} opciones  número o nombre de la capa si hay varias
 */
export async function descargarDeArcgis(entrada, { capa } = {}) {
  const url = entrada.trim();
  let capas;
  if (esServicio(url)) capas = await capasDeServicio(url);
  else {
    const id = idDeItem(url);
    if (!id) throw new Error("No reconozco ese enlace de ArcGIS. Debe incluir ?webmap=… o ?id=…, o ser la URL de un FeatureServer/MapServer.");
    capas = await capasDeMapa(id);
  }
  const elegida = elegirCapa(capas, capa);
  console.log(`• Descargando la capa "${elegida.titulo}"…`);
  const features = elegida.incrustada
    ? esriAGeojson(elegida.incrustada.features ?? [], elegida.incrustada.spatialReference)
    : await descargarCapa(elegida.url);
  console.log(`• Descargados ${features.length} polígonos de ArcGIS`);
  return { type: "FeatureCollection", features };
}
