// Herramientas de patronaje que usan varios modelos.
import { type Pt, P, curva, dir, dist, escalar, lerp, longitud, perp, remuestrear, suma, unitario } from "../geometria.ts";
import type { Medidas } from "../medidas.ts";
import { type Pieza, type V, clonar, crear, doblezBorde, margenBorde, orientar, tramo, v } from "../pieza.ts";

/**
 * Alarga un cuerpo (delantero o espalda) por debajo de la cintura.
 * Las pinzas de cintura en V se convierten en pinzas de pez (rombo) que terminan
 * `largoPinza` cm abajo de la cintura; el costado se abre hasta el ancho de cadera.
 *
 * `anchoCadera`: medio ancho en la línea de cadera, medido desde el centro (cm).
 * `largo`: cuánto baja desde la cintura (cm).
 */
export function alargar(
  pz: Pieza,
  m: Medidas,
  o: { anchoCadera: number; largo: number; largoPinza?: number; vuelo?: number; nombre?: string },
): Pieza {
  const r = clonar(pz);
  const cc = v(r, "centroCintura");
  const kc = v(r, "costadoCintura");
  const yW = cc.y;
  const lado = kc.x > cc.x ? 1 : -1; // hacia dónde está el costado
  const yCad = yW - m.alturaCadera;
  const yBajo = yW - o.largo;
  // pinzas de cintura → rombos
  const apicesCintura = r.pinzas.filter((p) => {
    const a = v(r, p.a);
    const b = v(r, p.b);
    return Math.abs(a.y - yW) < 0.3 && Math.abs(b.y - yW) < 0.3;
  });
  for (const pin of apicesCintura) {
    const a = v(r, pin.a);
    const b = v(r, pin.b);
    const ap = v(r, pin.apice);
    const fin = pin.retiro ? lerp(ap, P((a.x + b.x) / 2, yW), pin.retiro / dist(ap, P((a.x + b.x) / 2, yW))) : ap;
    const abajo = P((a.x + b.x) / 2, yW - (o.largoPinza ?? 13));
    r.marcas.push({ t: "pinzaInterna", pts: [a, fin, b, abajo, a] });
    r.contorno = r.contorno.filter((q) => q.n !== pin.apice && q.n !== pin.a && q.n !== pin.b);
  }
  r.pinzas = r.pinzas.filter((p) => !apicesCintura.includes(p));
  // costado: de la cintura a la cadera (curva) y luego recto (o con vuelo)
  const xCad = cc.x + lado * o.anchoCadera;
  const cadera = P(xCad, yCad);
  const vuelo = o.vuelo ?? 0;
  const bajo = P(xCad + lado * vuelo, yBajo);
  const conCadera = o.largo > m.alturaCadera + 0.5;
  let bajada: V[];
  if (conCadera) {
    const curvaLado = curva(kc, dir(kc, P(xCad, (yW + yCad) / 2)), cadera, P(0, -1), 0.4, 0.45);
    bajada = [...curvaLado.slice(1, -1).map((p) => ({ ...p })), { ...cadera, n: "cadera" }, { ...bajo, n: "costadoBajo" }];
  } else {
    bajada = [{ ...lerp(kc, cadera, o.largo / m.alturaCadera), n: "costadoBajo" }];
  }
  const centroBajo: V = { x: cc.x, y: yBajo, n: "centroBajo" };
  const desdeCentro = tramo(r, "centroCintura", "costadoCintura");
  const contieneHombro = desdeCentro.some((q) => q.n === "hombro");
  const nuevos: V[] = contieneHombro
    ? [...desdeCentro, ...bajada, centroBajo]
    : [...tramo(r, "costadoCintura", "centroCintura"), centroBajo, ...[...bajada].reverse()];
  const res: Pieza = { ...r, nombre: o.nombre ?? r.nombre, contorno: nuevos.map((q) => ({ ...q, m: q.d ? 0 : q.m })) };
  orientar(res);
  margenBorde(res, "costadoBajo", "centroBajo", 2);
  if (pz.contorno.some((q) => q.d)) doblezBorde(res, "centroBajo", "centroCintura");
  res.ancla = P(cc.x, yW);
  return res;
}

