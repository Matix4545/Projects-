// Tipos de escote, trazados sobre la blusa base sin mangas.
import { type Pt, P, curva, dir, dist, escalar, hacia, interseccion, perp, reflejar, resta, rotar, spline, suma, unitario, grados } from "../geometria.ts";
import type { Medidas } from "../medidas.ts";
import { cuerpoBase, delanteroConPinza } from "../bases/cuerpo.ts";
import { rectangulo } from "../bases/utiles.ts";
import {
  type Pieza,
  type V,
  abrir,
  completar,
  corto,
  indicesTramo,
  idx,
  insertar,
  margen,
  piquete,
  reemplazar,
  tiene,
  v,
} from "../pieza.ts";
import { blusaBase } from "./comun.ts";
import {
  aberturaEspalda,
  cambiarEscote,
  curvaCuadrada,
  curvaRedonda,
  curvaV,
  doblezExtremo,
  enHombro,
  limpiarPinzas,
  lineaCentro,
  necesitaAbertura,
  perpHombroAbajo,
  pinzaEspaldaASisa,
  abrirSeparando,
  pinzasBajoBorde,
  vistaEscote,
  vistaRecortada,
} from "./ayuda-escotes.ts";
import type { Modelo } from "./tipos.ts";

type Curva = (C: Pt, S: Pt, abajo: Pt) => Pt[];

/** Blusa sin mangas con el escote cambiado en delantero y espalda, más sus vistas. */
function blusaConEscote(
  m: Medidas,
  o: { abrir: number; bajarD: number | ((c0: Pt, S: Pt) => number); bajarE: number | ((c0: Pt, S: Pt) => number); curvaD: Curva; curvaE: Curva },
): { piezas: Pieza[]; delantero: Pieza; espalda: Pieza; bp: Pt; lineaBusto: number } {
  const b = blusaBase(m);
  let esp = b.espalda;
  const del = b.delantero;
  // con el escote muy abierto la pinza de hombro de la espalda estorba: pasa a la sisa
  if (o.abrir > 3.5) esp = pinzaEspaldaASisa(esp);
  const cuanto = (pz: Pieza, x: number | ((c0: Pt, S: Pt) => number)) => (typeof x === "number" ? x : x(v(pz, "centroCuello"), enHombro(pz, o.abrir)));
  cambiarEscote(del, o.abrir, cuanto(del, o.bajarD), o.curvaD);
  cambiarEscote(esp, o.abrir, cuanto(esp, o.bajarE), o.curvaE);
  for (const pz of [del, esp]) {
    piquete(pz, "cuelloHombro");
    piquete(pz, "centroCuello");
  }
  if (necesitaAbertura(del, esp)) aberturaEspalda(esp);
  pinzasBajoBorde(del);
  pinzasBajoBorde(esp);
  return {
    piezas: [esp, del, vistaEscote(esp, "Vista de escote espalda"), vistaEscote(del, "Vista de escote delantero")],
    delantero: del,
    espalda: esp,
    bp: b.cuerpo.ref.bp,
    lineaBusto: b.cuerpo.ref.lineaBusto,
  };
}

const PASOS_COMUNES = [
  "Abre el escote la misma cantidad en el hombro del delantero y de la espalda, para que las costuras de hombro sigan midiendo igual.",
  "El escote nuevo sale a 90° del centro (al doblez) y llega a 90° al hombro: así queda continuo al coser el hombro.",
  "Calca la vista de escote de 6 cm de ancho siguiendo la línea nueva.",
];

/** Lado (signo en x) hacia el costado, visto desde el punto C del centro. */
const ladoDe = (C: Pt, S: Pt) => Math.sign(S.x - C.x) || 1;

// ── Escotes que salen del delantero/espalda completos ───────────────────────

