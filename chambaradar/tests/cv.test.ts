import assert from "node:assert/strict";
import { test } from "node:test";
import { CV_VACIO, limpiarCv, periodo, renglones, separarHabilidades, tituloArchivo } from "../lib/cv.ts";

test("limpiarCv acepta basura y siempre regresa un CV válido", () => {
  assert.deepEqual(limpiarCv(null).experiencia, []);
  assert.equal(limpiarCv({ idioma: "fr" }).idioma, "es");
  const cv = limpiarCv({
    nombre: "Ana\u0000 López".padEnd(500, "x"),
    experiencia: Array.from({ length: 40 }, () => ({ puesto: 5, logros: "a\nb" })),
    idiomas: [{ idioma: "Inglés", nivel: "experto" }],
  });
  assert.equal(cv.nombre.length, 80);
  assert.ok(!cv.nombre.includes("\u0000"));
  assert.equal(cv.experiencia.length, 12);
  assert.equal(cv.experiencia[0].puesto, "");
  assert.equal(cv.experiencia[0].logros, "a\nb");
  assert.equal(cv.idiomas[0].nivel, "intermedio");
  assert.deepEqual(limpiarCv(CV_VACIO), CV_VACIO);
});

test("renglones, habilidades y periodo", () => {
  assert.deepEqual(renglones("• Atendí clientes\n\n- Cobré en caja\n  * Inventario "), ["Atendí clientes", "Cobré en caja", "Inventario"]);
  assert.deepEqual(separarHabilidades("Excel, ventas; inglés\n"), ["Excel", "ventas", "inglés"]);
  assert.equal(periodo("2022", "", "es"), "2022 – Actual");
  assert.equal(periodo("2022", "", "en"), "2022 – Present");
  assert.equal(periodo("", "2020", "es"), "2020");
  assert.equal(periodo("", "", "es"), "");
  assert.equal(tituloArchivo({ ...CV_VACIO, nombre: " Ana López " }), "CV Ana López");
});
