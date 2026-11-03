import assert from "node:assert/strict";
import { test } from "node:test";
import { esDeSonora, leerGeo } from "../lib/geo.ts";

const geo = { city: "Ciudad Obregón", country: { code: "MX" }, subdivision: { code: "SON", name: "Sonora" } };

test("lee el encabezado de Netlify en base64 o JSON", () => {
  assert.deepEqual(leerGeo(Buffer.from(JSON.stringify(geo)).toString("base64")), geo);
  assert.deepEqual(leerGeo(JSON.stringify(geo)), geo);
  assert.equal(leerGeo("basura"), null);
  assert.equal(leerGeo(null), null);
});

test("solo Sonora, México", () => {
  assert.equal(esDeSonora(geo), true);
  assert.equal(esDeSonora({ ...geo, subdivision: { code: "SIN", name: "Sinaloa" } }), false);
  assert.equal(esDeSonora({ ...geo, country: { code: "US" } }), false);
  assert.equal(esDeSonora(null), false);
});