/** Halter: el delantero se sostiene con una tira al cuello; la espalda queda descubierta. */
function halter(m: Medidas): Pieza[] {
  const b = blusaBase(m);
  const del = b.delantero;
  const esp = b.espalda;
  // delantero: punto del escote a 3 cm del cuello, tirante de 3.5 cm y sisa recortada
  const lado = Math.sign(v(del, "hombro").x - v(del, "centroCuello").x);
  const desdeHombro = [...lineaEscoteDesdeHombro(del)];
  const N1 = puntoEn(desdeHombro, 3);
  const n1 = insertar(del, "halterCuello", N1);
  const dh = dir(v(del, "cuelloHombro"), v(del, "hombro"));
  const N2 = suma(N1, escalar(dh, 3.5));
  const U = hacia(v(del, "sisaBajo"), v(del, "pinzaBustoA"), 2);
  const u = insertar(del, "halterSisa", U);
  const sisa = curva(N2, P(lado * 0.12, -1), U, P(lado, 0), 0.55, 0.45, 30);
  reemplazar(del, n1, u, [N1, ...sisa]);
  limpiarPinzas(del);
  piquete(del, n1);
  // espalda: escote bajo y recto, del costado al centro
  const Ub = hacia(v(esp, "sisaBajo"), v(esp, "costadoCintura"), 2);
  const ub = insertar(esp, "halterSisa", Ub);
  const cb = P(0, Ub.y - 2);
  const linea = curva(Ub, P(-1, 0.05), cb, P(-1, 0), 0.4, 0.4, 24);
  reemplazar(esp, ub, "centroCuello", linea);
  limpiarPinzas(esp);
  pinzasBajoBorde(del);
  pinzasBajoBorde(esp);
  // vistas
  const vD = vistaRecortada(del, "centroCuello", u, 5, "Vista delantero (escote y sisa)", lineaCentro(del), [U, v(del, "pinzaBustoA")], "Cortar 1 al doblez en tela y 1 en entretela");
  doblezExtremo(vD, "inicio");
  const vE = vistaRecortada(esp, ub, "centroCuello", 5, "Vista de espalda", [Ub, v(esp, "costadoCintura")], lineaCentro(esp), "Cortar 1 al doblez en tela y 1 en entretela");
  doblezExtremo(vE, "fin");
  const tira = rectangulo("Tira para anudar al cuello", 50, 8, "Cortar 2 en tela", { dobladoAlCentro: true });
  return [esp, del, vE, vD, tira];
}

/** Escote asimétrico de un hombro: piezas completas (no al doblez). */
function asimetrico(m: Medidas): Pieza[] {
  const b = blusaBase(m);
  const piezas: Pieza[] = [];
  for (const [pz0, desde, hasta, abajo] of [
    [b.espalda, "centroCuello", "centroBajo", "costadoCintura*"],
    [b.delantero, "centroBajo", "centroCuello", "pinzaBustoA*"],
  ] as const) {
    const pz = completar(pz0, desde, hasta);
    pz.nombre = `${pz0.nombre} (completo)`;
    pz.cortar = "Cortar 1 en tela (pieza completa, derecho hacia arriba)";
    const S = enHombro(pz, 2.5);
    const s = insertar(pz, "asimHombro", S);
    const U = hacia(v(pz, "sisaBajo*"), v(pz, abajo), 2);
    const u = insertar(pz, "asimBajo", U);
    const haciaU = Math.sign(U.x - S.x);
    const linea = curva(S, perpHombroAbajo(pz), U, P(haciaU, 0), 0.35, 0.5, 40);
    // reemplaza el tramo que pasa por el centro del escote
    const pasaCentro = indicesTramo(pz, s, u).includes(idx(pz, "centroCuello"));
    if (pasaCentro) reemplazar(pz, s, u, linea);
    else reemplazar(pz, u, s, [...linea].reverse());
    limpiarPinzas(pz);
    pinzasBajoBorde(pz);
    piquete(pz, s);
    // vista del escote asimétrico
    const [a, z] = pasaCentro ? [s, u] : [u, s];
    const lineaS: [Pt, Pt] = [S, v(pz, "hombro")];
    const lineaU: [Pt, Pt] = [U, v(pz, abajo)];
    const vi = vistaRecortada(pz, a, z, 5, `Vista ${pz0.nombre === "Espalda" ? "de espalda" : "delantera"}`, a === s ? lineaS : lineaU, a === s ? lineaU : lineaS, "Cortar 1 en tela y 1 en entretela");
    piezas.push(pz, vi);
  }
  return [piezas[0], piezas[2], piezas[1], piezas[3]];
}

