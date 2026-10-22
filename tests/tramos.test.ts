import assert from "node:assert/strict";
import { test } from "node:test";
import { distanciaM, largoM, limpiarTrazo, puntoMedio, trazoAWkt } from "../lib/tramos.ts";

test("distancias y largo de un tramo", () => {
  // ~111 m por milésima de grado de latitud
  assert.ok(Math.abs(distanciaM([27.49, -109.94], [27.491, -109.94]) - 111) < 1);
  const tramo: [number, number][] = [[27.49, -109.94], [27.491, -109.94], [27.491, -109.939]];
  assert.ok(Math.abs(largoM(tramo) - 210) < 3);
});

test("el punto medio cae sobre el recorrido, no en el promedio", () => {
  const [lat, lng] = puntoMedio([[27.49, -109.94], [27.492, -109.94], [27.492, -109.9399]]);
  assert.ok(lng === -109.94 && lat > 27.4909 && lat < 27.4911);
});

test("limpia puntos repetidos y arma WKT en orden lng lat", () => {
  const t = limpiarTrazo([[27.4900001, -109.94], [27.49, -109.94], [27.491, -109.94]]);
  assert.equal(t.length, 2);
  assert.equal(trazoAWkt(t), "SRID=4326;LINESTRING(-109.94 27.49,-109.94 27.491)");
});
