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

test("contorno de Sonora", async () => {
  const { dentroDeSonora } = await import("../lib/geo.ts");
  const dentro = { Obregón: [27.486, -109.94], Hermosillo: [29.07, -110.96], Navojoa: [27.07, -109.44], Nogales: [31.31, -110.94], "San Luis R.C.": [32.46, -114.77], Guaymas: [27.92, -110.9], Peñasco: [31.31, -113.53] };
  const fuera = { "Los Mochis": [25.79, -108.99], Mexicali: [32.62, -115.45], "San Felipe": [31.02, -114.84], Chihuahua: [28.63, -106.07], Tucson: [32.22, -110.97], CDMX: [19.43, -99.13] };
  for (const [c, [la, lo]] of Object.entries(dentro)) assert.equal(dentroDeSonora(la, lo), true, c);
  for (const [c, [la, lo]] of Object.entries(fuera)) assert.equal(dentroDeSonora(la, lo), false, c);
  assert.equal(dentroDeSonora(NaN, 0), false);
});