/** Escote palabra de honor (strapless): top a la cintura, ajustado, con cierre al centro espalda. */
function palabraDeHonor(m: Medidas): Pieza[] {
  const c = cuerpoBase(m, { holguraBusto: 4, holguraCintura: 2 });
  const del = delanteroConPinza(c, "costado");
  const esp = structuredClone(c.espalda);
  const { bp } = c.ref;
  const lado = Math.sign(v(del, "hombro").x - v(del, "centroCuello").x);
  // delantero: borde superior 8.5 cm arriba del punto de busto, 2 cm abajo de la sisa en el costado
  const U = hacia(v(del, "sisaBajo"), v(del, "pinzaBustoA"), 2);
  const u = insertar(del, "bordeCostado", U);
  const C = P(v(del, "centroCuello").x, bp.y + 8.5);
  const borde = curva(C, P(lado, 0.2), U, P(lado, -0.45), 0.45, 0.35, 30);
  reemplazar(del, "centroCuello", u, borde);
  limpiarPinzas(del);
  // espalda: borde recto 1 cm más bajo en el centro
  const Ub = hacia(v(esp, "sisaBajo"), v(esp, "costadoCintura"), 2);
  const ub = insertar(esp, "bordeCostado", Ub);
  const cb = P(0, Ub.y - 1);
  reemplazar(esp, ub, "centroCuello", curva(Ub, P(-1, 0), cb, P(-1, 0), 0.4, 0.4, 20));
  limpiarPinzas(esp);
  pinzasBajoBorde(del);
  pinzasBajoBorde(esp);
  // la espalda lleva cierre al centro: sin doblez
  const [a, z] = corto(esp, "centroCuello", "centroCintura");
  for (const k of indicesTramo(esp, a, z).slice(0, -1)) esp.contorno[k].d = false;
  margen(esp, a, z, 1.5);
  esp.cortar = "Cortar 2 en tela (cierre al centro espalda)";
  // cintura con margen para unir a falda o hacer bastilla
  margen(del, ...corto(del, "costadoCintura", "centroCintura"), 1.5);
  margen(esp, ...corto(esp, "centroCintura", "costadoCintura"), 1.5);
  for (const pz of [del, esp]) {
    pz.marcas.push({ t: "texto", p: suma(v(pz, pz === del ? u : ub), P(pz === del ? -lado * 3 : -3, -4)), s: "varilla", h: 0.6 });
  }
  const vD = vistaRecortada(del, "centroCuello", u, 5, "Vista superior delantera", lineaCentro(del), [U, v(del, "pinzaBustoA")], "Cortar 1 al doblez en tela y 1 en entretela");
  doblezExtremo(vD, "inicio");
  const vE = vistaRecortada(esp, ub, "centroCuello", 5, "Vista superior espalda", [Ub, v(esp, "costadoCintura")], lineaCentro(esp), "Cortar 2 en tela y 2 en entretela");
  return [esp, del, vE, vD];
}