/**
 * Vista (pieza de refuerzo) que copia un tramo del contorno con el ancho dado.
 * Sirve para vistas de escote, de sisa y de cintura.
 */
export function vista(pz: Pieza, desde: string, hasta: string, ancho: number, nombre: string, cortar = "Cortar 2 en tela y 2 en entretela"): Pieza {
  const t = remuestrear(tramo(pz, desde, hasta), 0.5);
  // normal hacia adentro de la pieza: a la izquierda del sentido antihorario
  const dentro = t.map((p, k) => {
    const a = t[Math.max(0, k - 1)];
    const b = t[Math.min(t.length - 1, k + 1)];
    const nrm = perp(dir(a, b));
    return suma(p, escalar(nrm, ancho));
  });
  const cont: V[] = [
    ...t.map((p, k) => ({ x: p.x, y: p.y, n: k === 0 ? "inicio" : k === t.length - 1 ? "fin" : undefined })),
    ...[...dentro].reverse().map((p, k) => ({ x: p.x, y: p.y, n: k === 0 ? "finInterior" : k === dentro.length - 1 ? "inicioInterior" : undefined })),
  ];
  const r = crear(nombre, cont, { cortar });
  const medio = t[Math.floor(t.length / 2)];
  const nrm = perp(dir(t[Math.floor(t.length / 2) - 1] ?? t[0], t[Math.floor(t.length / 2) + 1] ?? t[t.length - 1]));
  r.hilo = [suma(medio, escalar(nrm, ancho * 0.25)), suma(medio, escalar(nrm, ancho * 0.75))];
  return r;
}

/** Largo de un tramo del escote (para trazar cuellos). */
export function largoEscote(pz: Pieza, desde: string, hasta: string): number {
  return longitud(tramo(pz, desde, hasta));
}

/** Rectángulo (pretinas, puños, tiras, volantes rectos). Esquina inferior izquierda en (0,0). */
export function rectangulo(nombre: string, ancho: number, alto: number, cortar = "Cortar 1 en tela", o: { dobladoAlCentro?: boolean } = {}): Pieza {
  const r = crear(
    nombre,
    [
      { x: 0, y: 0, n: "a" },
      { x: ancho, y: 0, n: "b" },
      { x: ancho, y: alto, n: "c" },
      { x: 0, y: alto, n: "d" },
    ],
    { cortar },
  );
  if (o.dobladoAlCentro) r.marcas.push({ t: "linea", pts: [P(0, alto / 2), P(ancho, alto / 2)], estilo: "doblez" });
  r.hilo = ancho > alto ? [P(ancho * 0.3, alto / 2 - Math.min(2, alto / 4)), P(ancho * 0.3, alto / 2 + Math.min(2, alto / 4))] : [P(ancho / 2, alto * 0.2), P(ancho / 2, alto * 0.8)];
  if (ancho > alto) r.hilo = [P(ancho * 0.2, alto * 0.5), P(ancho * 0.8, alto * 0.5)];
  return r;
}

/**
 * Anillo circular (falda circular, volantes, cuellos de olán).
 * `radio`: radio interior; `ancho`: ancho del anillo; `grados`: cuánto del círculo (360 = completo).
 */
export function anillo(nombre: string, radio: number, ancho: number, grados: number, cortar = "Cortar 1 en tela"): Pieza {
  const a1 = (grados * Math.PI) / 180;
  const n = Math.max(12, Math.round(grados / 3));
  const ext: V[] = [];
  const int: V[] = [];
  for (let k = 0; k <= n; k++) {
    const a = (a1 * k) / n;
    ext.push({ x: (radio + ancho) * Math.cos(a), y: (radio + ancho) * Math.sin(a) });
    int.push({ x: radio * Math.cos(a), y: radio * Math.sin(a) });
  }
  ext[0].n = "bordeIni";
  ext[n].n = "bordeFin";
  int[n].n = "centroFin";
  int[0].n = "centroIni";
  const r = crear(nombre, [...ext, ...[...int].reverse()], { cortar });
  r.hilo = [P(radio + ancho * 0.3, 0.8), P(radio + ancho * 0.7, 0.8)];
  return r;
}

export function largoCurva(pts: Pt[]) {
  return longitud(pts);
}

export { unitario, lerp };
