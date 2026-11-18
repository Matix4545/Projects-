import assert from "node:assert/strict";
import { test } from "node:test";
import {
  abajoDesdeOrientacion,
  abajoEnCamara,
  area,
  aLocal,
  calibrarConRectangulo,
  camaraDesdeFov,
  ejesSuelo,
  fovDesdeFocal,
  homografia,
  horizonteY,
  inclinacion,
  medirContorno,
  medirConReferencia,
  pixelASuelo,
  rumboEntre,
  sueloALatLng,
  sueloAPixel,
  type Px,
  type Suelo,
  type Vec3,
} from "../lib/baches/geometria.ts";
import { NIVELES_BACHE, diametroEquivalenteCm, nivelBache } from "../lib/constantes.ts";

const cerca = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} ${a} ≉ ${b} (±${tol})`);

/** Celular vertical en el parabrisas, mirando 8° hacia abajo */
const abajo8 = () => abajoEnCamara(abajoDesdeOrientacion(82, 0), 0);
const cam = camaraDesdeFov(1280, 720, 66);
const H = 1.25;

test("orientación: celular vertical mirando 8° abajo", () => {
  const g = abajo8();
  const { pitch, roll } = inclinacion(g);
  cerca(pitch, 8, 1e-9);
  cerca(roll, 0, 1e-9);
  // Acostado (pantalla girada 90°, la parte de arriba del celular a la izquierda): el piso queda
  // hacia el lado izquierdo del celular (-x). Con el mismo ángulo hacia abajo debe dar lo mismo.
  const acostado: Vec3 = [-Math.cos((8 * Math.PI) / 180), 0, -Math.sin((8 * Math.PI) / 180)];
  const g90 = abajoEnCamara(acostado, 90);
  cerca(inclinacion(g90).pitch, 8, 1e-9);
  cerca(inclinacion(g90).roll, 0, 1e-9);
  const g270 = abajoEnCamara([-acostado[0], 0, acostado[2]], 270);
  cerca(inclinacion(g270).pitch, 8, 1e-9);
  cerca(inclinacion(g270).roll, 0, 1e-9);
  // beta/gamma con el celular acostado y la parte de arriba a la izquierda: gamma = -90 + 8
  const g90b = abajoEnCamara(abajoDesdeOrientacion(0, -82), 90);
  cerca(inclinacion(g90b).pitch, 8, 1e-9);
});

test("píxel ↔ piso: ida y vuelta", () => {
  const ejes = ejesSuelo(abajo8())!;
  for (const p of [
    [0, 5],
    [-1.5, 8],
    [2, 12.3],
  ] as Suelo[]) {
    const px = sueloAPixel(p, cam, ejes, H)!;
    const s = pixelASuelo(px, cam, ejes, H)!;
    cerca(s[0], p[0], 1e-9);
    cerca(s[1], p[1], 1e-9);
  }
  // El centro de la imagen está a h / tan(8°) metros
  const centro = pixelASuelo([cam.cx, cam.cy], cam, ejes, H)!;
  cerca(centro[1], H / Math.tan((8 * Math.PI) / 180), 1e-9);
  // Arriba del horizonte no hay piso
  const hy = horizonteY(cam, ejes)!;
  assert.equal(pixelASuelo([640, hy - 5], cam, ejes, H), null);
  assert.ok(pixelASuelo([640, hy + 5], cam, ejes, H));
});

/** Bache irregular de área conocida en el piso, visto por la cámara */
function bache(cx: number, cy: number, radio: number, n = 40): Suelo[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 2 * Math.PI;
    const r = radio * (1 + 0.25 * Math.sin(3 * a) + 0.1 * Math.cos(5 * a));
    return [cx + r * Math.cos(a), cy + r * Math.sin(a) * 1.3] as Suelo;
  });
}

test("el área no cambia con la distancia (aunque los píxeles sí)", () => {
  const g = abajo8();
  const ejes = ejesSuelo(g)!;
  const areasPx: number[] = [];
  for (const d of [4, 6, 9, 12]) {
    const real = bache(0.4, d, 0.35);
    const contorno = real.map((p) => sueloAPixel(p, cam, ejes, H)!) as Px[];
    areasPx.push(area(contorno));
    const m = medirContorno(contorno, cam, g, H)!;
    cerca(m.area_m2, area(real), 1e-6, `a ${d} m`);
    cerca(m.centro[1], d, 0.05);
    assert.equal(m.enZona, true, `a ${d} m: ${m.motivo}`);
  }
  // Más cerca → más píxeles
  assert.ok(areasPx[0] > 3 * areasPx[3]);
});

test("zona dulce: lejos, cortado por el borde y arriba del horizonte", () => {
  const g = abajo8();
  const ejes = ejesSuelo(g)!;
  const lejos = bache(0, 20, 0.4).map((p) => sueloAPixel(p, cam, ejes, H)!) as Px[];
  assert.equal(medirContorno(lejos, cam, g, H)!.motivo, "lejos");
  const cortado = bache(3.2, 4.5, 0.6).map((p) => sueloAPixel(p, cam, ejes, H)!).map(([u, v]) => [Math.min(u, 1279), Math.min(v, 719)]) as Px[];
  assert.equal(medirContorno(cortado, cam, g, H)!.enZona, false);
  assert.equal(medirContorno([[600, 10], [700, 10], [650, 60]], cam, g, H), null);
});

test("calibración con un rectángulo de 1 × 2 m recupera el campo de visión y la altura", () => {
  const g = abajoEnCamara(abajoDesdeOrientacion(80, 1.5), 0);
  const real = camaraDesdeFov(1280, 720, 71);
  const ejes = ejesSuelo(g)!;
  const esquinas = (
    [
      [-0.5, 6],
      [0.5, 6],
      [0.5, 8],
      [-0.5, 8],
    ] as Suelo[]
  ).map((p) => sueloAPixel(p, real, ejes, 1.32)!);
  const c = calibrarConRectangulo({ esquinas, anchoM: 1, largoM: 2, abajoCam: g, ancho: 1280, alto: 720 })!;
  cerca(c.fovLargo, 71, 0.3);
  cerca(c.alturaM, 1.32, 0.01);
  assert.ok(c.error < 0.01);
  // Con la altura medida con cinta
  const c2 = calibrarConRectangulo({ esquinas, anchoM: 1, largoM: 2, abajoCam: g, ancho: 1280, alto: 720, alturaM: 1.32 })!;
  cerca(c2.fovLargo, 71, 0.1);
  cerca(fovDesdeFocal(camaraDesdeFov(1280, 720, c2.fovLargo)), c2.fovLargo, 1e-9);
});

test("del piso al mapa", () => {
  const origen: [number, number] = [27.4863, -109.9405];
  // Va hacia el este: 10 m adelante = 10 m al este; 2 m a la derecha = 2 m al sur
  const p = sueloALatLng([2, 10], origen[0], origen[1], 90);
  const [e, n] = aLocal(p, origen);
  cerca(e, 10, 0.01);
  cerca(n, -2, 0.01);
  cerca(rumboEntre(origen, p), 90 + (Math.atan2(2, 10) * 180) / Math.PI, 0.01);
});

test("niveles: chico < 45 cm ≤ mediano < 75 cm ≤ grande (diámetro equivalente)", () => {
  assert.equal(nivelBache(0.1)?.clave, "chico"); // 36 cm
  assert.equal(nivelBache(0.158)?.clave, "chico"); // 44.9 cm
  assert.equal(nivelBache(0.16)?.clave, "mediano"); // 45.1 cm
  assert.equal(nivelBache(0.3517)?.clave, "mediano"); // el bache de InGeniia: 67 cm
  assert.equal(nivelBache(0.45)?.clave, "grande"); // 75.7 cm
  assert.equal(nivelBache(4)?.clave, "grande");
  assert.equal(nivelBache(null), null);
  assert.ok(Math.abs(diametroEquivalenteCm(Math.PI * 0.25 ** 2) - 50) < 1e-9);
  // En la cámara: grande rojo, mediano amarillo, chico verde (el mapa sigue pintando los baches en amarillo)
  assert.deepEqual(NIVELES_BACHE.map((n) => n.color), ["#16a34a", "#facc15", "#dc2626"]);
});

test("medida de referencia: una hoja carta en la foto basta para medir el bache", () => {
  // Foto de pie junto al bache, desde arriba (cámara 70° hacia abajo, a 1.5 m), un poco ladeada
  const g = abajoEnCamara(abajoDesdeOrientacion(20, 3), 0);
  const ejes = ejesSuelo(g)!;
  const cam2 = camaraDesdeFov(3024, 4032, 70);
  const foto = (p: Suelo) => sueloAPixel(p, cam2, ejes, 1.5)!;
  const hoja = ([[0.1, 0.3], [0.316, 0.3], [0.316, 0.579], [0.1, 0.579]] as Suelo[]).map(foto);
  const real = bache(-0.35, 0.6, 0.28);
  const r = medirConReferencia(hoja, 0.216, 0.279, real.map(foto))!;
  cerca(r.area_m2, area(real), area(real) * 1e-6);
  // Un error de 2 px al tocar las esquinas de la hoja cambia poco el área
  const movida = hoja.map(([u, v], i) => [u + (i % 2 ? 2 : -2), v + (i < 2 ? 2 : -1)] as Px);
  const r2 = medirConReferencia(movida, 0.216, 0.279, real.map(foto))!;
  assert.ok(Math.abs(r2.area_m2 / area(real) - 1) < 0.05, `${r2.area_m2} vs ${area(real)}`);
  assert.equal(homografia([[0, 0], [1, 1], [2, 2], [3, 3]], [[0, 0], [1, 0], [1, 1], [0, 1]]), null);
});
