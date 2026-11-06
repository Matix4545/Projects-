import assert from "node:assert/strict";
import { test } from "node:test";
import { busquedasSitemap, indexable, rutaCanonica, tituloDeFiltros, type FiltrosSeo } from "../lib/seo.ts";

const base: FiltrosSeo = { q: "", categoria: "", pais: "", modalidad: "", zona: "", alcance: "todo", pagina: 1 };

test("títulos por área y lugar", () => {
  assert.equal(tituloDeFiltros(base), "Vacantes en todo México y LATAM");
  assert.equal(tituloDeFiltros({ ...base, categoria: "ventas", modalidad: "remoto" }), "Ventas · home office");
  assert.equal(tituloDeFiltros({ ...base, zona: "sonora" }), "Vacantes en Sonora");
  assert.equal(tituloDeFiltros({ ...base, modalidad: "remoto" }), "Home office / remoto");
});

test("canónica solo con área, lugar y página", () => {
  assert.equal(rutaCanonica(base), "/vacantes");
  assert.equal(rutaCanonica({ ...base, categoria: "ventas", modalidad: "remoto", pagina: 2 }), "/vacantes?categoria=ventas&donde=remoto&pagina=2");
  assert.equal(rutaCanonica({ ...base, pais: "MX" }), "/vacantes?donde=mx");
  assert.equal(rutaCanonica({ ...base, pais: "CO" }), "/vacantes?pais=CO");
});

test("no se indexan búsquedas por texto ni filtros finos", () => {
  assert.equal(indexable(base, { categoria: "ventas", donde: "remoto" }), true);
  assert.equal(indexable({ ...base, q: "excel" }, { q: "excel" }), false);
  assert.equal(indexable(base, { categoria: "ventas", sueldo: "1" }), false);
});

test("sitemap: cada área en todo, home office y México, más un estado por página, sin repetidos", () => {
  const r = busquedasSitemap();
  assert.equal(new Set(r).size, r.length);
  assert.ok(r.includes("/vacantes?categoria=ventas&donde=remoto"));
  assert.ok(r.includes("/vacantes?donde=sonora"));
  assert.ok(r.includes("/vacantes?donde=nuevo-leon"));
  assert.ok(!r.some((x) => x.includes("otros")));
  assert.equal(r.length, 2 + 18 * 3 + 32);
});
