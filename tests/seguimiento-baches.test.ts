import assert from "node:assert/strict";
import { test } from "node:test";
import { Seguimiento, mediana, type Observacion } from "../lib/baches/seguimiento.ts";

/** Vehículo hacia el norte a 11 m/s (40 km/h), 4 cuadros por segundo, baches en el piso */
function recorrer(baches: { n: number; e: number; area: number; conf: number }[], ruido = 0.4) {
  const s = new Seguimiento<string>();
  let semilla = 7;
  const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647 - 0.5) * 2;
  for (let t = 0; t <= 12; t += 0.25) {
    const y = 11 * t;
    const obs: Observacion<string>[] = [];
    for (const [i, b] of baches.entries()) {
      const adelante = b.n - y;
      if (adelante < 4 || adelante > 22) continue; // el cofre tapa lo cercano; lo lejano no se detecta
      const enZona = adelante <= 14;
      obs.push({
        t,
        pos: [b.e + azar() * ruido, b.n + azar() * ruido],
        distancia: adelante,
        confianza: b.conf,
        area_m2: enZona ? b.area * (1 + azar() * 0.05) : null,
        largo_m: enZona ? 0.6 : null,
        ancho_m: enZona ? 0.5 : null,
        foto: `bache${i}@${adelante.toFixed(1)}`,
      });
    }
    s.agregar(obs, t);
  }
  return s;
}

test("cada bache se confirma una sola vez, con su área", () => {
  const s = recorrer([
    { n: 40, e: 0.5, area: 0.35, conf: 0.8 },
    { n: 42, e: -2.5, area: 1.2, conf: 0.7 },
    { n: 90, e: 1, area: 0.12, conf: 0.6 },
  ]);
  const r = [...s.tomar(), ...s.terminar()].sort((a, b) => a.pos[1] - b.pos[1]);
  assert.equal(r.length, 3);
  for (const [b, real] of [
    [r[0], { n: 40, area: 0.35 }],
    [r[2], { n: 90, area: 0.12 }],
  ] as const) {
    assert.ok(Math.abs(b.pos[1] - real.n) < 0.6, `posición ${b.pos[1]}`);
    assert.ok(Math.abs(b.area_m2! / real.area - 1) < 0.05, `área ${b.area_m2}`);
    assert.ok(b.cuadros >= 5);
    assert.ok(b.medidas >= 3);
  }
  assert.ok(Math.abs(r[1].pos[0] + 2.5) < 0.6);
  assert.ok(r[0].foto?.startsWith("bache0@"));
});

test("una detección suelta (un solo cuadro o poca confianza) se descarta", () => {
  const s = new Seguimiento();
  s.agregar([{ t: 0, pos: [0, 10], distancia: 10, confianza: 0.9, area_m2: 0.3, largo_m: 0.5, ancho_m: 0.5 }], 0);
  s.agregar([], 0.3);
  s.agregar([{ t: 1, pos: [5, 30], distancia: 9, confianza: 0.3, area_m2: 0.3, largo_m: 0.5, ancho_m: 0.5 }], 1);
  s.agregar([{ t: 1.2, pos: [5, 30.2], distancia: 7, confianza: 0.35, area_m2: 0.3, largo_m: 0.5, ancho_m: 0.5 }], 1.2);
  assert.equal(s.tomar(5).length, 0);
  assert.equal(s.descartados, 2);
});

test("mediana", () => {
  assert.equal(mediana([3, 1, 2]), 2);
  assert.equal(mediana([4, 1, 2, 3]), 2.5);
});
