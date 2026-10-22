import assert from "node:assert/strict";
import { test } from "node:test";
import { seccionEn, topSecciones, type SeccionesGeoJSON } from "../lib/secciones.ts";

const props = (seccion: number, total: number) => ({ seccion, distrito_local: 16, distrito_federal: 6, total, puntos: total, agua: 0 });
const fc: SeccionesGeoJSON = {
  type: "FeatureCollection",
  features: [
    // Sección 1 con un hueco en medio (ahí está la 2)
    { type: "Feature", properties: props(1, 3), geometry: { type: "Polygon", coordinates: [
      [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
      [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]],
    ] } },
    { type: "Feature", properties: props(2, 9), geometry: { type: "MultiPolygon", coordinates: [[[[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]]]] } },
    { type: "Feature", properties: props(3, 0), geometry: { type: "Polygon", coordinates: [[[20, 20], [21, 20], [21, 21], [20, 21], [20, 20]]] } },
  ],
};

test("encuentra la sección de un punto, respetando huecos", () => {
  assert.equal(seccionEn(1, 1, fc)?.seccion, 1);
  assert.equal(seccionEn(5, 5, fc)?.seccion, 2);
  assert.equal(seccionEn(50, 50, fc), null);
});

test("top de secciones ignora las que no tienen reportes", () => {
  assert.deepEqual(topSecciones(fc, 5).map((s) => s.seccion), [2, 1]);
});