/** Escote cascada (cowl): se abre el delantero del centro al hombro y se corta al bies. */
function cascada(m: Medidas): Pieza[] {
  const b = blusaBase(m);
  let del = b.delantero;
  const esp = b.espalda;
  const abrirHombro = 2;
  const profundidad = 9;
  // 1) escote en V hasta la profundidad de la cascada
  cambiarEscote(del, abrirHombro, profundidad, curvaV(0.1));
  const c0 = v(del, "centroCuello");
  const S = v(del, "cuelloHombro");
  const s = "cuelloHombro";
  const H = v(del, "hombro");
  // 2) cortes del centro al hombro, de abajo hacia arriba
  const cortes = [
    { prof: 11, t: 0.75 },
    { prof: 7, t: 0.5 },
    { prof: 3, t: 0.25 },
  ];
  cortes.forEach(({ prof, t }, k) => {
    insertar(del, `cascadaCentro${k}`, P(c0.x, c0.y - prof));
    insertar(del, `cascadaBisagra${k}`, suma(S, escalar(resta(H, S), t)));
  });
  // giro total: que el centro de abajo quede a escuadra con el borde de la cascada (S → fondo de la V)
  const bordeOrig = resta(S, c0);
  // el centro es vertical; su ángulo con el borde es atan(|dx|/dy); para quedar a escuadra gira el resto
  const objetivo = Math.PI / 2 - Math.atan2(Math.abs(bordeOrig.x), bordeOrig.y);
  const porCorte = Math.abs(objetivo) / cortes.length;
  cortes.forEach((_, k) => {
    const r = dist(v(del, `cascadaCentro${k}`), v(del, `cascadaBisagra${k}`));
    del = abrirSeparando(del, `cascadaCentro${k}`, `cascadaBisagra${k}`, 2 * r * Math.sin(porCorte / 2));
  });
  // 3) borde de la cascada: recta del hombro al fondo de la V. El centro nuevo sale a
  //    escuadra de ese borde y baja hasta la línea de la bastilla.
  const cb0 = v(del, "centroBajo");
  const Sact = v(del, s);
  const topCF = v(del, "centroCuello");
  const bordeDir = unitario(resta(Sact, topCF));
  let abajo = P(bordeDir.y, -bordeDir.x);
  if ((cb0.x - topCF.x) * abajo.x + (cb0.y - topCF.y) * abajo.y < 0) abajo = escalar(abajo, -1);
  const arriba = escalar(abajo, -1);
  // bastilla: recta por el costado bajo y el centro bajo; el centro nuevo llega a ella
  const kb = v(del, "costadoBajo");
  const cb = interseccion(kb, cb0, topCF, suma(topCF, abajo)) ?? cb0;
  // vista incluida: 7 cm por encima del borde, reflejando el hombro
  const vistaAncho = 7;
  const topExt = suma(topCF, escalar(arriba, vistaAncho));
  const hombroRefl = reflejar(v(del, "cascadaBisagra2"), topCF, Sact);
  const Sext = interseccion(Sact, hombroRefl, topExt, suma(topExt, resta(Sact, topCF))) ?? suma(Sact, escalar(arriba, vistaAncho));
  const [a, z] = corto(del, "centroBajo", s);
  const nuevos = [cb, topCF, topExt, Sext, Sact];
  // si el centro nuevo cae afuera de la bastilla vieja, la bastilla se alarga en línea recta
  reemplazar(del, a, z, a === "centroBajo" ? nuevos : [...nuevos].reverse());
  // nombres para el doblez del centro
  const iTop = del.contorno.findIndex((q) => dist(q, topExt) < 0.01);
  del.contorno[iTop].n = "cascadaVista";
  const iC = del.contorno.findIndex((q) => dist(q, topCF) < 0.01);
  del.contorno[iC].n = "cascadaCentro";
  for (const q of del.contorno) {
    q.d = false;
    if (q.m === 0) q.m = 1;
  }
  limpiarPinzas(del);
  del.marcas.push({ t: "linea", pts: [topCF, Sact], estilo: "doblez" });
  del.marcas.push({ t: "texto", p: suma(topCF, escalar(resta(Sact, topCF), 0.5)), s: "doblez de la vista", h: 0.7 });
  // pieza completa reflejando el centro (de la bastilla a la vista)
  const [f1, f2] = corto(del, "centroBajo", "cascadaVista");
  const full = completar(del, f1, f2);
  full.nombre = "Delantero cascada (completo)";
  full.cortar = "Cortar 1 en tela AL BIES (centro a 45° del hilo)";
  const centroFull = medioPts(cb, topExt);
  const dHilo = rotar(arriba, P(0, 0), grados(45));
  full.hilo = [suma(centroFull, escalar(dHilo, -8)), suma(centroFull, escalar(dHilo, 8))];
  full.marcas.push({ t: "linea", pts: [cb, topCF], estilo: "colocacion" });
  // espalda: abre el mismo escote
  cambiarEscote(esp, abrirHombro, 1, curvaRedonda());
  piquete(esp, "cuelloHombro");
  piquete(esp, "centroCuello");
  return [esp, full, vistaEscote(esp, "Vista de escote espalda")];
}

