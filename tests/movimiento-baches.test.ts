import assert from "node:assert/strict";
import { test } from "node:test";
import { Movimiento } from "../lib/baches/movimiento.ts";

const M_LAT = 111_132;

test("sin velocidad del GPS: lecturas muy juntas y con ruido no disparan la velocidad", () => {
  const m = new Movimiento();
  let semilla = 3;
  const ruido = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647 - 0.5) * 4; // ±2 m
  // Hacia el norte a 8.33 m/s, lecturas cada 0.2 s
  for (let t = 0; t <= 10; t += 0.2) m.lectura(27.48 + (8.33 * t + ruido()) / M_LAT, -109.94, t);
  assert.ok(Math.abs(m.vel - 8.33) < 1.5, `vel ${m.vel}`);
  assert.ok(Math.abs(((m.rumbo! + 180) % 360) - 180) < 10, `rumbo ${m.rumbo}`);
  // La posición extrapolada no se va lejos
  const p = m.posicionEn(10.6)!;
  const adelante = (p.lat - 27.48) * M_LAT - 8.33 * 10;
  assert.ok(adelante > 0 && adelante < 9, `adelante ${adelante}`);
});

test("usa la velocidad y el rumbo del GPS cuando los da; ignora lecturas desordenadas", () => {
  const m = new Movimiento();
  m.lectura(27.48, -109.94, 0, 10, 90);
  m.lectura(27.48, -109.9399, 1, 10, 90);
  m.lectura(27.48, -109.95, 0.5); // vieja, llegó tarde
  assert.equal(m.vel, 10);
  assert.equal(m.rumbo, 90);
  assert.equal(m.posicionEn(1)!.lng, -109.9399);
  assert.equal(m.posicionEn(7), null);
});

test("detenido: sin rumbo no se ubica nada", () => {
  const m = new Movimiento();
  m.lectura(27.48, -109.94, 0, 0, null);
  m.lectura(27.48, -109.94, 1, 0, null);
  assert.equal(m.posicionEn(1), null);
});
