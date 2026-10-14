import assert from "node:assert/strict";
import { test } from "node:test";
import { revisarComentario, tieneDatosPersonales, tieneGroserias } from "../lib/groserias.ts";

test("detecta groserías comunes y sus variantes", () => {
  for (const t of ["Pinche servicio", "PENDEJOS", "p3nd3j0s", "puuuuto el que lo lea", "qué chingados", "p u t o", "vrg"]) {
    assert.equal(tieneGroserias(t), true, t);
  }
});

test("no bloquea texto normal de vecinos", () => {
  for (const t of [
    "Sale café desde ayer en la calle Álvaro Obregón",
    "Las mamás de la escuela se quejan",
    "Hay un perro y una perra callejeros",
    "Cerca del Fracc. Valle Dorado, esquina con Calle 300",
    "Computadora tirada junto al bache",
    "Agua putrefacta en la alcantarilla",
  ]) {
    assert.equal(tieneGroserias(t), false, t);
  }
});

test("bloquea teléfonos, correos y enlaces", () => {
  assert.equal(tieneDatosPersonales("llamen al 644 123 4567"), true);
  assert.equal(tieneDatosPersonales("escriban a vecino@correo.com"), true);
  assert.equal(tieneDatosPersonales("miren www.ejemplo.com"), true);
  assert.equal(tieneDatosPersonales("Calle 200 número 1520"), false);
});

test("revisarComentario devuelve mensaje o null", () => {
  assert.equal(revisarComentario(null), null);
  assert.equal(revisarComentario("Ya regresó el agua"), null);
  assert.match(revisarComentario("pinche bache") ?? "", /no permitidas/);
});
