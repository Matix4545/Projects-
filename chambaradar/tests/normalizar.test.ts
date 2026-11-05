import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aceptaLatam,
  detectarCategoria,
  detectarIdioma,
  detectarModalidad,
  detectarNivel,
  detectarPaises,
  htmlATexto,
  normalizar,
  sueldoDeGreenhouse,
} from "../lib/normalizar.ts";
import type { Empresa } from "../lib/tipos.ts";

const local: Empresa = { slug: "x", nombre: "X", ats: "greenhouse", board: "x", tipo: "local" };
const global: Empresa = { ...local, tipo: "remoto", remotoGlobal: true };
const gringa: Empresa = { ...local, tipo: "remoto" };

test("detecta países de LATAM por ciudad o país", () => {
  assert.deepEqual(detectarPaises("Mexico City / CMX / Mexico"), ["MX"]);
  assert.deepEqual(detectarPaises("São Paulo, Brazil"), ["BR"]);
  assert.deepEqual(detectarPaises("Bogotá · Buenos Aires"), ["AR", "CO"]);
  assert.deepEqual(detectarPaises("Ciudad de México (Híbrido)"), ["MX"]);
});

test("no confunde New Mexico ni California con LATAM", () => {
  assert.deepEqual(detectarPaises("Albuquerque, New Mexico"), []);
  assert.deepEqual(detectarPaises("San Francisco, California"), []);
});

test("modalidad: remoto, híbrido y presencial", () => {
  assert.equal(detectarModalidad(["Remote, LATAM"], "Engineer"), "remoto");
  assert.equal(detectarModalidad(["Home based - Worldwide"], "Engineer"), "remoto");
  assert.equal(detectarModalidad(["Bogotá"], "Analista (Híbrido)"), "hibrido");
  assert.equal(detectarModalidad(["Mexico City"], "Engineer", "hybrid"), "hibrido");
  assert.equal(detectarModalidad(["Monterrey"], "Engineer"), "presencial");
});

test("acepta LATAM: país de LATAM o región remota que la incluye", () => {
  assert.equal(aceptaLatam(["Mexico City"], "presencial", ["MX"], gringa), true);
  assert.equal(aceptaLatam(["Remote - LATAM"], "remoto", [], gringa), true);
  assert.equal(aceptaLatam(["Remote, Americas"], "remoto", [], gringa), true);
  assert.equal(aceptaLatam(["Home based - Worldwide"], "remoto", [], gringa), true);
});

test("rechaza remoto limitado a otra región", () => {
  assert.equal(aceptaLatam(["Remote - US"], "remoto", [], gringa), false);
  assert.equal(aceptaLatam(["Remote, North America"], "remoto", [], global), false);
  assert.equal(aceptaLatam(["Remote, South Korea"], "remoto", [], global), false);
  assert.equal(aceptaLatam(["San Francisco, CA"], "presencial", [], gringa), false);
});

test('"Remote" a secas solo cuenta en empresas que contratan en cualquier país', () => {
  assert.equal(aceptaLatam(["Remote"], "remoto", [], global), true);
  assert.equal(aceptaLatam(["Remote"], "remoto", [], gringa), false);
});

test("categoría por título", () => {
  assert.equal(detectarCategoria("Senior Backend Engineer"), "software");
  assert.equal(detectarCategoria("Data Scientist"), "datos-ia");
  assert.equal(detectarCategoria("Account Executive - LATAM"), "ventas");
  assert.equal(detectarCategoria("Product Manager, Payments"), "producto");
  assert.equal(detectarCategoria("Diseñador UX/UI"), "diseno");
  assert.equal(detectarCategoria("Ejecutivo de Cobranza"), "finanzas");
  assert.equal(detectarCategoria("Security Engineer, Cloud"), "seguridad");
  assert.equal(detectarCategoria("Reclutador IT"), "recursos-humanos");
  assert.equal(detectarCategoria("Campaign Manager, Mexico"), "marketing");
});

