import { test } from "node:test";
import assert from "node:assert/strict";
import { brutoParaNeto, imssObreroMensual, isrMensual, sueldoMensualMxn, sueldoNeto } from "../lib/nomina.ts";

const cerca = (a: number, b: number, tol = 1) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);

test("ISR mensual 2026 (art. 96): ejemplos de la tarifa", () => {
  cerca(isrMensual(10000), 729.02, 0.05); // 420.95 + (10000 − 7168.52) × 10.88 %
  cerca(isrMensual(15000), 1402.81, 0.05); // 1339.14 + (15000 − 14644.65) × 17.92 %
  assert.equal(isrMensual(0), 0);
});

test("subsidio al empleo solo hasta $11,492.66 y nunca mayor que el ISR", () => {
  const bajo = sueldoNeto(8000);
  assert.ok(bajo.subsidio > 0 && bajo.subsidio <= 535.65);
  assert.equal(sueldoNeto(12000).subsidio, 0);
  const minimo = sueldoNeto(5000);
  assert.equal(minimo.isr, 0); // el subsidio cubre todo el ISR
});

test("IMSS obrero ≈ 2.4–2.8 % del bruto y se topa en 25 UMA", () => {
  const i = imssObreroMensual(18000);
  assert.ok(i > 18000 * 0.023 && i < 18000 * 0.03, String(i));
  assert.equal(Math.round(imssObreroMensual(200000)), Math.round(imssObreroMensual(300000)));
});

test("neto de $18,000 brutos queda entre $15,000 y $15,700", () => {
  const n = sueldoNeto(18000);
  assert.ok(n.neto > 15000 && n.neto < 15700, String(n.neto));
  cerca(sueldoNeto(brutoParaNeto(15000)).neto, 15000, 2);
});

test("sueldo mensual en pesos para comparar vacantes", () => {
  cerca(sueldoMensualMxn({ sueldo_min: 35, sueldo_max: 35, moneda: "USD", periodo: "hora" }, 18.5)!, 35 * 173 * 18.5, 1);
  cerca(sueldoMensualMxn({ sueldo_min: 120000, sueldo_max: 150000, moneda: "USD", periodo: "año" }, 18.5)!, (150000 / 12) * 18.5, 1);
  assert.equal(sueldoMensualMxn({ sueldo_min: null, sueldo_max: null, moneda: null, periodo: null }, 18.5), null);
});
