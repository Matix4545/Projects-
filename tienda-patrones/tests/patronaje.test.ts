import assert from "node:assert/strict";
import { test } from "node:test";
import { TALLAS, completar, talla } from "../patronaje/medidas.ts";
import { cuerpoBase, delanteroConPinza } from "../patronaje/bases/cuerpo.ts";
import { mangaBase } from "../patronaje/bases/manga.ts";
import { faldaBase } from "../patronaje/bases/falda.ts";
import { pantalonBase } from "../patronaje/bases/pantalon.ts";
import { largoTramo as L, type Pieza } from "../patronaje/pieza.ts";
import { acomodar } from "../patronaje/exportar/acomodo.ts";
import { dxf } from "../patronaje/exportar/dxf.ts";
import { MODELOS } from "../patronaje/modelos/index.ts";

const cerca = (a: number, b: number, tol: number, msg: string) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a.toFixed(2)} vs ${b.toFixed(2)}`);

test("cuerpo base: costados, hombros y cintura coinciden en todas las tallas", () => {
  for (const m of TALLAS) {
    const c = cuerpoBase(m);
    const e = c.espalda;
    const d = c.delantero;
    cerca(L(e, "costadoCintura", "sisaBajo"), L(d, "sisaBajo", "costadoCintura"), 0.1, `costado ${m.talla}`);
    cerca(L(e, "hombro", "cuelloHombro"), L(d, "cuelloHombro", "hombro"), 0.1, `hombro ${m.talla}`);
    cerca(L(e, "centroCintura", "costadoCintura") + L(d, "costadoCintura", "centroCintura"), m.cintura / 2 + 2, 0.15, `cintura ${m.talla}`);
  }
});

test("trasladar la pinza de busto no cambia el largo del costado", () => {
  const c = cuerpoBase(talla("M"));
  const original = L(c.delantero, "sisaBajo", "costadoCintura");
  for (const lugar of ["costado", "hombro", "cintura", "francesa", "centro", "escote"] as const) {
    const p = delanteroConPinza(c, lugar);
    cerca(L(p, "sisaBajo", "costadoCintura"), original, 0.05, `costado con pinza en ${lugar}`);
    assert.ok(p.pinzas.some((q) => q.apice === "pinzaBusto"), `pinza de busto en ${lugar}`);
  }
});

test("la copa de la manga mide la sisa más el embebido", () => {
  for (const m of TALLAS) {
    const c = cuerpoBase(m);
    const { manga } = mangaBase(m, c);
    cerca(L(manga, "sisaFrente", "sisaAtras"), c.ref.sisaDelantera + c.ref.sisaEspalda + 2.5, 0.1, `copa ${m.talla}`);
  }
});

test("falda y pantalón base: cintura y costados", () => {
  for (const m of TALLAS) {
    const f = faldaBase(m);
    cerca(L(f.espalda, "costadoBajo", "costadoCintura"), L(f.delantero, "costadoCintura", "costadoBajo"), 0.1, `costado falda ${m.talla}`);
    cerca(L(f.espalda, "costadoCintura", "centroCintura") + L(f.delantero, "centroCintura", "costadoCintura"), m.cintura / 2 + 1, 0.6, `cintura falda ${m.talla}`);
    const p = pantalonBase(m);
    cerca(L(p.espalda, "costadoBajo", "costadoCintura"), L(p.delantero, "costadoCintura", "costadoBajo"), 0.4, `costado pantalón ${m.talla}`);
    cerca(L(p.espalda, "costadoCintura", "centroCintura") + L(p.delantero, "centroCintura", "costadoCintura"), m.cintura / 2 + 1, 0.3, `cintura pantalón ${m.talla}`);
  }
});

test("medidas a la medida: completa lo que falta y respeta lo que se da", () => {
  const m = completar({ busto: 94, cintura: 76, cadera: 102, talleEspalda: 39.5 });
  assert.equal(m.talleEspalda, 39.5);
  assert.ok(m.largoBrazo > 50 && m.cuello > 30);
});

const sinNaN = (pz: Pieza) => pz.contorno.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y));

test("todos los modelos se generan en todas las tallas", () => {
  assert.ok(MODELOS.length >= 5);
  const ids = new Set<string>();
  for (const mod of MODELOS) {
    assert.ok(!ids.has(mod.id), `id repetido: ${mod.id}`);
    ids.add(mod.id);
    assert.match(mod.id, /^[a-z0-9-]+$/);
    assert.ok(mod.pasos.length >= 2, `${mod.id} sin pasos`);
    let cuantas = -1;
    for (const m of TALLAS) {
      const piezas = mod.generar(m);
      assert.ok(piezas.length > 0, `${mod.id} ${m.talla} sin piezas`);
      if (cuantas >= 0) assert.equal(piezas.length, cuantas, `${mod.id}: mismo número de piezas en todas las tallas`);
      cuantas = piezas.length;
      for (const pz of piezas) assert.ok(sinNaN(pz) && pz.contorno.length >= 3, `${mod.id} ${m.talla} ${pz.nombre}`);
    }
  }
});

test("DXF: R12 con una capa por talla", () => {
  const mod = MODELOS.find((x) => x.id === "falda-base")!;
  const pliego = acomodar(mod.nombre, TALLAS.map((m) => ({ talla: m.talla, piezas: mod.generar(m) })));
  const texto = dxf(pliego, mod.nombre).toString("latin1");
  assert.ok(texto.includes("AC1009"));
  for (const t of TALLAS) assert.ok(texto.includes(`TALLA-${t.talla}`), t.talla);
  assert.ok(texto.trimEnd().endsWith("EOF"));
});
