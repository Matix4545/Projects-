import { test } from "node:test";
import assert from "node:assert/strict";
import { revolver, taparEmpresa, vistaDeVacante } from "../lib/muro.ts";
import type { Vacante } from "../lib/tipos.ts";

const v: Vacante = {
  id: "stripe:12345",
  empresa_slug: "stripe",
  empresa_nombre: "Stripe",
  empresa_tipo: "remoto",
  titulo: "Account Executive - Stripe Mexico",
  url: "https://stripe.com/jobs/12345",
  ubicacion: "Mexico City",
  paises: ["MX"],
  modalidad: "hibrido",
  acepta_latam: true,
  zonas: [],
  categoria: "ventas",
  nivel: "intermedio",
  idioma: "en",
  sueldo_min: 1000,
  sueldo_max: 2000,
  moneda: "USD",
  periodo: "mes",
  descripcion: "Stripe is a financial infrastructure platform for businesses.",
  publicada: "2026-10-01T00:00:00.000Z",
  vista: "2026-10-02T00:00:00.000Z",
};

test("sin acceso: nada en la vacante revela la empresa ni el enlace", () => {
  const vista = vistaDeVacante(v, false);
  assert.equal(vista.bloqueada, true);
  assert.equal(vista.url, null);
  assert.equal(vista.empresa_slug, null);
  assert.doesNotMatch(JSON.stringify(vista), /stripe/i);
  // Lo gratuito sigue visible
  assert.equal(vista.sueldo_max, 2000);
  assert.equal(vista.titulo, "Account Executive - ••• Mexico");
  // En lugar del nombre: una etiqueta legible, nunca texto revuelto
  assert.equal(vista.empresa_nombre, "Empresa extranjera");
  assert.equal(vistaDeVacante({ ...v, empresa_tipo: "local" }, false).empresa_nombre, "Empresa oculta");
});

test("con acceso: se ve todo", () => {
  const vista = vistaDeVacante(v, true);
  assert.equal(vista.url, v.url);
  assert.equal(vista.empresa_nombre, "Stripe");
  assert.equal(vista.id, v.id);
});

test("las vacantes que publican los negocios nunca se bloquean", () => {
  const directa = vistaDeVacante({ ...v, id: "directa:123" }, false);
  assert.equal(directa.bloqueada, false);
  assert.equal(directa.url, v.url);
});

test("el texto revuelto es estable y conserva espacios", () => {
  assert.equal(revolver("Hola mundo", "x"), revolver("Hola mundo", "x"));
  assert.equal(revolver("Hola mundo", "x").length, 10);
  assert.equal(revolver("Hola mundo", "x")[4], " ");
});

test("solo tapa palabras completas", () => {
  const clara = { empresa_nombre: "Clara", empresa_slug: "clara" };
  assert.equal(taparEmpresa("Ejecutivo Clara Cobranza", clara), "Ejecutivo ••• Cobranza");
  assert.equal(taparEmpresa("Analista de declaración fiscal", clara), "Analista de declaración fiscal");
  assert.equal(taparEmpresa("Gympass Brasil", { empresa_nombre: "Wellhub (Gympass)", empresa_slug: "wellhub" }), "••• Brasil");
});
