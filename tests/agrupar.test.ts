import assert from "node:assert/strict";
import { test } from "node:test";
import { ZOOM_SIN_GRUPOS, agrupar, aPixeles, masComun } from "../lib/agrupar.ts";

const pin = (id: number, lat: number, lng: number) => ({ id, lat, lng });
// 30 reportes en la misma cuadra y 1 lejos
const cerca = Array.from({ length: 30 }, (_, i) => pin(i + 1, 27.4863 + i * 1e-5, -109.9405 + i * 1e-5));
const lejos = pin(99, 27.52, -109.9);

test("alejado: los cercanos forman un grupo y el lejano queda suelto", () => {
  const { sueltos, grupos } = agrupar([...cerca, lejos], 13);
  assert.equal(grupos.length, 1);
  assert.equal(grupos[0].miembros.length, 30);
  assert.deepEqual(sueltos.map((p) => p.id), [99]);
  // El centro del grupo queda entre sus miembros
  assert.ok(grupos[0].lat > 27.4863 && grupos[0].lat < 27.4867);
});

test("de cerca no se agrupa nada", () => {
  const { sueltos, grupos } = agrupar([...cerca, lejos], ZOOM_SIN_GRUPOS);
  assert.equal(grupos.length, 0);
  assert.equal(sueltos.length, 31);
});

test("nunca se pierde un reporte y el seleccionado siempre va suelto", () => {
  for (const z of [11, 12, 13, 14, 15]) {
    const { sueltos, grupos } = agrupar([...cerca, lejos], z, 5);
    assert.equal(sueltos.length + grupos.reduce((s, g) => s + g.miembros.length, 0), 31);
    assert.ok(sueltos.some((p) => p.id === 5));
  }
});

test("proyección: al subir un zoom las distancias en píxeles se duplican", () => {
  const [x1] = aPixeles(27.48, -109.94, 13);
  const [x2] = aPixeles(27.48, -109.94, 14);
  assert.ok(Math.abs(x2 - 2 * x1) < 1e-6);
});

test("tipo dominante", () => {
  assert.equal(masComun(["bache", "drenaje", "bache"], (x) => x), "bache");
});

test("el agua de una colonia cuenta todos sus reportes", () => {
  const colonia = { id: -7, lat: 27.4864, lng: -109.9404, peso: 5 };
  const { grupos, sueltos } = agrupar([colonia, lejos], 13);
  assert.equal(grupos.length, 1, "una colonia con 5 reportes de agua es una burbuja aunque esté sola");
  assert.equal(grupos[0].total, 5);
  assert.equal(sueltos.length, 1);
  const juntos = agrupar([...cerca, colonia], 13).grupos;
  assert.equal(juntos[0].total, 35);
  const lista: { id: number; peso?: number }[] = [colonia, cerca[0]];
  assert.equal(masComun(lista, (x) => (x.peso ? "agua" : "bache"), (x) => x.peso ?? 1), "agua");
});
