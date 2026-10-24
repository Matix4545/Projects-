import assert from "node:assert/strict";
import { test } from "node:test";
import { MotorRugosidad, clasificar, resumir, type Tramo } from "../lib/rugosidad.ts";

const G = 9.80665;
const M_POR_GRADO = 111_195;

/**
 * Simula manejar hacia el norte a 36 km/h con GPS cada segundo y acelerómetro a 60 Hz.
 * tramos: lista de [metros, vibración m/s², golpe cada N m (0 = sin golpes)]; parada en metros (90 s detenido).
 */
function manejar(motor: MotorRugosidad, tramos: [number, number, number][], paradaEn?: number, paradaS = 180) {
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
      for (let s = 0; s < paradaS; s++, t++) motor.posicion(27.45 + y / M_POR_GRADO, -109.94, 5, 0, t);
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

test("privacidad: nada a menos de 150 m del inicio, del final ni de una entrega", () => {
  for (let i = 0; i < 20; i++) {
    const motor = new MotorRugosidad();
    manejar(motor, [[4000, 0.5, 0]], 2000);
    const tramos: Tramo[] = [...motor.liberar(false), ...motor.liberar(true)];
    const total = motor.estado().distancia_m;
    assert.ok(tramos.length > 10);
    for (const t of tramos) {
      assert.ok(t.inicio_m >= 150, "inicio recortado");
      assert.ok(t.fin_m <= total - 150, "final recortado");
      assert.ok(t.fin_m <= 1860 || t.inicio_m >= 2150, `tramo ${t.inicio_m}-${t.fin_m} demasiado cerca de la parada`);
    }
  }
});

test("el recorte es al azar y distinto de cada lado (el hueco no delata la parada)", () => {
  // Con azar fijo: 0 → 150 m antes de la parada, 1 → 250 m después
  const valores = [0.5, 0.5, 0, 1];
  const motor = new MotorRugosidad(() => valores.shift() ?? 0.5);
  manejar(motor, [[3000, 0.5, 0]], 1500);
  const tramos = [...motor.liberar(false), ...motor.liberar(true)];
  const antes = Math.max(...tramos.filter((t) => t.fin_m <= 1500).map((t) => t.fin_m));
  const despues = Math.min(...tramos.filter((t) => t.inicio_m >= 1500).map((t) => t.inicio_m));
  assert.ok(1500 - antes >= 150 && 1500 - antes < 260, `antes: ${1500 - antes} m`);
  assert.ok(despues - 1500 >= 250 && despues - 1500 < 360, `después: ${despues - 1500} m`);
});

test("un semáforo (90 s) no recorta nada", () => {
  const conAlto = new MotorRugosidad(() => 0.5);
  manejar(conAlto, [[3000, 0.5, 0]], 1500, 90);
  const sinAlto = new MotorRugosidad(() => 0.5);
  manejar(sinAlto, [[3000, 0.5, 0]]);
  const km = (m: MotorRugosidad) => [...m.liberar(false), ...m.liberar(true)].reduce((s, t) => s + t.largo_m, 0);
  // Se mide solo en movimiento: el tramo del semáforo se conserva
  assert.ok(km(sinAlto) - km(conAlto) <= 20, `el semáforo no quita tramos (${km(sinAlto)} vs ${km(conAlto)})`);
});

test("envíos parciales: solo salen tramos ya alejados 250 m", () => {
  const motor = new MotorRugosidad();
  manejar(motor, [[2000, 0.5, 0]]);
  const ahora = motor.estado().distancia_m;
  const parcial = motor.liberar(false);
  assert.ok(parcial.length > 0 && parcial.every((t) => t.fin_m + 250 <= ahora));
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
  assert.ok(tramos.every((t) => t.fin_m <= d - 150));
});

test("GPS débil un rato sin detenerse (puente, vía del tren): no se recorta como parada", () => {
  const motor = new MotorRugosidad(() => 0.5);
  manejar(motor, [[1500, 0.5, 0]]);
  const d = motor.estado().distancia_m;
  // 70 s de lecturas imprecisas mientras sigue a 36 km/h, y la señal vuelve 700 m adelante
  for (let s = 1; s <= 70; s++) motor.posicion(27.45 + (d + s * 10) / M_POR_GRADO, -109.94, 60, 10, 151 + s);
  for (let s = 71; s < 220; s++) {
    for (let i = 0; i < 60; i++) motor.movimiento(0.3, 0.2, G + 0.5 * Math.SQRT2 * Math.sin((s + i / 60) * 44), s + 151 + i / 60);
    motor.posicion(27.45 + (d + s * 10) / M_POR_GRADO, -109.94, 5, 10, 151 + s);
  }
  const e = motor.estado();
  assert.equal(e.descartes.cortes, 0, "no cuenta como corte");
  assert.ok(e.descartes.gps_debil_s >= 60, "registra el tiempo con GPS débil");
  const tramos = [...motor.liberar(false), ...motor.liberar(true)];
  assert.ok(tramos.some((t) => t.inicio_m < d && t.fin_m > d - 150), "conserva lo medido justo antes de perder señal");
});

test("explica lo que no se midió", () => {
  const motor = new MotorRugosidad(() => 0.5);
  manejar(motor, [[3000, 0.5, 0]], 1500);
  motor.liberar(false);
  motor.liberar(true);
  const e = motor.estado().descartes;
  // inicio + final + 2 lados de la parada, ~200 m cada uno
  assert.ok(e.privacidad_m >= 600 && e.privacidad_m <= 1100, `privacidad: ${e.privacidad_m}`);
});

test("tocar el mapa encuentra las mediciones de esa cuadra", async () => {
  const { medicionesCerca } = await import("../lib/rugosidad.ts");
  const linea = (lat: number, rms: number, vel: number) => ({
    type: "Feature" as const,
    properties: { tipo: "tramo", rms, vel_kmh: vel, vehiculo: "auto", fecha: "2026-10-24", n_golpes: 1 },
    geometry: { type: "LineString" as const, coordinates: [[-109.94, lat], [-109.94, lat + 0.0009]] },
  });
  const fc = { type: "FeatureCollection" as const, features: [linea(27.48, 1.4, 35), linea(27.48001, 1.2, 32), linea(27.50, 2.5, 40)] };
  // A ~10 m al este de la calle: las dos pasadas, no la otra calle
  const m = medicionesCerca(27.4804, -109.9399, fc);
  assert.equal(m.length, 2);
  assert.deepEqual(m.map((x) => x.rms).sort(), [1.2, 1.4]);
  assert.ok(m[0].largo_m > 90 && m[0].largo_m < 110);
  assert.equal(medicionesCerca(27.49, -109.94, fc).length, 0);
  // Con radio grande no se cuelan los tramos vecinos de la misma calle
  const vecinos = { ...fc, features: [...fc.features, linea(27.4809, 1.9, 40)] };
  assert.equal(medicionesCerca(27.4804, -109.9399, vecinos, 80).length, 2);
});

test("datos para calibrar: parte lenta, percentil 95 y variación de velocidad", () => {
  const motor = new MotorRugosidad();
  manejar(motor, [[1500, 0.4, 0], [1000, 2.5, 50], [800, 0.4, 0]]);
  const tramos = motor.liberar(true);
  for (const t of tramos) {
    assert.ok(t.rms_baja >= 0 && t.rms_baja < t.rms, "la vibración de 7 Hz casi no pasa por el filtro de 4 Hz");
    assert.ok(t.p95 > 0 && t.p95 <= 20);
    assert.ok(t.vel_sd < 1, "velocidad constante en la simulación");
  }
  const lisos = tramos.filter((t) => t.fin_m <= 1450);
  const baches = tramos.filter((t) => t.inicio_m >= 1550 && t.fin_m <= 2450);
  assert.ok(Math.min(...baches.map((t) => t.p95)) > Math.max(...lisos.map((t) => t.p95)));
});

test("el golpe se ubica entre lecturas del GPS, no en la última lectura", () => {
  const motor = new MotorRugosidad(() => 0); // recortes fijos de 150 m
  let t = 0;
  for (let y = 0; y <= 1000; y += 10, t++) {
    for (let i = 0; i < 60; i++) motor.movimiento(0, 0, G + (y === 300 && i === 45 ? 1.2 * G : 0.3), t + i / 60);
    motor.posicion(27.45 + y / M_POR_GRADO, -109.94, 5, 10, t + 1);
  }
  const golpes = motor.liberar(true).flatMap((x) => x.golpes);
  // Última lectura antes del golpe: 290 m; el golpe ocurre 0.75 s después a 10 m/s → ~297 m
  const metros = golpes.map(([lat]) => (lat - 27.45) * M_POR_GRADO);
  assert.ok(metros.some((m) => m > 295 && m < 300), `golpe en ${metros.join(", ")}`);
});
