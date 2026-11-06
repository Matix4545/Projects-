import assert from "node:assert/strict";
import { test } from "node:test";
import { correoDeBoletin, type VacanteBoletin } from "../lib/boletin.ts";

const v: VacanteBoletin = {
  id: "wing:1", empresa_slug: "wing", empresa_nombre: "Wing <Assistant>", empresa_tipo: "remoto", titulo: "Sales Development Representative", url: "https://jobs.lever.co/wing/1",
  ubicacion: "Mexico City", paises: ["MX"], modalidad: "remoto", acepta_latam: true, zonas: [], categoria: "ventas", nivel: "intermedio", idioma: "en",
  sueldo_min: 1200, sueldo_max: 2500, moneda: "USD", periodo: "mes", publicada: "2026-11-01T00:00:00Z",
};
const s = { id: 7, correo: "ana@correo.com", token: "33333333-3333-3333-3333-333333333333" };
const o = { sitio: "https://chambaradar.com", responsable: "Spencer", tasaUsd: 18.5, precioSemana: "$49", totalRemotas: 800 };

test("boletín: empresa y enlace completos, sueldo en dólares y pesos, baja con token", () => {
  const c = correoDeBoletin(s, [v], o);
  assert.equal(c.para, "ana@correo.com");
  assert.match(c.asunto, /1 vacantes remotas en dólares/);
  assert.match(c.html, /Wing &lt;Assistant&gt;/);
  assert.match(c.html, /https:\/\/jobs\.lever\.co\/wing\/1/);
  assert.match(c.html, /US\$1,200 – 2,500 al mes/);
  assert.match(c.html, /≈ \$22,200 – 46,300 MXN/);
  assert.match(c.html, /800 vacantes remotas/);
  assert.match(c.html, /boletin\/baja\?t=33333333/);
  assert.equal(c.bajaUnClic, "https://chambaradar.com/api/boletin/baja?t=33333333-3333-3333-3333-333333333333");
  assert.match(c.texto, /Wing <Assistant>/);
  assert.match(c.texto, /remoto-dolares\?utm_source=boletin/);
});

test("boletín sin vacantes: asunto distinto y sin filas", () => {
  const c = correoDeBoletin(s, [], o);
  assert.match(c.asunto, /no hubo vacantes nuevas/);
  assert.doesNotMatch(c.html, /Aplicar en la página/);
});
