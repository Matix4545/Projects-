import assert from "node:assert/strict";
import { test } from "node:test";
import { costoExtraPorKm, estimar, estimarIri } from "../lib/economia.ts";

test("IRI estimado: más rugosidad, más IRI; a más velocidad, la misma rugosidad pesa menos", () => {
  assert.ok(estimarIri(2, 40) > estimarIri(1, 40));
  assert.ok(estimarIri(1, 60) < estimarIri(1, 40));
  assert.equal(estimarIri(1, 40, "medio"), 3.5);
});

test("una calle buena no cuesta extra; una mala sí, y crece con el IRI", () => {
  assert.equal(costoExtraPorKm(1.8).total, 0);
  const c4 = costoExtraPorKm(4).total;
  const c6 = costoExtraPorKm(6).total;
  assert.ok(c4 > 0 && c6 > c4);
  assert.ok(costoExtraPorKm(30).reparaciones <= 0.9 * 1.5 + 1e-9, "las reparaciones tienen tope");
});

test("estimación total: rango ordenado y proporcional a los km por vehículo", () => {
  const e = estimar([
    { rms: 0.6, vel_kmh: 40, m: 5000 },
    { rms: 1.5, vel_kmh: 35, m: 3000 },
    { rms: 2.5, vel_kmh: 30, m: 2000 },
  ])!;
  assert.equal(Math.round(e.km), 10);
  const { bajo, medio, alto } = e.porEscenario;
  assert.ok(bajo.totalAnio < medio.totalAnio && medio.totalAnio < alto.totalAnio);
  assert.equal(Math.round(medio.porVehiculoAnio), Math.round(medio.porKm * 9000));
  assert.ok(Math.abs(e.kmPorClase.bueno + e.kmPorClase.aceptable + e.kmPorClase.noSatisfactorio - 10) < 1e-9);
  assert.equal(estimar([]), null);
});