test("nivel por título", () => {
  assert.equal(detectarNivel("Software Engineer Intern"), "practicante");
  assert.equal(detectarNivel("Becario de Finanzas"), "practicante");
  assert.equal(detectarNivel("Jr. Data Analyst"), "junior");
  assert.equal(detectarNivel("Sr. Backend Engineer"), "senior");
  assert.equal(detectarNivel("Staff Engineer"), "senior");
  assert.equal(detectarNivel("Director of Engineering"), "gerencia");
  assert.equal(detectarNivel("Product Manager"), "intermedio");
  assert.equal(detectarNivel("Account Manager"), "intermedio");
});

test("idioma de la vacante", () => {
  assert.equal(detectarIdioma("Buscamos una persona con experiencia en ventas para nuestro equipo"), "es");
  assert.equal(detectarIdioma("Buscamos uma pessoa com experiência para a nossa equipe, você não"), "pt");
  assert.equal(detectarIdioma("We are looking for an engineer with experience to join our team"), "en");
});

test("HTML escapado de Greenhouse a texto", () => {
  const t = htmlATexto("&lt;p&gt;Hola &amp;amp; adiós&lt;/p&gt;&lt;ul&gt;&lt;li&gt;Uno&lt;/li&gt;&lt;/ul&gt;");
  assert.equal(t, "Hola & adiós\n• Uno");
});

test("sueldo de Greenhouse solo desde el bloque pay-range", () => {
  const html =
    '<p>Mercado de $100B</p><div class="pay-range"><span>$120,000</span><span class="divider">&mdash;</span><span>$140,000 USD</span></div>';
  assert.deepEqual(sueldoDeGreenhouse(html), { min: 120000, max: 140000, moneda: "USD", periodo: "año" });
  assert.equal(sueldoDeGreenhouse("<p>Mercado de $100B</p>"), null);
});

test("normalizar arma la vacante completa", () => {
  const v = normalizar(
    {
      idExterno: "1",
      titulo: "  Senior   Backend Engineer ",
      url: "https://x.com/1",
      ubicaciones: ["Remote, United States", "Remote, Mexico"],
      modalidadAts: "remote",
      descripcion: "We are looking for an engineer with experience",
      publicada: "2026-10-01T00:00:00Z",
      sueldo: { min: 213333.33, max: 293333.33, moneda: "MXN", periodo: "año" },
    },
    gringa,
  );
  assert.equal(v.id, "x:1");
  assert.equal(v.titulo, "Senior Backend Engineer");
  assert.deepEqual(v.paises, ["MX"]);
  assert.equal(v.acepta_latam, true);
  assert.equal(v.ubicacion, "Remote, Mexico · Remote, United States");
  assert.equal(v.sueldo_min, 213300);
  assert.equal(v.nivel, "senior");
});

test("limpia caracteres nulos y emojis partidos", async () => {
  const { limpiarTexto } = await import("../lib/normalizar.ts");
  assert.equal(limpiarTexto("ho\u0000la"), "hola");
  assert.equal(limpiarTexto("a🚀".slice(0, 2)), "a");
  assert.equal(limpiarTexto("ok 🚀"), "ok 🚀");
});

