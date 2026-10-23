import assert from "node:assert/strict";
import { test } from "node:test";
import { MotorRugosidad, clasificar, resumir, type Tramo } from "../lib/rugosidad.ts";

const G = 9.80665;
const M_POR_GRADO = 111_195;

/**
 * Simula manejar hacia el norte a 36 km/h con GPS cada segundo y acelerómetro a 60 Hz.
 * tramos: lista de [metros, vibración m/s², golpe cada N m (0 = sin golpes)]; parada en metros (90 s detenido).
 */
function manejar(motor: MotorRugosidad, tramos: [number, number, number][], paradaEn?: number) {
  let t = 0;
  let y = 0;
  let parado = false;
  const alGolpear = new Set<number>();
  const segmento = (m: number) => {
    let acum = 0;
    for (const s of tramos) {
      acum += s[0];
      if (m < acum) return s;
    }
    return tramos[tramos.length - 1];
  };
  const total = tramos.reduce((s, x) => s + x[0], 0);
  while (y < total) {
    const [, vib, golpeCada] = segmento(y);
    for (let i = 0; i < 60; i++) {
      const ts = t + i / 60;
      let vert = vib * Math.sin(ts * 2 * Math.PI * 7) * Math.SQRT2; // RMS = vib
      if (golpeCada && Math.floor(y / golpeCada) !== Math.floor((y - 10) / golpeCada) && !alGolpear.has(Math.floor(y / golpeCada)) && i === 30) {
        alGolpear.add(Math.floor(y / golpeCada));
        vert = 1.2 * G;
      }
      motor.movimiento(0.3, 0.2, G + vert, ts);
    }
    t += 1;
    if (paradaEn !== undefined && !parado && y >= paradaEn) {
      parado = true;
      for (let s = 0; s < 90; s++, t++) motor.posicion(27.45 + y / M_POR_GRADO, -109.94, 5, 0, t);
    }
    y += 10;
    motor.posicion(27.45 + y / M_POR_GRADO, -109.94, 5, 10, t);
  }
}

test("calle lisa vs calle con baches", () => {
  const motor = new MotorRugosidad();
  manejar(motor, [[1500, 0.4, 0], [1000, 2.5, 50], [800, 0.4, 0]]);
  const tramos = motor.liberar(true);
  const enRango = (a: number, b: number) => tramos.filter((t) => t.inicio_m >= a && t.fin_m <= b);
  const lisos = enRango(0, 1450);
  const baches = enRango(1550, 2450);
  assert.ok(lisos.length > 5 && baches.length > 5);
  assert.ok(lisos.every((t) => clasificar(t.rms) === "buena"), "la calle lisa sale buena");
  assert.ok(baches.every((t) => clasificar(t.rms) === "mala"), "la calle con baches sale mala");
  assert.ok(baches.reduce((s, t) => s + t.golpes.length, 0) >= 10, "detecta golpes");
  assert.equal(resumir(tramos).km > 2, true);
});

test("privacidad: nada a menos de 300 m del inicio, del final ni de una parada", () => {
  const motor = new MotorRugosidad();
  manejar(motor, [[4000, 0.5, 0]], 2000);
  const tramos: Tramo[] = [...motor.liberar(false), ...motor.liberar(true)];
  const total = motor.estado().distancia_m;
  assert.ok(tramos.length > 10);
  for (const t of tramos) {
    assert.ok(t.inicio_m >= 300, "inicio recortado");
    assert.ok(t.fin_m <= total - 300, "final recortado");
    assert.ok(t.fin_m <= 1700 || t.inicio_m >= 2300, `tramo ${t.inicio_m}-${t.fin_m} demasiado cerca de la parada`);
  }
});

test("envíos parciales: solo salen tramos ya alejados 300 m", () => {
  const motor = new MotorRugosidad();
  manejar(motor, [[2000, 0.5, 0]]);
  const ahora = motor.estado().distancia_m;
  const parcial = motor.liberar(false);
  assert.ok(parcial.length > 0 && parcial.every((t) => t.fin_m + 300 <= ahora));
  const resto = motor.liberar(true);
  assert.ok(resto.every((t) => !parcial.includes(t)), "no se repiten tramos");
});

test("si se corta el GPS (otra app), se trata como parada", () => {
  const motor = new MotorRugosidad();
  manejar(motor, [[1500, 0.5, 0]]);
  const d = motor.estado().distancia_m;
  // 5 minutos sin GPS y reaparece 3 km más adelante
  motor.posicion(27.45 + (d + 3000) / M_POR_GRADO, -109.94, 5, 10, 10_000);
  assert.equal(motor.estado().distancia_m, d, "el salto no suma distancia");
  const tramos = motor.liberar(true);
  assert.ok(tramos.every((t) => t.fin_m <= d - 300));
});
