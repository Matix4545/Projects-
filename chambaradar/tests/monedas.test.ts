import { test } from "node:test";
import assert from "node:assert/strict";
import { formatoMoneda, MONEDA_PAIS } from "../lib/monedas.ts";

test("formato de moneda local, redondeado hacia arriba", () => {
  assert.equal(formatoMoneda(9.08, "PEN"), "S/ 10");
  assert.equal(formatoMoneda(20.2, "GTQ"), "Q21");
  assert.equal(formatoMoneda(2.61, "USD"), "US$2.61");
  assert.equal(formatoMoneda(70.9, "HNL"), "L71");
});

test("moneda más usada por país", () => {
  assert.equal(MONEDA_PAIS.PE, "PEN");
  assert.equal(MONEDA_PAIS.SV, "USD");
  assert.equal(MONEDA_PAIS.GT, "GTQ");
  assert.equal(MONEDA_PAIS.HN, "HNL");
});

test("ahorro del plan de 1 mes frente a 4 semanas", async () => {
  const { ahorroMes } = await import("../lib/planes.ts");
  assert.deepEqual(ahorroMes(), { pesos: 67, porcentaje: 34 });
});