test("títulos en mayúsculas, idioma sin descripción y ubicaciones con comas vacías", async () => {
  const { sinMayusculasSostenidas, idiomaDelTitulo } = await import("../lib/normalizar.ts");
  assert.equal(sinMayusculasSostenidas("PLANEADOR (A) DE MATERIA PRIMA || PLANTA CELAYA"), "Planeador (a) de materia prima || planta celaya");
  assert.equal(sinMayusculasSostenidas("INGENIERO DE QA Y SAP"), "Ingeniero de QA y SAP");
  assert.equal(sinMayusculasSostenidas("Senior Engineer"), "Senior Engineer");
  assert.equal(sinMayusculasSostenidas("QA"), "QA");
  assert.equal(idiomaDelTitulo("Ingeniero de procesos", ["MX"]), "es");
  assert.equal(idiomaDelTitulo("Analista de Cobrança", ["BR"]), "pt");
  assert.equal(idiomaDelTitulo("Senior Backend Engineer", ["MX"]), "en");
  const v = normalizar(
    { idExterno: "9", titulo: "AUXILIAR CONTABLE", url: "u", ubicaciones: ["CELAYA PLANTA, , Mexico"], descripcion: "" },
    local,
  );
  assert.equal(v.ubicacion, "CELAYA PLANTA, Mexico");
  assert.equal(v.idioma, "es");
  assert.equal(v.titulo, "Auxiliar contable");
});

test("descarta montos que no pueden ser sueldo", async () => {
  const { sueldoCreible } = await import("../lib/normalizar.ts");
  assert.equal(sueldoCreible({ min: null, max: 5_000_000, moneda: "USD", periodo: "año" }).sueldo_max, null);
  assert.equal(sueldoCreible({ min: 120_000, max: 140_000, moneda: "USD", periodo: "año" }).sueldo_max, 140_000);
  assert.equal(sueldoCreible({ min: 147_000, max: 183_000, moneda: "MXN", periodo: "año" }).sueldo_max, 183_000);
  assert.equal(sueldoCreible({ min: 40, max: 60, moneda: "USD", periodo: "hora" }).sueldo_max, 60);
  assert.equal(sueldoCreible({ min: 900, max: 1200, moneda: "USD", periodo: "hora" }).sueldo_max, null);
  assert.equal(sueldoCreible(null).moneda, null);
  assert.equal(sueldoCreible({ min: 0.2, max: 0.4, moneda: "USD", periodo: "año" }).sueldo_max, null);
});

test("zonas: Cd. Obregón (Cajeme) y Sonora, sin confundir con Álvaro Obregón", async () => {
  const { detectarZonas } = await import("../lib/normalizar.ts");
  assert.deepEqual(detectarZonas("Obregon, Sonora, Mexico"), ["cajeme", "sonora"]);
  assert.deepEqual(detectarZonas("Cd. Obregón, Son."), ["cajeme", "sonora"]);
  assert.deepEqual(detectarZonas("Ciudad Obregon"), ["cajeme", "sonora"]);
  assert.deepEqual(detectarZonas("85065 OBREGON"), ["cajeme", "sonora"]);
  assert.deepEqual(detectarZonas("Cajeme, México"), ["cajeme", "sonora"]);
  assert.deepEqual(detectarZonas("Hermosillo, Sonora, México"), ["sonora"]);
  assert.deepEqual(detectarZonas("Navojoa"), ["sonora"]);
  assert.deepEqual(detectarZonas("Álvaro Obregón, Ciudad de México"), ["cdmx"]);
  assert.deepEqual(detectarZonas("Alvaro Obregon, CDMX"), ["cdmx"]);
  assert.deepEqual(detectarZonas("Obregón, CDMX"), ["cdmx"]);
  assert.deepEqual(detectarZonas("Monterrey, Nuevo León"), ["nuevo-leon"]);
});

test("enfoque Obregón: Sonora en cualquier modalidad y remotas abiertas a México", async () => {
  const { esRelevanteObregon } = await import("../lib/normalizar.ts");
  const v = (o: object) => ({ zonas: [], modalidad: "presencial" as const, paises: [] as string[], acepta_latam: true, ...o });
  assert.equal(esRelevanteObregon(v({ zonas: ["cajeme", "sonora"], paises: ["MX"] })), true);
  assert.equal(esRelevanteObregon(v({ zonas: ["sonora"], paises: ["MX"], modalidad: "hibrido" })), true);
  assert.equal(esRelevanteObregon(v({ modalidad: "remoto", paises: ["MX"] })), true);
  assert.equal(esRelevanteObregon(v({ modalidad: "remoto", paises: ["MX", "BR"] })), true);
  assert.equal(esRelevanteObregon(v({ modalidad: "remoto", paises: [] })), true); // LATAM o cualquier país
  assert.equal(esRelevanteObregon(v({ modalidad: "remoto", paises: ["BR"] })), false); // solo Brasil
  assert.equal(esRelevanteObregon(v({ modalidad: "presencial", paises: ["MX"] })), false); // presencial en CDMX
  assert.equal(esRelevanteObregon(v({ modalidad: "hibrido", paises: ["MX"] })), false);
});

