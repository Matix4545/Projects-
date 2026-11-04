import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { FORMATOS, LICENCIAS } from "../lib/config.ts";
import { PATRONES } from "../lib/catalogo.ts";
import { lineas, total } from "../lib/precios.ts";
import { convertir, formatear, paisPorCodigo } from "../lib/dinero.ts";
import { crearReferencia, crearTokenDescarga, firmaStripeValida, leerReferencia, leerTokenDescarga } from "../lib/firma.ts";

const S = "x".repeat(40);

test("catálogo: slugs únicos y seguros para la referencia de pago", () => {
  const slugs = PATRONES.map((p) => p.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const p of PATRONES) {
    assert.match(p.slug, /^[a-z0-9-]{1,60}$/, p.slug);
    assert.ok(p.precio >= 0, p.slug);
    assert.ok(p.formatos.length > 0, p.slug);
    for (const f of p.formatos) assert.ok(f in FORMATOS, `${p.slug}: formato ${f}`);
  }
});

test("precios: suma licencias, ignora slugs inválidos y duplicados", () => {
  const ls = lineas([
    { slug: "vestido-amapola", licencia: "personal" },
    { slug: "vestido-amapola", licencia: "personal" },
    { slug: "no-existe", licencia: "personal" },
    { slug: "falda-bugambilia", licencia: "emprendedora" },
  ]);
  assert.equal(ls.length, 2);
  assert.equal(total(ls), 129 + 69 + LICENCIAS.emprendedora.extra);
});

test("referencia firmada: ida y vuelta", () => {
  const arts = [
    { slug: "vestido-amapola", licencia: "emprendedora" as const },
    { slug: "kimono-brisa", licencia: "personal" as const },
  ];
  const ref = crearReferencia(S, arts);
  assert.ok(ref.length <= 256, "Mercado Pago acepta máximo 256 caracteres");
  assert.deepEqual(leerReferencia(S, ref), arts);
});

test("referencia alterada o con otro secreto se rechaza", () => {
  const ref = crearReferencia(S, [{ slug: "falda-bugambilia", licencia: "personal" }]);
  assert.equal(leerReferencia(S, ref.replace("falda-bugambilia", "overol-pitahaya")), null);
  assert.equal(leerReferencia(S, ref.replace("~p", "~e")), null);
  assert.equal(leerReferencia("y".repeat(40), ref), null);
  assert.equal(leerReferencia(S, "basura"), null);
  assert.equal(leerReferencia(S, null), null);
});

test("10 patrones con licencia emprendedora caben en la referencia de Mercado Pago", () => {
  const largos = [...PATRONES].sort((a, b) => b.slug.length - a.slug.length);
  const arts = Array.from({ length: 10 }, (_, i) => ({ slug: largos[i % largos.length].slug, licencia: "emprendedora" as const }));
  assert.ok(crearReferencia(S, arts).length <= 256);
});

test("token de descarga: válido, vencido y alterado", () => {
  const ahora = 1_800_000_000_000;
  const t = crearTokenDescarga(S, { slug: "vestido-amapola", formato: "carta", vence: ahora + 1000 });
  assert.deepEqual(leerTokenDescarga(S, t, ahora), { slug: "vestido-amapola", formato: "carta", vence: ahora + 1000 });
  assert.equal(leerTokenDescarga(S, t, ahora + 2000), null);
  const otro = crearTokenDescarga(S, { slug: "overol-pitahaya", formato: "dxf", vence: ahora + 1000 });
  assert.equal(leerTokenDescarga(S, `${otro.split(".")[0]}.${t.split(".")[1]}`, ahora), null);
});

test("firma de webhook de Stripe", () => {
  const cuerpo = '{"type":"checkout.session.completed"}';
  const t = 1_800_000_000;
  const v1 = createHmac("sha256", "whsec_prueba").update(`${t}.${cuerpo}`).digest("hex");
  const enc = `t=${t},v1=${v1}`;
  assert.equal(firmaStripeValida(cuerpo, enc, "whsec_prueba", t * 1000), true);
  assert.equal(firmaStripeValida(cuerpo + " ", enc, "whsec_prueba", t * 1000), false);
  assert.equal(firmaStripeValida(cuerpo, enc, "otro", t * 1000), false);
  assert.equal(firmaStripeValida(cuerpo, enc, "whsec_prueba", (t + 3600) * 1000), false, "evento viejo");
  assert.equal(firmaStripeValida(cuerpo, null, "whsec_prueba"), false);
});

test("conversión aproximada de moneda", () => {
  const tasas = { MXN: 20, COP: 4000, USD: 1, PEN: 3.6 };
  assert.equal(convertir(100, paisPorCodigo("CO"), tasas), 20000);
  assert.equal(convertir(100, paisPorCodigo("EC"), tasas), 5);
  assert.equal(convertir(129, paisPorCodigo("PE"), tasas), 23.22);
  assert.ok(Number.isNaN(convertir(100, paisPorCodigo("CL"), tasas)), "sin tasa no inventa precio");
  assert.equal(formatear(129, "MXN"), "$129 MXN");
});
