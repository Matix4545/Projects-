import assert from "node:assert/strict";
import { test } from "node:test";
import { folio, urgencia } from "../lib/urgencia.ts";

const DIA = 86_400_000;
const AHORA = Date.parse("2026-10-19T18:00:00Z");
const hace = (dias: number) => new Date(AHORA - dias * DIA - 1000).toISOString();

test("semáforo de días sin resolver", () => {
  const activo = (dias: number) => urgencia({ estado: "activo", creado_en: hace(dias), arreglado_en: null }, AHORA);
  assert.equal(activo(0).nivel, "reciente");
  assert.equal(activo(0).texto, "Reportado hoy");
  assert.equal(activo(7).nivel, "reciente");
  assert.equal(activo(8).nivel, "rezago");
  assert.equal(activo(30).nivel, "rezago");
  assert.equal(activo(31).nivel, "critico");
  assert.equal(activo(45).texto, "Lleva 45 días sin atención");
});

test("resuelto: cuánto tardó", () => {
  const u = urgencia({ estado: "arreglado", creado_en: hace(10), arreglado_en: hace(4) }, AHORA);
  assert.equal(u.nivel, "resuelto");
  assert.equal(u.texto, "Resuelto en 6 días");
  assert.equal(folio(42), "RC-00042");
});