test("área: agricultura y campo", async () => {
  const { detectarCategoria } = await import("../lib/normalizar.ts");
  for (const t of ["Ingeniero Agrónomo", "Desarrollista Técnico de Mercado", "Crop Research Associate", "Seed Logistics Lead", "Encargado de invernadero", "Médico Veterinario Zootecnista", "Jefe de granja porcícola", "Breeding Trial Specialist", "Técnico de riego"]) {
    assert.equal(detectarCategoria(t), "agro", t);
  }
  for (const t of ["Software Engineer", "Pharmacist", "Representante de ventas", "Farmacéutico", "Seguridad patrimonial"]) {
    assert.notEqual(detectarCategoria(t), "agro", t);
  }
});

test("área: ciberseguridad solo si es seguridad informática", async () => {
  const { detectarCategoria } = await import("../lib/normalizar.ts");
  assert.equal(detectarCategoria("Security Engineer"), "seguridad");
  assert.equal(detectarCategoria("Analista de Ciberseguridad"), "seguridad");
  assert.equal(detectarCategoria("Contador de Nómina y Seguridad Social"), "finanzas");
  assert.notEqual(detectarCategoria("Guardia de seguridad"), "seguridad");
});

test("zonas: los 32 estados por ciudad o nombre, solo si es en México", async () => {
  const { detectarZonas } = await import("../lib/normalizar.ts");
  assert.deepEqual(detectarZonas("Guadalajara, Jalisco, México"), ["jalisco"]);
  assert.deepEqual(detectarZonas("Ciudad de México · Monterrey"), ["cdmx", "nuevo-leon"]);
  assert.deepEqual(detectarZonas("Naucalpan de Juárez"), ["edomex"]);
  assert.deepEqual(detectarZonas("Tijuana, BC"), ["baja-california"]);
  assert.deepEqual(detectarZonas("Cabo San Lucas, Baja California Sur"), ["baja-california-sur"]);
  assert.deepEqual(detectarZonas("Mérida, Yucatán"), ["yucatan"]);
  assert.deepEqual(detectarZonas("León, Gto."), ["guanajuato"]);
  assert.deepEqual(detectarZonas("Miguel Hidalgo, CDMX"), ["cdmx"]);
  assert.deepEqual(detectarZonas("Pachuca, Hidalgo"), ["hidalgo"]);
  assert.deepEqual(detectarZonas("Ciudad Obregón, Sonora"), ["cajeme", "sonora"]);
  assert.deepEqual(detectarZonas("Guadalajara, Spain", false), []);
});

test("solo Brasil no se guarda; Brasil y otro país de LATAM sí", async () => {
  const { soloBrasil } = await import("../lib/recolector.ts");
  assert.equal(soloBrasil({ paises: ["BR"] }), true);
  assert.equal(soloBrasil({ paises: ["BR", "MX"] }), false);
  assert.equal(soloBrasil({ paises: [] }), false);
  assert.equal(soloBrasil({ paises: ["AR"] }), false);
});

