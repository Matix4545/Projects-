import assert from "node:assert/strict";
import { test } from "node:test";
// @ts-expect-error: script de Node sin tipos
import { aCalles, anchoCalle } from "../scripts/importar-calles.mjs";

test("ancho de la calle: etiqueta width, luego carriles, luego típico por tipo", () => {
  assert.equal(anchoCalle({ highway: "residential", width: "7,5" }), 7.5);
  assert.equal(anchoCalle({ highway: "primary", lanes: "3", oneway: "yes" }), 10.9);
  assert.equal(anchoCalle({ highway: "residential" }), 9);
  assert.equal(anchoCalle({ highway: "primary", oneway: "yes" }), 10.5);
  assert.equal(anchoCalle({ highway: "secondary_link" }), 7);
  assert.equal(anchoCalle({ highway: "track" }), 8);
});

test("respuesta de Overpass → calles", () => {
  const filas = aCalles({
    elements: [
      { type: "way", id: 5, tags: { highway: "residential", name: " Calle Jalisco " }, geometry: [{ lat: 27.485, lon: -109.9405 }, { lat: 27.488, lon: -109.9405 }] },
      { type: "way", id: 6, tags: { highway: "primary", ref: "MEX 15", oneway: "yes" }, geometry: [{ lat: 27.4, lon: -109.9 }, { lat: 27.41, lon: -109.9 }] },
      { type: "way", id: 7, tags: { highway: "service" }, geometry: [{ lat: 27.4, lon: -109.9 }] },
      { type: "node", id: 8 },
    ],
  });
  assert.equal(filas.length, 2);
  assert.deepEqual(filas[0], {
    osm_id: "way/5",
    nombre: "Calle Jalisco",
    tipo: "residential",
    sentido_unico: false,
    ancho_m: 9,
    geom: { type: "LineString", coordinates: [[-109.9405, 27.485], [-109.9405, 27.488]] },
  });
  assert.equal(filas[1].nombre, "MEX 15");
  assert.equal(filas[1].sentido_unico, true);
});