/** Ojo de cerradura en el centro delantero (abertura en gota) y botón en la espalda. */
function ojoDeCerradura(m: Medidas): Pieza[] {
  const b = blusaBase(m);
  const del = b.delantero;
  const esp = b.espalda;
  const c0 = v(del, "centroCuello");
  const lado = Math.sign(v(del, "hombro").x - c0.x);
  const K1 = P(c0.x, c0.y - 1.5);
  const largo = 9;
  const K0 = P(c0.x, K1.y - largo);
  const k1 = insertar(del, "ojoArriba", K1);
  const k0 = insertar(del, "ojoAbajo", K0);
  const gota = spline([K0, P(c0.x + lado * 1.9, K0.y + 0.6), P(c0.x + lado * 2.5, K0.y + 3.2), P(c0.x + lado * 1.4, K1.y - 2.2), K1], 10);
  const [a] = corto(del, k0, k1);
  reemplazar(del, k0, k1, a === k0 ? gota : [...gota].reverse());
  // el borde de la gota se cose con vista: margen 1 cm y sin doblez
  const [x, y] = corto(del, k0, k1);
  for (const k of indicesTramo(del, x, y).slice(0, -1)) {
    del.contorno[k].d = false;
    del.contorno[k].m = 1;
  }
  piquete(del, "cuelloHombro");
  piquete(esp, "cuelloHombro");
  aberturaEspalda(esp, 10);
  // vista que rodea el escote y la gota
  const [va, vz] = corto(del, k0, "cuelloHombro");
  const vD = vistaRecortada(del, va, vz, 5, "Vista de escote delantero", va === k0 ? lineaCentro(del) : [v(del, "cuelloHombro"), v(del, "hombro")], va === k0 ? [v(del, "cuelloHombro"), v(del, "hombro")] : lineaCentro(del), "Cortar 1 al doblez en tela y 1 en entretela");
  doblezExtremo(vD, va === k0 ? "inicio" : "fin");
  const presilla = rectangulo("Presilla para botón (tira al bies)", 8, 2.5, "Cortar 1 al bies");
  return [esp, del, vistaEscote(esp, "Vista de escote espalda"), vD, presilla];
}

// ── Utilidades locales ──────────────────────────────────────────────────────

function lineaEscoteDesdeHombro(pz: Pieza): Pt[] {
  const [a, z] = corto(pz, "cuelloHombro", "centroCuello");
  const t = indicesTramo(pz, a, z).map((k) => ({ x: pz.contorno[k].x, y: pz.contorno[k].y }));
  return a === "cuelloHombro" ? t : t.reverse();
}

function puntoEn(pts: Pt[], l: number): Pt {
  let acum = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = dist(pts[i - 1], pts[i]);
    if (acum + d >= l) return suma(pts[i - 1], escalar(resta(pts[i], pts[i - 1]), (l - acum) / d));
    acum += d;
  }
  return pts[pts.length - 1];
}

const medioPts = (a: Pt, b: Pt) => P((a.x + b.x) / 2, (a.y + b.y) / 2);

// ── Modelos ─────────────────────────────────────────────────────────────────

const simple = (
  id: string,
  nombre: string,
  descripcion: string,
  pasos: string[],
  o: Parameters<typeof blusaConEscote>[1],
  telas?: string,
): Modelo => ({
  id,
  categoria: "escotes",
  nombre,
  descripcion,
  pasos: [...pasos, ...PASOS_COMUNES],
  telas,
  generar: (m) => blusaConEscote(m, o).piezas,
});

