import { test } from "node:test";
import assert from "node:assert/strict";
import { descripcionSuccessFactors, facetaMexico, fechaWorkday, filasSuccessFactors } from "../lib/fuentes/index.ts";

test("SuccessFactors: filas de la tabla de resultados", () => {
  const html = `<tr class="data-row"><td><span class="jobTitle hidden-phone"><a href="/job/Ciudad-Obregon-Cajeme-Tecnico-SON/993402555/" class="jobTitle-link">Tecnico</a></span>
  <span class="jobLocation"> Ciudad Obregon Cajeme, SON, MX </span><span class="jobDate">Oct 7, 2026 </span></td>
  <td><span class="jobDepartment">Manufactura</span></td><td><span class="jobLocation"> Ciudad Obregon Cajeme, SON, MX </span></td></tr>`;
  assert.deepEqual(filasSuccessFactors(html), [
    { titulo: "Tecnico", ruta: "/job/Ciudad-Obregon-Cajeme-Tecnico-SON/993402555/", ubicacion: "Ciudad Obregon Cajeme, SON, MX", fecha: "Oct 7, 2026", area: "Manufactura" },
  ]);
});

test("SuccessFactors: descripción con spans y divs anidados", () => {
  const html = `<span itemprop="description" class="jobdescription"><p><span><span>Hola</span></span></p><div>Prepa</div></span><p class="job-location">x</p>`;
  assert.equal(descripcionSuccessFactors(html), "<p><span><span>Hola</span></span></p><div>Prepa</div>");
  assert.equal(descripcionSuccessFactors("<p>nada</p>"), "");
});

test("Workday: encuentra la faceta de México y entiende las fechas", () => {
  const facetas = [{ facetParameter: "locationMainGroup", values: [{ facetParameter: "Location_Country", values: [{ descriptor: "Brazil", id: "b" }, { descriptor: "Mexico", id: "m1" }] }] }];
  assert.deepEqual(facetaMexico(facetas), { parametro: "Location_Country", id: "m1" });
  assert.equal(facetaMexico([{ facetParameter: "jobFamily", values: [{ descriptor: "Mexico", id: "x" }] }]), null);
  const hoy = new Date("2026-11-02T12:00:00Z");
  assert.equal(fechaWorkday("Posted 3 Days Ago", hoy), "2026-10-30T12:00:00.000Z");
  assert.equal(fechaWorkday("Posted Today", hoy), hoy.toISOString());
  assert.equal(fechaWorkday("Posted 30+ Days Ago", hoy), "2026-10-03T12:00:00.000Z");
});
