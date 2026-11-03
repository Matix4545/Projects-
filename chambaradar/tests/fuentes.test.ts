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

test("WordPress/Beetween: ubicación legible y JobPosting dentro de @graph", async () => {
  const { ubicacionWordpress, jobPostingDeHtml } = await import("../lib/fuentes/index.ts");
  assert.equal(ubicacionWordpress("MEXICO, Sonora, Obregón"), "Obregón, Sonora, México");
  assert.equal(ubicacionWordpress("USA, Arizona, Tempe"), "Tempe, Arizona, Estados Unidos");
  assert.equal(ubicacionWordpress("SOUTH KOREA"), "SOUTH KOREA");
  const html = `<script type="application/ld+json">{"@graph":[{"@type":"WebSite"},{"@type":"JobPosting","description":"&lt;p&gt;Hola&lt;/p&gt;","datePosted":"2026-10-26"}]}</script>`;
  assert.equal(jobPostingDeHtml(html)?.datePosted, "2026-10-26");
  assert.equal(jobPostingDeHtml("<p>nada</p>"), null);
});

test("SuccessFactors: total de resultados en inglés y en español", async () => {
  const { totalSuccessFactors } = await import("../lib/fuentes/index.ts");
  assert.equal(totalSuccessFactors("Results <b>1 – 25</b> of <b>1,204</b>"), 1204);
  assert.equal(totalSuccessFactors("Resultados <b>1 – 25</b> de <b>318</b>"), 318);
  assert.equal(totalSuccessFactors("<p>nada</p>"), 0);
});

test("Workday: el id es el número de vacante, o la ruta si el portal pone ahí la ciudad", async () => {
  const { idWorkday } = await import("../lib/fuentes/index.ts");
  assert.equal(idWorkday("R0123456", "/job/Mexico-City/Analyst_R0123456"), "R0123456");
  assert.equal(idWorkday("JR-2041", "/job/x_JR-2041"), "JR-2041");
  assert.equal(idWorkday("Mexico City", "/job/Mexico-City/Software-Engineer_JREQ190"), "/job/Mexico-City/Software-Engineer_JREQ190");
  assert.equal(idWorkday(undefined, "/job/a_1"), "/job/a_1");
});

test("Workday: facetas de todos los países de LATAM de habla hispana, sin Brasil", async () => {
  const { facetasLatam } = await import("../lib/fuentes/index.ts");
  const facetas = [
    { facetParameter: "locationMainGroup", values: [{ facetParameter: "Location_Country", values: [
      { descriptor: "Mexico", id: "mx", count: 40 }, { descriptor: "Colombia", id: "co", count: 12 }, { descriptor: "Brazil", id: "br", count: 30 },
      { descriptor: "Dominican Republic", id: "do", count: 3 }, { descriptor: "Venezuela, Bolivarian Republic of", id: "ve", count: 0 }, { descriptor: "Germany", id: "de", count: 9 },
    ] }] },
  ];
  assert.deepEqual(facetasLatam(facetas).map((f) => [f.pais, f.id, f.total]), [["México", "mx", 40], ["Colombia", "co", 12], ["República Dominicana", "do", 3], ["Venezuela", "ve", 0]]);
});