export const ESCOTES: Modelo[] = [
  simple(
    "escote-redondo",
    "Escote redondo (joya)",
    "El escote del patrón base: sigue la base del cuello. Como no pasa la cabeza, lleva abertura con botón en el centro espalda.",
    ["Usa el escote del cuerpo base sin cambios.", "Marca en el centro espalda una abertura de 12 cm con botón y presilla."],
    { abrir: 0, bajarD: 0, bajarE: 0, curvaD: curvaRedonda(), curvaE: curvaRedonda(0.5, 0.45) },
  ),
  simple(
    "escote-redondo-amplio",
    "Escote redondo amplio",
    "Redondo más abierto y más bajo que el joya; cómodo y fácil de vestir.",
    ["Abre 2 cm en el hombro.", "Baja 3 cm el centro delantero y 1 cm el centro espalda.", "Une con una curva redonda a escuadra en el centro y en el hombro."],
    { abrir: 2, bajarD: 3, bajarE: 1, curvaD: curvaRedonda(0.55, 0.45), curvaE: curvaRedonda(0.5, 0.45) },
  ),
  simple(
    "escote-v",
    "Escote en V",
    "Línea recta del hombro al centro delantero, que alarga el cuello y el torso.",
    ["Abre 1.5 cm en el hombro.", "Baja 12 cm el centro delantero (queda arriba del busto).", "Une con una recta; en los últimos 3 cm endereza la línea para que llegue a 90° al hombro.", "En la espalda conserva el escote redondo, abierto lo mismo en el hombro."],
    { abrir: 1.5, bajarD: 12, bajarE: 0.5, curvaD: curvaV(), curvaE: curvaRedonda(0.5, 0.45) },
  ),
  simple(
    "escote-u",
    "Escote en U",
    "Escote profundo y redondeado, con lados casi rectos.",
    ["Abre 2.5 cm en el hombro.", "Baja 11 cm el centro delantero y 2 cm la espalda.", "Traza una curva llena: casi recta al bajar y redonda abajo."],
    { abrir: 2.5, bajarD: 11, bajarE: 2, curvaD: curvaRedonda(0.75, 0.6), curvaE: curvaRedonda(0.55, 0.5) },
  ),
  simple(
    "escote-cuadrado",
    "Escote cuadrado",
    "Base recta y lados casi verticales; muy usado en blusas campesinas y vestidos de verano.",
    ["Abre 3 cm en el hombro.", "Baja 9 cm el centro delantero y traza la base horizontal.", "Sube el lado casi vertical hasta el hombro y redondea la esquina con 1.5 cm.", "En la espalda baja 2 cm con escote redondo."],
    { abrir: 3, bajarD: 9, bajarE: 2, curvaD: curvaCuadrada(), curvaE: curvaRedonda(0.6, 0.5) },
  ),
  simple(
    "escote-barco",
    "Escote barco (bateau)",
    "Escote ancho y poco profundo que va casi de hombro a hombro.",
    ["Abre 5.5 cm en el hombro (la pinza de hombro de la espalda pasa a la sisa).", "Sube el centro delantero hasta 2 cm abajo del punto nuevo del hombro y deja la espalda 1 cm abajo.", "Une con una línea casi recta que llegue a escuadra al hombro."],
    {
      abrir: 5.5,
      bajarD: (c0, S) => c0.y - (S.y - 2),
      bajarE: (c0, S) => c0.y - (S.y - 1),
      curvaD: curvaRedonda(0.5, 0.2),
      curvaE: curvaRedonda(0.5, 0.2),
    },
  ),
  {
    id: "escote-corazon",
    categoria: "escotes",
    nombre: "Escote corazón",
    descripcion: "Dos curvas sobre el busto que se juntan en pico al centro delantero, con tirantes anchos.",
    pasos: [
      "Abre 4 cm en el hombro (la pinza de hombro de la espalda pasa a la sisa).",
      "Marca el pico del centro 2 cm arriba del punto de busto.",
      "Marca la parte alta de cada curva 8 cm arriba del punto de busto.",
      "Une: del pico sube en curva hasta la parte alta, sigue horizontal y sube al tirante, llegando a 90° al hombro.",
      "En la espalda baja el escote 6 cm.",
      "Si el escote se abre al probar, quita 0.5–1 cm en la orilla del escote y pásalo a la pinza de costado.",
    ],
    generar: (m) =>
      blusaConEscote(m, {
        abrir: 4,
        bajarD: (c0) => c0.y - (cuerpoBase(m).ref.bp.y + 2),
        bajarE: 6,
        curvaD: (C, S, abajo) => {
          const bp = cuerpoBase(m).ref.bp;
          const lado = ladoDe(C, S);
          const T = P(bp.x + lado * 0.5, bp.y + 8);
          const c1 = curva(C, P(lado * 0.3, 1), T, P(lado, 0), 0.55, 0.55, 20);
          const c2 = curva(T, P(lado, 0.15), S, escalar(abajo, -1), 0.45, 0.5, 26);
          return [...c1, ...c2.slice(1)];
        },
        curvaE: curvaRedonda(0.6, 0.5),
      }).piezas,
  },
  {
    id: "escote-halter",
    categoria: "escotes",
    nombre: "Escote halter",
    descripcion: "El delantero se sostiene con una tira que se anuda al cuello; hombros y espalda alta descubiertos.",
    pasos: [
      "Marca en el escote delantero un punto a 3 cm del cuello y traza ahí el tirante de 3.5 cm.",
      "Baja 2 cm el fondo de sisa en el costado.",
      "Recorta la sisa con una curva del tirante al costado (entrando hacia el centro).",
      "En la espalda traza el borde superior casi recto, del costado al centro, 2 cm más bajo en el centro.",
      "Corta dos tiras de 50 × 8 cm para anudar al cuello.",
    ],
    generar: halter,
  },
  {
    id: "escote-asimetrico",
    categoria: "escotes",
    nombre: "Escote asimétrico (un hombro)",
    descripcion: "Un solo hombro: la línea del escote cruza en diagonal del hombro a la sisa contraria.",
    pasos: [
      "Calca el delantero y la espalda completos (reflejando el doblez del centro).",
      "En el hombro que se queda marca un punto a 2.5 cm del cuello.",
      "En el costado contrario baja 2 cm el fondo de sisa.",
      "Une con una curva suave que salga a 90° del hombro; haz lo mismo en la espalda.",
      "Corta las piezas completas con el derecho de la tela hacia arriba. La sisa se termina con bies.",
    ],
    generar: asimetrico,
  },
  {
    id: "escote-palabra-de-honor",
    categoria: "escotes",
    nombre: "Escote palabra de honor (strapless)",
    descripcion: "Sin tirantes: el borde superior pasa arriba del busto y bajo los brazos. Se ajusta al cuerpo y lleva varillas.",
    pasos: [
      "Usa un cuerpo ajustado: 4 cm de holgura en busto y 2 cm en cintura, largo a la cintura.",
      "Marca el borde 8.5 cm arriba del punto de busto en el centro y 2 cm abajo de la sisa en el costado.",
      "Une con una curva suave; en la espalda el borde va recto, 1 cm más bajo al centro.",
      "Cierre al centro espalda. Pon varillas en costados, pinzas y centro delantero; forra el cuerpo completo.",
      "Al probar, el borde debe quedar firme: si se separa del cuerpo, quita 0.5 cm en cada costado.",
    ],
    telas: "Telas firmes (tafeta, gabardina ligera, satín grueso) con entretela y forro.",
    generar: palabraDeHonor,
  },
  {
    id: "escote-cascada",
    categoria: "escotes",
    nombre: "Escote cascada (cowl)",
    descripcion: "Pliegues suaves que caen al frente. El delantero se corta al bies para que la tela caiga.",
    pasos: [
      "Abre 2 cm el escote en el hombro y baja el centro delantero 9 cm con una línea recta (escote en V).",
      "Traza tres cortes del centro delantero (a 3, 7 y 11 cm abajo de la V) a la línea de hombro.",
      "Corta y abre cada corte en el centro, sin separar el hombro, hasta que el centro de abajo quede a escuadra con la línea del hombro al fondo de la V.",
      "Traza el centro nuevo recto de la bastilla al fondo de la V y alárgalo; el borde de la cascada sale del hombro a escuadra con ese centro.",
      "Agrega 7 cm de vista incluida reflejando el hombro.",
      "Calca la pieza completa y córtala al bies (el centro a 45° del hilo).",
    ],
    telas: "Telas con mucha caída: crepé, satín, viscosa, seda, jersey de rayón.",
    generar: cascada,
  },
  {
    id: "escote-ojo-de-cerradura",
    categoria: "escotes",
    nombre: "Escote ojo de cerradura",
    descripcion: "Escote redondo con una abertura en gota al centro delantero; en la espalda, botón con presilla.",
    pasos: [
      "Parte del escote redondo.",
      "Marca la gota en el centro delantero: empieza 1.5 cm abajo del escote, mide 9 cm de largo y 5 cm de ancho.",
      "Calca una vista que rodee el escote y la gota (5 cm de ancho).",
      "En la espalda marca una abertura de 10 cm con botón y presilla al bies.",
    ],
    generar: ojoDeCerradura,
  },
  {
    id: "escote-v-espalda",
    categoria: "escotes",
    nombre: "Escote en V en la espalda",
    descripcion: "El escote delantero queda alto y la espalda baja en V profunda hasta la línea del brasier.",
    pasos: [
      "Abre 1.5 cm en el hombro, delante y atrás.",
      "Baja el centro espalda hasta 4 cm abajo de la línea de busto.",
      "Une con una recta que se endereza al llegar al hombro.",
      "Si la V se abre al probar, quita 0.5 cm en la orilla y pásalo a la pinza de hombro.",
      ...PASOS_COMUNES,
    ],
    generar: (m) =>
      blusaConEscote(m, {
        abrir: 1.5,
        bajarD: 0,
        bajarE: (c0) => c0.y - (cuerpoBase(m).ref.lineaBusto - 4),
        curvaD: curvaRedonda(),
        curvaE: curvaV(0.12),
      }).piezas,
  },
];
