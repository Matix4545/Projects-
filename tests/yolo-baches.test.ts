import assert from "node:assert/strict";
import { test } from "node:test";
import { baches, calcularLetterbox, clasesDeBache, contornoMayor, decodificar, iou, rgbaAEntrada, simplificar, type Tensor } from "../lib/baches/yolo.ts";
import { area } from "../lib/baches/geometria.ts";

const NM = 4;
const MW = 160;

/** Prototipos: el canal 0 es una elipse (distancia con signo), el resto ruido pequeño */
function protos(cx: number, cy: number, rx: number, ry: number): Tensor {
  const data = new Float32Array(NM * MW * MW);
  for (let y = 0; y < MW; y++) {
    for (let x = 0; x < MW; x++) {
      const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
      data[y * MW + x] = (1 - d) * 4;
      for (let k = 1; k < NM; k++) data[k * MW * MW + y * MW + x] = Math.sin(x * 0.7 + y * 0.3 + k);
    }
  }
  return { data, dims: [1, NM, MW, MW] };
}

/** Salida clásica [1, 4 + 1 + NM, N] con las cajas dadas (cx, cy, w, h, conf) */
function salidaClasica(filas: [number, number, number, number, number][]): Tensor {
  const n = filas.length;
  const c = 4 + 1 + NM;
  const data = new Float32Array(c * n);
  filas.forEach((f, i) => {
    for (let k = 0; k < 5; k++) data[k * n + i] = f[k];
    data[5 * n + i] = 3; // coeficiente del canal de la elipse
  });
  return { data, dims: [1, c, n] };
}

test("NMS: quita duplicados y deja la más segura", () => {
  const s = salidaClasica([
    [320, 320, 100, 80, 0.9],
    [322, 318, 100, 80, 0.8],
    [100, 100, 40, 40, 0.6],
    [500, 500, 40, 40, 0.1],
  ]);
  const d = decodificar(s, NM, { umbral: 0.25 });
  assert.equal(d.length, 2);
  assert.ok(Math.abs(d[0].confianza - 0.9) < 1e-6);
  assert.ok(Math.abs(d[1].confianza - 0.6) < 1e-6);
  assert.ok(iou([0, 0, 10, 10], [5, 0, 15, 10]) > 0.33 && iou([0, 0, 10, 10], [5, 0, 15, 10]) < 0.34);
});

test("formato sin NMS (YOLO26 end-to-end)", () => {
  const k = 300;
  const data = new Float32Array(k * (6 + NM));
  data.set([270, 280, 370, 360, 0.85, 0, 3, 0, 0, 0], 0);
  data.set([10, 10, 20, 20, 0.05, 0, 0, 0, 0, 0], 6 + NM);
  const d = decodificar({ data, dims: [1, k, 6 + NM] }, NM, { umbral: 0.25 });
  assert.equal(d.length, 1);
  assert.deepEqual(d[0].caja, [270, 280, 370, 360]);
});

test("contorno subpíxel de una elipse y regreso al cuadro original", () => {
  // Cuadro de 1280 × 720 dentro de una entrada de 640 × 640
  const lb = calcularLetterbox(1280, 720, 640, 640);
  assert.deepEqual([lb.escala, lb.dx, lb.dy], [0.5, 0, 140]);
  // Elipse en la cuadrícula de prototipos (cada celda = 4 px de entrada = 8 px del cuadro)
  const [cx, cy, rx, ry] = [80, 85, 12, 7];
  const s = salidaClasica([[cx * 4, cy * 4, rx * 8 + 16, ry * 8 + 16, 0.9]]);
  const r = baches(s, protos(cx, cy, rx, ry), lb, { umbral: 0.25 });
  assert.equal(r.length, 1);
  const real = Math.PI * rx * 8 * (ry * 8); // en píxeles del cuadro
  const medida = area(r[0].contorno);
  assert.ok(Math.abs(medida / real - 1) < 0.02, `área ${medida} vs ${real}`);
  // Centro: (80 * 4 / 0.5, (85 * 4 - 140) / 0.5)
  const xs = r[0].contorno.map((p) => p[0]);
  const ys = r[0].contorno.map((p) => p[1]);
  assert.ok(Math.abs((Math.min(...xs) + Math.max(...xs)) / 2 - 640) < 2);
  assert.ok(Math.abs((Math.min(...ys) + Math.max(...ys)) / 2 - 400) < 2);
});

test("la máscara se recorta a la caja", () => {
  const lb = calcularLetterbox(640, 640, 640, 640);
  // Caja que corta la elipse por la mitad
  const s = salidaClasica([[80 * 4 - 24, 80 * 4, 48, 80, 0.9]]);
  const r = baches(s, protos(80, 80, 12, 12), lb, { umbral: 0.25 });
  const xs = r[0].contorno.map((p) => p[0]);
  assert.ok(Math.max(...xs) <= 80 * 4 + 6, `${Math.max(...xs)}`);
});

test("marching squares con dos manchas devuelve la más grande", () => {
  const w = 30;
  const h = 20;
  const p = new Float32Array(w * h);
  for (let y = 2; y < 6; y++) for (let x = 2; x < 6; x++) p[y * w + x] = 1;
  for (let y = 8; y < 17; y++) for (let x = 10; x < 25; x++) p[y * w + x] = 1;
  const c = contornoMayor(p, w, h)!;
  assert.ok(Math.abs(area(c) - 15 * 9) < 15 * 9 * 0.08, String(area(c)));
  assert.ok(simplificar(c, 0.3).length <= 8);
});

test("RGBA a planos", () => {
  const t = rgbaAEntrada(new Uint8ClampedArray([255, 0, 51, 255, 0, 255, 0, 255]), 2, 1);
  [1, 0, 0, 1, 0.2, 0].forEach((v, i) => assert.ok(Math.abs(t[i] - v) < 1e-6));
});

test("clases: solo cuentan los baches en un modelo con varias clases", () => {
  assert.equal(clasesDeBache(["bache"]), null);
  assert.equal(clasesDeBache(undefined), null);
  assert.deepEqual(clasesDeBache(["manhole", "pothole", "grate"]), [1]);
  assert.deepEqual(clasesDeBache(["Bache", "Alcantarilla", "Rejilla", "Pot-hole"]), [0, 3]);
  assert.equal(clasesDeBache(["crack", "patch"]), null);
});
