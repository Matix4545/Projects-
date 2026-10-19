import assert from "node:assert/strict";
import { test } from "node:test";
// @ts-expect-error módulo JavaScript sin tipos
import { _usarFetch, anillosAMultipoligono, descargarDeArcgis, esEntradaArcgis } from "../scripts/descargar-arcgis.mjs";

type Respuestas = Record<string, unknown | ((url: URL) => unknown)>;
/** Simula ArcGIS: busca la respuesta por el inicio de la URL (sin parámetros) */
function simular(respuestas: Respuestas) {
  const pedidas: string[] = [];
  _usarFetch(async (url: string) => {
    pedidas.push(url);
    const u = new URL(url);
    const clave = Object.keys(respuestas)
      .filter((k) => `${u.origin}${u.pathname}` === k)
      .pop();
    if (!clave) return new Response("no", { status: 404 });
    const r = respuestas[clave];
    return Response.json(typeof r === "function" ? (r as (u: URL) => unknown)(u) : r);
  });
  return pedidas;
}

const cuadro = (s: number, w: number, n: number, e: number) => [[[w, s], [e, s], [e, n], [w, n], [w, s]]];
const ID = "2adb526d7a5e44159094ddb0b2ba4e8d";
const SERV = "https://services.arcgis.com/abc/arcgis/rest/services/Cajeme/FeatureServer";

test("reconoce enlaces de ArcGIS", () => {
  assert.equal(esEntradaArcgis(`https://www.arcgis.com/apps/mapviewer/index.html?webmap=${ID}`), true);
  assert.equal(esEntradaArcgis(ID), true);
  assert.equal(esEntradaArcgis("data/colonias.kmz"), false);
});

test("mapa web: elige la capa de colonias y descarga todas las páginas en GeoJSON", async () => {
  const total = 1003;
  simular({
    [`https://www.arcgis.com/sharing/rest/content/items/${ID}`]: { title: "Colonias Cajeme", type: "Web Map", owner: "imip" },
    [`https://www.arcgis.com/sharing/rest/content/items/${ID}/data`]: {
      operationalLayers: [
        { title: "Escuelas", url: `${SERV}/0` },
        { title: "Grupo", layers: [{ title: "Colonias y fraccionamientos", url: `${SERV}/3` }] },
      ],
    },
    [`${SERV}/0`]: { name: "Escuelas", geometryType: "esriGeometryPoint" },
    [`${SERV}/3`]: { name: "Colonias y fraccionamientos", geometryType: "esriGeometryPolygon" },
    [`${SERV}/3/query`]: (u: URL) => {
      const desde = Number(u.searchParams.get("resultOffset"));
      const n = Math.min(1000, total - desde);
      return {
        type: "FeatureCollection",
        features: Array.from({ length: n }, (_, i) => ({ type: "Feature", properties: { NOMBRE: `COL ${desde + i}` }, geometry: { type: "Polygon", coordinates: cuadro(27.48, -109.94, 27.49, -109.93) } })),
        properties: { exceededTransferLimit: desde + n < total },
      };
    },
  });
  const fc = await descargarDeArcgis(`https://www.arcgis.com/apps/mapviewer/index.html?webmap=${ID}`);
  assert.equal(fc.features.length, total);
  assert.equal(fc.features[1002].properties.NOMBRE, "COL 1002");
});

test("servidor viejo sin GeoJSON: convierte Esri JSON en Web Mercator con huecos", async () => {
  // Cuadro exterior (horario) y un hueco (antihorario) en metros Web Mercator
  const m = (lng: number, lat: number) => [(lng * Math.PI * 6378137) / 180, Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 6378137];
  const exterior = [m(-109.94, 27.48), m(-109.94, 27.49), m(-109.93, 27.49), m(-109.93, 27.48), m(-109.94, 27.48)];
  const hueco = [m(-109.936, 27.484), m(-109.934, 27.484), m(-109.934, 27.486), m(-109.936, 27.486), m(-109.936, 27.484)];
  simular({
    [`${SERV}/2`]: { name: "Colonias", geometryType: "esriGeometryPolygon" },
    [`${SERV}/2/query`]: (u: URL) =>
      u.searchParams.get("f") === "geojson"
        ? { error: { code: 400, message: "Invalid format" } }
        : { spatialReference: { wkid: 102100 }, features: [{ attributes: { NOMBRE: "LAS MISIONES" }, geometry: { rings: [exterior, hueco] } }] },
  });
  const fc = await descargarDeArcgis(`${SERV}/2`);
  assert.equal(fc.features.length, 1);
  const [poligono] = fc.features[0].geometry.coordinates;
  assert.equal(poligono.length, 2, "exterior + hueco");
  assert.ok(Math.abs(poligono[0][0][0] - -109.94) < 1e-6 && Math.abs(poligono[0][0][1] - 27.48) < 1e-6);
});

test("capa privada: mensaje claro", async () => {
  simular({ [`${SERV}/5`]: { error: { code: 499, message: "Token Required" } } });
  await assert.rejects(() => descargarDeArcgis(`${SERV}/5`), /no es pública/);
});

test("anillosAMultipoligono separa dos polígonos exteriores", () => {
  const a = [[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]];
  const b = [[5, 5], [5, 6], [6, 6], [6, 5], [5, 5]];
  assert.equal(anillosAMultipoligono([a, b], { wkid: 4326 }).length, 2);
});
