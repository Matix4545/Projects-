import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
// @ts-expect-error módulo JavaScript sin tipos
import { arreglarNombre, leerColonias } from "../scripts/leer-colonias.mjs";

test("arreglarNombre pone mayúsculas solo cuando el nombre viene todo en mayúsculas", () => {
  assert.equal(arreglarNombre("VILLA DE LOS ÁLAMOS"), "Villa de los Álamos");
  assert.equal(arreglarNombre("  LAS   MISIONES "), "Las Misiones");
  assert.equal(arreglarNombre("Col. Centro"), "Col. Centro");
  assert.equal(arreglarNombre("VALLE DE HEROES 1ra AMP"), "Valle de Heroes 1ra Amp");
  assert.equal(arreglarNombre("LOS ALAMOS II"), "Los Alamos II");
  assert.equal(arreglarNombre("MULTIFAMILIARES IMSS"), "Multifamiliares IMSS");
  assert.equal(arreglarNombre("?"), "");
});

test("leerColonias lee GeoJSON, descarta lo que está fuera de Cajeme y numera repetidas", async () => {
  const dir = mkdtempSync(join(tmpdir(), "colonias-"));
  const cuadro = (s: number, w: number, n: number, e: number) => [[[w, s], [e, s], [e, n], [w, n], [w, s]]];
  writeFileSync(
    join(dir, "c.geojson"),
    JSON.stringify({
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: { NOMBRE: "CENTRO" }, geometry: { type: "Polygon", coordinates: cuadro(27.48, -109.94, 27.49, -109.93) } },
        { type: "Feature", properties: { NOMBRE: "CENTRO" }, geometry: { type: "Polygon", coordinates: cuadro(27.49, -109.94, 27.5, -109.93) } },
        { type: "Feature", properties: { NOMBRE: "HERMOSILLO" }, geometry: { type: "Polygon", coordinates: cuadro(29.07, -110.96, 29.08, -110.95) } },
      ],
    }),
  );
  const zonas = await leerColonias("c.geojson", dir);
  assert.deepEqual(
    zonas.map((z: { properties: { osm_id: string } }) => z.properties.osm_id),
    ["archivo/centro", "archivo/centro-2"],
  );
  await assert.rejects(() => leerColonias("../fuera.geojson", dir), /dentro del proyecto/);
});
