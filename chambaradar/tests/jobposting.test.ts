import { test } from "node:test";
import assert from "node:assert/strict";
import { jobPosting, jsonLd } from "../lib/jobposting.ts";
import type { Vacante } from "../lib/tipos.ts";

const v: Vacante = {
  id: "directa:5a6074dc-4d1e-422e-b1bc-a293f94eba73",
  empresa_slug: "directa-yoreme", empresa_nombre: "Yoreme", empresa_tipo: "local",
  titulo: "Guardia de Seguridad", url: "https://wa.me/52", ubicacion: "Cd. Obregón, Sonora",
  paises: ["MX"], modalidad: "presencial", acepta_latam: true, zonas: ["cajeme", "sonora"],
  categoria: "otros", nivel: "intermedio", idioma: "es", sueldo_min: 2500, sueldo_max: 3000, moneda: "MXN", periodo: "semana",
  descripcion: "Turno nocturno\n<b>Prestaciones</b>", publicada: "2026-11-03T03:17:58.000Z", vista: "2026-11-03T03:17:58.000Z",
};

test("JobPosting con lo que pide Google", () => {
  const d = jobPosting(v, "https://chambaradar.com/vacante/x") as Record<string, any>;
  for (const k of ["title", "description", "datePosted", "validThrough", "hiringOrganization", "jobLocation"]) assert.ok(d[k], k);
  assert.equal(d.jobLocation.address.addressLocality, "Cd. Obregón");
  assert.equal(d.jobLocation.address.addressRegion, "Sonora");
  assert.equal(d.jobLocation.address.addressCountry, "MX");
  assert.equal(d.baseSalary.value.unitText, "WEEK");
  assert.equal(d.baseSalary.value.minValue, 2500);
  assert.match(d.description, /Turno nocturno<br>&lt;b&gt;/);
  assert.ok(new Date(d.validThrough) > new Date(d.datePosted));
});

test("home office: TELECOMMUTE con requisito de país", () => {
  const d = jobPosting({ ...v, modalidad: "remoto", sueldo_min: null, sueldo_max: null }, "u") as Record<string, any>;
  assert.equal(d.jobLocationType, "TELECOMMUTE");
  assert.equal(d.applicantLocationRequirements.name, "México");
  assert.equal(d.jobLocation, undefined);
  assert.equal(d.baseSalary, undefined);
});

test("el JSON-LD no puede cerrar la etiqueta script", () => {
  assert.doesNotMatch(jsonLd({ a: "</script><script>alert(1)</script>" }), /<\/script>/);
});
