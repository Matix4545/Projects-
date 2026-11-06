import { test } from "node:test";
import assert from "node:assert/strict";
import { extraerSueldo, extraerTelefono, leerPublicacion } from "../lib/captura.ts";

test("lee una publicación típica de grupo de empleo", () => {
  const texto = `🔴 SE SOLICITA: AYUDANTE DE COCINA 🔴
Restaurante: Mariscos El Faro
📍 Cd. Obregón, col. Centro
✅ Sueldo $2,500 a $3,000 semanales
✅ Horario: lunes a sábado de 8 am a 4 pm
Requisitos: mayor de 18, ganas de trabajar
Interesados mandar WhatsApp al 644 123 4567`;
  const d = leerPublicacion(texto);
  assert.equal(d.puesto, "Ayudante de cocina");
  assert.equal(d.empresa, "Mariscos El Faro");
  assert.equal(d.ubicacion, "Cd. Obregón, Sonora");
  assert.equal(d.sueldo_min, 2500);
  assert.equal(d.sueldo_max, 3000);
  assert.equal(d.periodo, "semana");
  assert.equal(d.horario, "lunes a sábado de 8 am a 4 pm");
  assert.equal(d.contacto_whatsapp, "6441234567");
  assert.equal(d.modalidad, "presencial");
});

test("puesto en la línea siguiente y correo de contacto", () => {
  const d = leerPublicacion(`SE SOLICITA:\nPARAMEDICO/ENFERMERO\nPara trabajo en planta Cd. Obregón, Sonora\nEnvía tu CV a rh@empresa.com.mx`);
  assert.equal(d.puesto, "Paramedico/enfermero");
  assert.equal(d.contacto_correo, "rh@empresa.com.mx");
  assert.equal(d.contacto_whatsapp, "");
});

test("teléfonos en varios formatos", () => {
  assert.equal(extraerTelefono("Tel. (644) 555-12-34"), "");
  assert.equal(extraerTelefono("WhatsApp +52 644 555 1234"), "6445551234");
  assert.equal(extraerTelefono("al 6445551234 o al 6449998877"), "6445551234");
  assert.equal(extraerTelefono("llama al 644.555.1234"), "6445551234");
  assert.equal(extraerTelefono("sin teléfono"), "");
});

test("sueldos: semanal, quincenal, mensual, diario y sin sueldo", () => {
  assert.deepEqual(extraerSueldo("Sueldo $9,000 mensual"), { sueldo_min: 9000, sueldo_max: null, periodo: "mes" });
  assert.deepEqual(extraerSueldo("Pago quincenal de $4,500"), { sueldo_min: 9000, sueldo_max: null, periodo: "mes" });
  assert.deepEqual(extraerSueldo("$4,500 quincenales"), { sueldo_min: 9000, sueldo_max: null, periodo: "mes" });
  assert.deepEqual(extraerSueldo("Pagamos $400 diarios"), { sueldo_min: 2400, sueldo_max: null, periodo: "semana" });
  assert.deepEqual(extraerSueldo("$2,200 semanales + bonos"), { sueldo_min: 2200, sueldo_max: null, periodo: "semana" });
  assert.deepEqual(extraerSueldo("Mayor de 18 años, 2 años de experiencia"), { sueldo_min: null, sueldo_max: null, periodo: null });
});

test("home office y otras ciudades", () => {
  assert.equal(leerPublicacion("Buscamos asesor de ventas home office, $8,000 mensuales").modalidad, "remoto");
  assert.equal(leerPublicacion("Se solicita chofer en Navojoa").ubicacion, "Navojoa, Sonora");
});
