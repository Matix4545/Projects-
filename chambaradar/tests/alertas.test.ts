import { test } from "node:test";
import assert from "node:assert/strict";
import { correoDeAlerta, describirFiltros, enlaceBusqueda, escaparHtml, filtrosParaAlerta, type AlertaPorEnviar } from "../lib/alertas.ts";

const base: AlertaPorEnviar = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "persona@example.com",
  token: "22222222-2222-2222-2222-222222222222",
  filtros: { categoria: "software", modalidad: "remoto", pais: "MX" },
  acceso: false,
  total: 17,
  vacantes: Array.from({ length: 15 }, (_, i) => ({
    titulo: i === 0 ? 'Senior <script>alert("x")</script> Engineer' : `Backend Engineer ${i}`,
    empresa: null,
    url: null,
    ubicacion: "Remote, Mexico",
    modalidad: "remoto",
    sueldo_min: 120000,
    sueldo_max: 140000,
    moneda: "USD",
    periodo: "año" as const,
  })),
};
const opciones = { sitio: "https://chambaradar.netlify.app", responsable: "Spencer Machuca", pagosActivos: true };

test("describe los filtros en español", () => {
  assert.equal(describirFiltros(base.filtros), "Software e ingeniería · remoto · México");
  assert.equal(describirFiltros({}), "Todas las vacantes");
  assert.equal(describirFiltros({ q: "react", conSueldo: true, tipo: "remoto" }), "empresas extranjeras · con sueldo publicado · puesto: «react»");
});

test("enlace al buscador con los filtros", () => {
  assert.equal(enlaceBusqueda("https://x.com", { pais: "MX", conSueldo: true, q: "data" }), "https://x.com/vacantes?q=data&pais=MX&sueldo=1");
  assert.equal(enlaceBusqueda("", {}), "/vacantes");
});

test("filtros del buscador a alerta sin vacíos", () => {
  assert.deepEqual(filtrosParaAlerta({ q: "", categoria: "datos-ia", pais: "", modalidad: "remoto", nivel: "", tipo: "", conSueldo: false }), {
    categoria: "datos-ia",
    modalidad: "remoto",
  });
});

test("escapa HTML de textos de terceros", () => {
  assert.equal(escaparHtml(`<a href="x">'&'</a>`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  const c = correoDeAlerta(base, opciones);
  assert.doesNotMatch(c.html, /<script>/);
  assert.match(c.html, /&lt;script&gt;/);
});

test("sin plan: el correo no lleva empresa ni enlaces a la vacante e invita a ver planes", () => {
  const c = correoDeAlerta(base, opciones);
  assert.equal(c.para, "persona@example.com");
  assert.equal(c.asunto, "17 vacantes nuevas: Software e ingeniería · remoto · México");
  assert.match(c.html, /Empresa oculta/);
  assert.match(c.html, /…y 2 más/);
  assert.match(c.html, /\/precios/);
  assert.match(c.html, /alertas\/baja\?t=22222222/);
  assert.equal(c.bajaUnClic, "https://chambaradar.netlify.app/api/alertas/baja?t=22222222-2222-2222-2222-222222222222");
});

test("con plan: lleva empresa y enlace directo", () => {
  const conPlan: AlertaPorEnviar = {
    ...base,
    acceso: true,
    total: 1,
    vacantes: [{ ...base.vacantes[1], empresa: "Stripe", url: "https://stripe.com/jobs/1" }],
  };
  const c = correoDeAlerta(conPlan, opciones);
  assert.equal(c.asunto, "1 vacante nueva: Software e ingeniería · remoto · México");
  assert.match(c.html, /Stripe/);
  assert.match(c.html, /https:\/\/stripe\.com\/jobs\/1/);
  assert.doesNotMatch(c.html, /\/precios/);
  assert.match(c.texto, /Stripe/);
});

test("sin pagos activos no invita a comprar", () => {
  assert.doesNotMatch(correoDeAlerta(base, { ...opciones, pagosActivos: false }).html, /\/precios/);
});
