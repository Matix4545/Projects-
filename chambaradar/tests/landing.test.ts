import assert from "node:assert/strict";
import { test } from "node:test";
import { agruparRepetidas, aptaRemotoDolares, compararLanding, sueldoCreible, sueldoGrande } from "../lib/landing.ts";
import type { Vacante } from "../lib/tipos.ts";

const base: Vacante = {
  id: "x:1", empresa_slug: "wing", empresa_nombre: "Wing", empresa_tipo: "remoto", titulo: "Sales Development Representative", url: "https://e.com",
  ubicacion: "Mexico City", paises: ["MX"], modalidad: "remoto", acepta_latam: true, zonas: [], categoria: "ventas", nivel: "intermedio", idioma: "en",
  sueldo_min: 1200, sueldo_max: 2500, moneda: "USD", periodo: "mes", descripcion: "", publicada: "2026-11-01T00:00:00Z", vista: "2026-11-01T00:00:00Z",
};

test("sueldo creíble: fuera el '1 USD al mes' de relleno", () => {
  assert.equal(sueldoCreible(base), true);
  assert.equal(sueldoCreible({ ...base, sueldo_max: 1 }), false);
  assert.equal(sueldoCreible({ ...base, periodo: "hora", sueldo_max: 15 }), true);
  assert.equal(sueldoCreible({ ...base, periodo: "año", sueldo_max: 2000 }), false);
  assert.equal(sueldoCreible({ ...base, moneda: "MXN", periodo: "año", sueldo_max: 640000 }), true);
  assert.equal(sueldoCreible({ ...base, sueldo_max: null, sueldo_min: null }), false);
});

test("fuera traducciones de otros idiomas y puestos de campo", () => {
  assert.equal(aptaRemotoDolares("Translator, Portuguese (pt-PT)"), false);
  assert.equal(aptaRemotoDolares("Hebrew Language Transcription Expert"), false);
  assert.equal(aptaRemotoDolares("Translator, Spanish (es-ES)"), true);
  assert.equal(aptaRemotoDolares("Bilingual Customer Support (English/Spanish)"), true);
  assert.equal(aptaRemotoDolares("Field Engineer"), false);
  assert.equal(aptaRemotoDolares("Ingeniero de soporte en campo - Matamoros"), false);
  assert.equal(aptaRemotoDolares("Sales Development Representative"), true);
});

test("orden: con sueldo primero, luego áreas masivas y nivel de entrada", () => {
  const senior: Vacante = { ...base, id: "x:2", titulo: "Senior Engineer", categoria: "software", nivel: "senior", sueldo_max: 200000, periodo: "año" };
  const sinSueldo: Vacante = { ...base, id: "x:3", titulo: "Customer Support", categoria: "atencion-clientes", nivel: "junior", sueldo_min: null, sueldo_max: null, moneda: null, periodo: null, publicada: "2026-11-04T00:00:00Z" };
  const orden = [senior, sinSueldo, base].sort(compararLanding).map((v) => v.id);
  assert.deepEqual(orden, ["x:1", "x:2", "x:3"]);
});

test("mismo título + misma empresa en varias ciudades = una tarjeta con 'y N más'", () => {
  const tijuana = { ...base, id: "x:4", ubicacion: "Tijuana", paises: ["MX"] };
  const col = { ...base, id: "x:5", ubicacion: "Bogotá", paises: ["CO"] };
  const otra = { ...base, id: "x:6", titulo: "Cold Caller" };
  const r = agruparRepetidas([col, base, tijuana, otra]);
  assert.equal(r.length, 2);
  assert.equal(r[0].id, "x:1"); // la de México, aunque la primera de la lista era la de Colombia
  assert.equal(r[0].otras_ubicaciones, 2);
  assert.equal(r[1].otras_ubicaciones, 0);
});

test("sueldo grande: al mes, en pesos y por hora", () => {
  const g = sueldoGrande(base, 18.5)!;
  assert.equal(g.principal, "US$1,200 – 2,500 al mes");
  assert.equal(g.pesos, "≈ $22,200 – 46,300 MXN");
  assert.equal(g.porHora, null);
  const h = sueldoGrande({ ...base, periodo: "hora", sueldo_min: 15, sueldo_max: 18 }, 20)!;
  assert.equal(h.porHora, "US$15 – 18 la hora");
  assert.equal(h.principal, "US$2,600 – 3,110 al mes");
  assert.equal(sueldoGrande({ ...base, sueldo_max: 1 }, 18)?.principal, undefined);
  assert.equal(sueldoGrande({ ...base, moneda: "MXN", periodo: "año", sueldo_min: 640000, sueldo_max: 750000 }, 18)!.principal, "$53,300 – 62,500 MXN al mes");
});