test("home office solo para EE. UU. no cuenta aunque diga AMER", async () => {
  const { soloEeuu } = await import("../lib/normalizar.ts");
  assert.equal(soloEeuu("Remote, Massachusetts, United States, AMER"), true);
  assert.equal(soloEeuu("Remote, Bay Area, CA · Remote, AMER"), true);
  assert.equal(soloEeuu("Remote, US"), true);
  assert.equal(soloEeuu("Remote, AMER"), false);
  assert.equal(soloEeuu("Remote - LATAM"), false);
  assert.equal(soloEeuu("Remote, United States or Anywhere"), false);
  assert.equal(soloEeuu("Bogotá, CO"), false);
});

test("títulos: sin códigos al final, sin gritos y con mayúscula inicial", async () => {
  const { limpiarTitulo, esTituloDePrueba } = await import("../lib/normalizar.ts");
  assert.equal(limpiarTitulo("Repartidor-3"), "Repartidor");
  assert.equal(limpiarTitulo("Electromecanico (30400197)"), "Electromecanico");
  assert.equal(limpiarTitulo("CHOFER"), "Chofer");
  assert.equal(limpiarTitulo("recoveries operational (Colima)"), "Recoveries operational (Colima)");
  assert.equal(limpiarTitulo("SAP FICO"), "SAP FICO");
  assert.equal(limpiarTitulo("Student 2"), "Student 2");
  assert.equal(limpiarTitulo("Ingeniero de Procesos Sr. - 2026"), "Ingeniero de Procesos Sr. - 2026");
  assert.equal(esTituloDePrueba("Test2"), true);
  assert.equal(esTituloDePrueba("Test Engineer"), false);
});

test("Americas cuenta como abierto; AMER con EE. UU. no", async () => {
  const { soloEeuu } = await import("../lib/normalizar.ts");
  assert.equal(soloEeuu("Remote, United States; Remote, Americas"), false);
  assert.equal(soloEeuu("Remote, New York, United States, AMER"), true);
});

test("el resumen de ubicación pone México antes que otros países", async () => {
  const { resumirUbicacion } = await import("../lib/normalizar.ts");
  assert.equal(resumirUbicacion(["Brazil", "Peru", "Colombia", "Mexico", "Chile"]), "Mexico · Brazil · Peru y 2 más");
  assert.match(resumirUbicacion(["Lima, Peru", "Hermosillo, Sonora, Mexico", "Mexico City"]), /^Hermosillo/);
});

test("áreas nuevas: banca, producción, salud, turismo y oficios", async () => {
  const { detectarCategoria } = await import("../lib/normalizar.ts");
  assert.equal(detectarCategoria("Asesor PyME Banamex"), "banca");
  assert.equal(detectarCategoria("Cajero Universal Sucursal Obregón"), "banca");
  assert.equal(detectarCategoria("Banquero Patrimonial"), "banca");
  assert.equal(detectarCategoria("Agente de Seguros"), "banca");
  assert.equal(detectarCategoria("Operador de Producción"), "produccion");
  assert.equal(detectarCategoria("Ingeniero de Manufactura"), "produccion");
  assert.equal(detectarCategoria("Técnico de Mantenimiento"), "produccion");
  assert.equal(detectarCategoria("Maintenance Technician"), "produccion");
  assert.equal(detectarCategoria("QA Automation Engineer"), "software");
  assert.equal(detectarCategoria("Quality Assurance Analyst"), "software");
  assert.equal(detectarCategoria("Médico Laboral"), "salud");
  assert.equal(detectarCategoria("Enfermera General"), "salud");
  assert.equal(detectarCategoria("Recepcionista de Hotel"), "turismo");
  assert.equal(detectarCategoria("Camarista"), "turismo");
  assert.equal(detectarCategoria("Chofer Repartidor"), "oficios");
  assert.equal(detectarCategoria("Guardia de Seguridad para nuestra planta"), "oficios");
  assert.equal(detectarCategoria("Courier"), "oficios");
  assert.equal(detectarCategoria("Security Engineer"), "seguridad");
  assert.equal(detectarCategoria("Data Analyst"), "datos-ia");
  assert.equal(detectarCategoria("Account Executive"), "ventas");
});
