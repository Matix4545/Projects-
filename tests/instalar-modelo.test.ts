import assert from "node:assert/strict";
import { test } from "node:test";
// @ts-expect-error: script de Node sin tipos
import { leerNombres, leerOnnx } from "../scripts/instalar-modelo.mjs";

// Codificador protobuf mínimo para armar un ONNX de juguete
const varint = (n: number) => {
  const b: number[] = [];
  do {
    let x = n & 0x7f;
    n >>>= 7;
    if (n) x |= 0x80;
    b.push(x);
  } while (n);
  return b;
};
const num = (campo: number, v: number) => [...varint(campo << 3), ...varint(v)];
const msj = (campo: number, contenido: number[] | string) => {
  const bytes = typeof contenido === "string" ? [...Buffer.from(contenido)] : contenido;
  return [...varint((campo << 3) | 2), ...varint(bytes.length), ...bytes];
};
const valor = (nombre: string, dims: number[]) =>
  [...msj(1, nombre), ...msj(2, msj(1, [...num(1, 1), ...msj(2, dims.flatMap((d) => msj(1, num(1, d))))]))];

test("lee clases, tarea y forma de un ONNX de Ultralytics", () => {
  const modelo = Buffer.from([
    ...num(1, 8), // ir_version
    ...msj(7, [...msj(1, [9, 9, 9]) /* un nodo cualquiera */, ...msj(11, valor("images", [1, 3, 384, 640])), ...msj(12, valor("output0", [1, 39, 5040])), ...msj(12, valor("output1", [1, 32, 96, 160]))]),
    ...msj(14, [...msj(1, "task"), ...msj(2, "segment")]),
    ...msj(14, [...msj(1, "names"), ...msj(2, "{0: 'pothole', 1: 'manhole', 2: 'grate'}")]),
  ]);
  const r = leerOnnx(modelo);
  assert.deepEqual(r.entradas, [{ nombre: "images", dims: [1, 3, 384, 640] }]);
  assert.equal(r.salidas.length, 2);
  assert.deepEqual(r.salidas[1].dims, [1, 32, 96, 160]);
  assert.equal(r.meta.task, "segment");
  assert.deepEqual(leerNombres(r.meta.names), ["pothole", "manhole", "grate"]);
});

test("nombres con comillas dobles y desordenados", () => {
  assert.deepEqual(leerNombres(`{1: "rejilla", 0: "bache d'agua"}`), ["bache d'agua", "rejilla"]);
  assert.deepEqual(leerNombres(undefined), []);
});
