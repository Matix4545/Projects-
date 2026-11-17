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

test("interpola entre la lectura anterior y la siguiente (no adivina)", () => {
  const m = new Movimiento();
  // Hacia el este a 10 m/s, una lectura por segundo
  for (let t = 0; t <= 5; t++) m.lectura(27.48, -109.94 + (10 * t) / (111_320 * Math.cos((27.48 * Math.PI) / 180)), t, 10, 90, 4);
  assert.equal(m.cubre(4.3), true);
  assert.equal(m.cubre(5.2), false);
  const p = m.posicionEn(3.25)!;
  const este = (p.lng + 109.94) * 111_320 * Math.cos((27.48 * Math.PI) / 180);
  assert.ok(Math.abs(este - 32.5) < 0.01, `este ${este}`);
  assert.equal(p.interpolada, true);
  assert.ok(Math.abs(p.rumbo - 90) < 0.5);
  assert.equal(p.precision, 4);
  // Después de la última lectura se extrapola (y se marca)
  const q = m.posicionEn(5.5)!;
  assert.equal(q.interpolada, false);
  assert.ok(q.precision > 4);
});

test("da la vuelta: el rumbo es el del tramo entre lecturas", () => {
  const m = new Movimiento();
  const M = 111_132;
  // Norte 3 s y luego este
  const pts: [number, number][] = [[0, 0], [0, 10], [0, 20], [0, 30], [10, 30], [20, 30]];
  pts.forEach(([e, n], t) => m.lectura(27.48 + n / M, -109.94 + e / 98_750, t, null, null, 5));
  assert.ok(Math.abs(m.posicionEn(1.5)!.rumbo - 0) < 1);
  assert.ok(Math.abs(m.posicionEn(4.5)!.rumbo - 90) < 1.5);
});
