// Tipos de cuello. Cada modelo entrega el cuello y la blusa sobre la que se traza
// (delantero, espalda, vistas y manga). El borde del cuello que se cose al escote
// mide lo mismo que el escote: largo de espalda + largo del delantero.
import {
  type Pt,
  P,
  angulo,
  curva,
  dir,
  dist,
  enLongitud,
  escalar,
  hacia,
  interseccion,
  longitud,
  perp,
  resta,
  rotar,
  spline,
  suma,
  unitario,
} from "../geometria.ts";
import type { Medidas } from "../medidas.ts";
import { anillo, rectangulo } from "../bases/utiles.ts";
import { type Pieza, type V, corto, crear, doblezBorde, insertar, margen, piquete, reemplazar, v } from "../pieza.ts";
import { blusaBase } from "./comun.ts";
import {
  aberturaEspalda,
  botones,
  botonesRepartidos,
  cambiarEscote,
  curvaRedonda,
  curvaV,
  delanteroConCruce,
  desplazarAbierta,
  desplazarLimpia,
  largoEscote,
  lineaCentro,
  lineaEscote,
  lineaHombro,
  pinzasBajoBorde,
  vistaDelantera,
  vistaEscote,
  quitarBucles,
  vistaRecortada,
} from "./ayuda-escotes.ts";
import type { Modelo } from "./tipos.ts";

const CRUCE = 1.75;

// ── Blusa sobre la que se trazan los cuellos ────────────────────────────────

type Blusa = {
  espalda: Pieza;
  delantero: Pieza;
  manga: Pieza;
  vistas: Pieza[];
  /** Largo del escote de espalda (centro a hombro) y delantero (centro a hombro). */
  NB: number;
  NF: number;
  bp: Pt;
  lineaBusto: number;
};

function blusa(
  m: Medidas,
  o: {
    cruce?: number;
    abrir?: number;
    bajarD?: number;
    bajarE?: number;
    curvaD?: (C: Pt, S: Pt, abajo: Pt) => Pt[];
    /** Distancia del escote al primer botón. */
    primerBoton?: number;
    vistaDelantera?: boolean;
  } = {},
): Blusa {
  const b = blusaBase(m);
  let del = b.delantero;
  const esp = b.espalda;
  if (o.abrir || o.bajarD) cambiarEscote(del, o.abrir ?? 0, o.bajarD ?? 0, o.curvaD ?? curvaRedonda());
  if (o.abrir || o.bajarE) cambiarEscote(esp, o.abrir ?? 0, o.bajarE ?? 0, curvaRedonda(0.5, 0.45));
  const NB = largoEscote(esp);
  const NF = largoEscote(del);
  const vistas: Pieza[] = [];
  if (o.cruce) {
    del = delanteroConCruce(del, o.cruce);
    if (o.primerBoton !== undefined) botonesRepartidos(del, o.primerBoton);
    if (o.vistaDelantera !== false) vistas.push(vistaDelantera(del, 7));
  }
  for (const pz of [del, esp]) {
    piquete(pz, "cuelloHombro");
    piquete(pz, "centroCuello");
  }
  pinzasBajoBorde(del);
  return { espalda: esp, delantero: del, manga: b.manga, vistas, NB, NF, bp: b.cuerpo.ref.bp, lineaBusto: b.cuerpo.ref.lineaBusto };
}

// ── Banda de cuello (mao, pie de cuello, sport, tortuga) ─────────────────────

type Banda = { pieza: Pieza; cuello: Pt[]; borde: Pt[] };

/**
 * Cuello en banda trazado con el centro espalda en x = 0 (al doblez).
 * El borde de cuello es recto en la espalda y sube (o baja) hacia el frente;
 * su largo total es `largo`. El borde exterior va a `altoCB` en el centro
 * y `altoFrente` en el frente.
 */
function banda(o: {
  nombre: string;
  cortar: string;
  rectoEspalda: number;
  largo: number;
  subida: number;
  altoCB: number;
  altoFrente: number;
  redondeo?: number;
  /** Punta: el borde exterior se alarga esto más allá del frente. */
  punta?: { avance: number; caida: number };
}): Banda {
  const P1 = P(o.rectoEspalda, 0);
  const resto = o.largo - o.rectoEspalda;
  const dirFin = unitario(P(1, Math.sign(o.subida) * 0.55));
  const tramoCurvo = (x: number) => curva(P1, P(1, 0), P(x, o.subida), dirFin, 0.5, 0.35, 30);
  let lo = P1.x + 0.5;
  let hi = P1.x + resto + 5;
  for (let k = 0; k < 50; k++) {
    const x = (lo + hi) / 2;
    if (longitud(tramoCurvo(x)) > resto) hi = x;
    else lo = x;
  }
  const curvo = tramoCurvo((lo + hi) / 2);
  const cuello: Pt[] = [P(0, 0), ...curvo];
  const n = cuello.length;
  const borde = desplazarAbierta(cuello, (k) => o.altoCB + ((o.altoFrente - o.altoCB) * k) / (n - 1));
  const Pf = cuello[n - 1];
  let frente: Pt[];
  if (o.punta) {
    // punta: el borde exterior sale horizontal del centro espalda y baja a la punta
    const tip = suma(Pf, P(o.punta.avance, o.altoFrente + o.punta.caida));
    const exterior = curva(P(0, o.altoCB), P(1, 0), tip, unitario(P(1, -0.25)), 0.5, 0.3, 30);
    return armar(cuello, [...exterior].reverse(), o, borde);
  }
  const r = o.redondeo ?? 0;
  if (r > 0) {
    const Lb = longitud(borde);
    const { p: T1, i } = enLongitud(borde, Lb - r);
    const Tf = borde[n - 1];
    const F1 = suma(Tf, escalar(unitario(resta(Pf, Tf)), Math.min(r, dist(Pf, Tf) * 0.8)));
    const esquina = curva(T1, dir(borde[Math.max(0, i)], T1), F1, dir(Tf, Pf), 0.55, 0.55, 12);
    frente = [...[...esquina].reverse(), ...[...borde.slice(0, i + 1)].reverse()];
  } else {
    frente = [...borde].reverse();
  }
  return armar(cuello, frente, o, borde);
}

function armar(cuello: Pt[], exteriorDesdeFrente: Pt[], o: { nombre: string; cortar: string }, borde: Pt[]): Banda {
  const cont: V[] = [
    { ...cuello[0], n: "cbCuello" },
    ...cuello.slice(1, -1).map((p) => ({ ...p })),
    { ...cuello[cuello.length - 1], n: "frenteCuello" },
    ...exteriorDesdeFrente.slice(0, -1).map((p, k) => (k === 0 ? { ...p, n: "frenteArriba" } : { ...p })),
    { ...exteriorDesdeFrente[exteriorDesdeFrente.length - 1], n: "cbArriba" },
  ];
  const pz = crear(o.nombre, cont, { cortar: o.cortar });
  doblezBorde(pz, "cbArriba", "cbCuello");
  const c = borde[Math.floor(borde.length / 2)];
  pz.hilo = [P(Math.max(1, c.x * 0.3), c.y * 0.5), P(Math.max(3, c.x * 0.9), c.y * 0.5)];
  return { pieza: pz, cuello, borde };
}

/** Piquetes en el borde de cuello a las distancias dadas desde el centro espalda. */
function piquetesEn(pz: Pieza, linea: Pt[], distancias: number[]) {
  for (const d of distancias) if (d > 0.3 && d < longitud(linea) + 0.01) piquete(pz, enLongitud(linea, d).p);
}

// ── Escotes de delantero y espalda unidos por el hombro ─────────────────────

/**
 * Coloca la espalda junto al delantero, hombro con hombro y con los cuellos juntos,
 * traslapando `traslape` cm en la punta del hombro (para cuellos planos: bebé, marinero).
 * Devuelve la línea de escote del centro delantero al centro espalda y cómo mover
 * puntos de la espalda al sistema del delantero.
 */
function escotesUnidos(del: Pieza, esp: Pieza, traslape: number) {
  const snpD = v(del, "cuelloHombro");
  const snpE = v(esp, "cuelloHombro");
  const aD = angulo(resta(v(del, "hombro"), snpD));
  const aE = angulo(resta(v(esp, "hombro"), snpE));
  const L = dist(snpE, v(esp, "hombro"));
  const fi = 2 * Math.asin(Math.min(1, traslape / (2 * L)));
  const dD = unitario(resta(v(del, "hombro"), snpD));
  // gira la espalda hacia el lado del delantero (hacia la izquierda del hombro del delantero)
  const prueba = rotar(P(Math.cos(aD), Math.sin(aD)), P(0, 0), fi);
  const signo = dD.x * prueba.y - dD.y * prueba.x > 0 ? 1 : -1;
  const giro = aD - aE + signo * fi;
  const mover = (p: Pt): Pt => suma(snpD, rotar(resta(p, snpE), P(0, 0), giro));
  const frente = lineaEscote(del); // centro → hombro
  const espaldaLinea = lineaEscote(esp).reverse().map(mover); // hombro → centro espalda
  const linea = [...frente, ...espaldaLinea.slice(1)];
  const cbCuello = mover(v(esp, "centroCuello"));
  const [a, z] = corto(esp, "centroCuello", "centroCintura");
  const haciaAbajo = unitario(resta(mover(v(esp, z === "centroCintura" ? z : a)), cbCuello));
  return { linea, mover, cbCuello, haciaAbajo, NF: longitud(frente), NB: longitud(espaldaLinea) };
}

// ── Cuellos ─────────────────────────────────────────────────────────────────

function mao(m: Medidas): Pieza[] {
  const b = blusa(m, { cruce: CRUCE, primerBoton: 1.5 });
  const largo = b.NB + b.NF + CRUCE;
  const bd = banda({ nombre: "Cuello mao", cortar: "Cortar 2 al doblez en tela y 1 en entretela", rectoEspalda: b.NB, largo, subida: 1.5, altoCB: 3.5, altoFrente: 3, redondeo: 1.5 });
  piquetesEn(bd.pieza, bd.cuello, [b.NB, b.NB + b.NF]);
  const cf = enLongitud(bd.cuello, b.NB + b.NF).p;
  bd.pieza.marcas.push({ t: "ojal", p: suma(cf, P(-0.2, 1.6)), ang: 0, l: 1.4 });
  return [b.espalda, b.delantero, ...b.vistas, bd.pieza, b.manga];
}

function camisero(m: Medidas): Pieza[] {
  const b = blusa(m, { cruce: CRUCE, primerBoton: 7 });
  const largoPie = b.NB + b.NF + CRUCE;
  const pie = banda({ nombre: "Pie de cuello", cortar: "Cortar 2 al doblez en tela y 1 en entretela", rectoEspalda: b.NB, largo: largoPie, subida: 2, altoCB: 3, altoFrente: 2.6, redondeo: 1.6 });
  piquetesEn(pie.pieza, pie.cuello, [b.NB, b.NB + b.NF]);
  const cfPie = enLongitud(pie.cuello, b.NB + b.NF).p;
  pie.pieza.marcas.push({ t: "ojal", p: suma(cfPie, P(-0.2, 1.4)), ang: 0, l: 1.4 });
  // el cuello se cose al borde superior del pie, del centro espalda al centro delantero
  const iCF = indiceMasCercano(pie.cuello, cfPie);
  const largoArriba = longitud(pie.borde.slice(0, iCF + 1));
  const iSnp = indiceMasCercano(pie.cuello, enLongitud(pie.cuello, b.NB).p);
  const snpArriba = longitud(pie.borde.slice(0, iSnp + 1));
  // piquete del pie en su borde superior, donde termina el cuello
  piquete(pie.pieza, pie.borde[iCF]);
  const cuello = banda({
    nombre: "Cuello camisero",
    cortar: "Cortar 2 al doblez en tela y 1 en entretela",
    rectoEspalda: snpArriba * 0.85,
    largo: largoArriba,
    subida: -1.2,
    altoCB: 4.5,
    altoFrente: 5.8,
    punta: { avance: 1.6, caida: 0.6 },
  });
  piquetesEn(cuello.pieza, cuello.cuello, [snpArriba, largoArriba]);
  return [b.espalda, b.delantero, ...b.vistas, pie.pieza, cuello.pieza, b.manga];
}

function sport(m: Medidas): Pieza[] {
  const b = blusa(m, { cruce: CRUCE, primerBoton: 12 });
  const largo = b.NB + b.NF;
  const bd = banda({ nombre: "Cuello sport", cortar: "Cortar 2 al doblez en tela y 1 en entretela", rectoEspalda: b.NB, largo, subida: 0.8, altoCB: 7.5, altoFrente: 7.5, punta: { avance: 2.5, caida: 0.6 } });
  piquetesEn(bd.pieza, bd.cuello, [b.NB]);
  // línea de quiebre: a 3 cm del borde de cuello
  bd.pieza.marcas.push({ t: "linea", pts: desplazarAbierta(bd.cuello, 3), estilo: "doblez" });
  return [b.espalda, b.delantero, ...b.vistas, bd.pieza, b.manga];
}

function peterPan(m: Medidas): Pieza[] {
  const b = blusa(m, { cruce: CRUCE, primerBoton: 1.5 });
  const u = escotesUnidos(b.delantero, b.espalda, 1.5);
  const ancho = 7;
  const exterior = desplazarLimpia(u.linea, ancho);
  // esquina redonda en el centro delantero
  const cf = u.linea[0];
  const Lx = longitud(exterior);
  const { p: Q, i } = enLongitud(exterior, 7);
  const finCB = suma(u.cbCuello, escalar(u.haciaAbajo, ancho));
  const exteriorFinal = [...exterior.slice(i + 1, -1), finCB];
  const esquina = curva(cf, P(0, -1), Q, dir(Q, exterior[Math.min(exterior.length - 1, i + 2)]), 0.55, 0.45, 16);
  void Lx;
  const cont: V[] = [
    { ...u.linea[0], n: "cfCuello" },
    ...u.linea.slice(1, -1).map((p) => ({ ...p })),
    { ...u.cbCuello, n: "cbCuello" },
    { ...finCB, n: "cbArriba" },
    ...[...exteriorFinal].reverse().slice(1).map((p) => ({ ...p })),
    ...[...esquina].reverse().slice(1, -1).map((p) => ({ ...p })),
  ];
  const cuello = crear("Cuello bebé (Peter Pan)", cont, { cortar: "Cortar 2 al doblez en tela y 1 en entretela" });
  doblezBorde(cuello, "cbCuello", "cbArriba");
  piquete(cuello, u.linea[0]);
  piquete(cuello, enLongitud(u.linea, u.NF).p);
  const mid = enLongitud(u.linea, u.NF + u.NB * 0.5).p;
  cuello.hilo = [suma(mid, escalar(u.haciaAbajo, 1.5)), suma(mid, escalar(u.haciaAbajo, 5.5))];
  return [b.espalda, b.delantero, ...b.vistas, cuello, b.manga];
}

/** Cuello sastre: solapa del delantero (con su vista) y cuello que se une en la escotadura. */
function solapa(m: Medidas): Pieza[] {
  const b = blusa(m, { cruce: 2, vistaDelantera: false });
  const del = b.delantero;
  const yB = b.lineaBusto - 1;
  const frente = v(del, "frenteBajo").x;
  const B = P(frente, yB);
  const snp = { ...v(del, "cuelloHombro") };
  const R = suma(snp, escalar(unitario(resta(snp, v(del, "hombro"))), 2));
  const u = dir(B, R);
  const Lr = dist(B, R);
  let nL = perp(u);
  if (nL.x < 0) nL = escalar(nL, -1);
  // punto de escotadura en el escote, a 45% del hombro al centro
  const esc = lineaEscote(del).reverse(); // hombro → centro
  const N = enLongitud(esc, longitud(esc) * 0.45).p;
  // muesca a 70% del quiebre y 4 cm afuera; punta de la solapa a 8.5 cm del quiebre
  const T = suma(suma(B, escalar(u, Lr * 0.66)), escalar(nL, 8.5));
  const Q = suma(suma(B, escalar(u, Lr * 0.7)), escalar(nL, 4));
  const solapaBorde = curva(B, P(0.3, 1), T, u, 0.45, 0.3, 30);
  const bb = insertar(del, "quiebre", B);
  const nn = insertar(del, "escotadura", N);
  const [a] = corto(del, bb, nn);
  const linea = [B, ...solapaBorde.slice(1), Q, N];
  reemplazar(del, a, a === bb ? nn : bb, a === bb ? linea : [...linea].reverse());
  del.marcas.push({ t: "linea", pts: [B, R], estilo: "doblez" });
  del.marcas.push({ t: "texto", p: suma(suma(B, escalar(u, Lr * 0.45)), escalar(nL, 1)), s: "línea de quiebre", h: 0.7 });
  piquete(del, bb);
  botonesDesde(del, yB, 3, 9);
  // vista delantera con la solapa
  const lineaBajo: [Pt, Pt] = [v(del, "frenteBajo"), suma(v(del, "frenteBajo"), P(10, 0))];
  const [va, vz] = corto(del, "frenteBajo", "cuelloHombro");
  const vista = vistaRecortada(del, va, vz, 8, "Vista delantera con solapa", va === "frenteBajo" ? lineaBajo : lineaHombro(del), va === "frenteBajo" ? lineaHombro(del) : lineaBajo, "Cortar 2 en tela (un par) y 2 en entretela");
  // cuello superior: escotadura (Q→N), escote (N→hombro) y escote de espalda paralelo al quiebre
  const tramoN = tramoHastaHombro(del);
  const caida = Math.atan2(2.5, b.NB);
  // la línea de espalda del cuello se separa del quiebre hacia el lado del hombro
  const haciaHombro = dir(snp, v(del, "hombro"));
  let dCB = rotar(u, P(0, 0), caida);
  if ((dCB.x - u.x) * haciaHombro.x + (dCB.y - u.y) * haciaHombro.y < 0) dCB = rotar(u, P(0, 0), -caida);
  const Cn = suma(snp, escalar(dCB, b.NB));
  let nCB = perp(dCB);
  if (nCB.x * haciaHombro.x + nCB.y * haciaHombro.y < 0) nCB = escalar(nCB, -1);
  // el cuello es una banda que sale de su borde de cuello hacia el lado del hombro:
  // 4 cm de ancho en la punta y 7.5 cm (3 de pie + 4.5 de caída) en el centro espalda
  const bordeCuello = [Q, N, ...tramoN.slice(1, -1), snp, Cn];
  const nb = bordeCuello.length;
  const anchoEn = (k: number) => 4 + (3.5 * k) / (nb - 1);
  let exterior = desplazarAbierta(bordeCuello, anchoEn);
  if ((exterior[nb - 1].x - Cn.x) * nCB.x + (exterior[nb - 1].y - Cn.y) * nCB.y < 0) exterior = desplazarAbierta(bordeCuello, (k) => -anchoEn(k));
  exterior = quitarBucles(exterior);
  const Ct = exterior[exterior.length - 1];
  const contCuello: V[] = [
    { ...Q, n: "punta" },
    { ...N, n: "escotadura" },
    ...tramoN.slice(1, -1).map((p) => ({ ...p })),
    { ...snp, n: "hombro" },
    { ...Cn, n: "cbCuello" },
    { ...Ct, n: "cbArriba" },
    ...[...exterior].reverse().slice(1, -1).map((p) => ({ ...p })),
    { ...exterior[0], n: "puntaCuello" },
  ];
  const cuello = crear("Cuello sastre", contCuello, { cortar: "Cortar 1 al doblez en tela (cuello) y 2 al bies (bajo cuello, con costura al centro) + entretela" });
  doblezBorde(cuello, "cbCuello", "cbArriba");
  piquete(cuello, "escotadura");
  piquete(cuello, "hombro");
  cuello.hilo = [suma(Cn, escalar(nCB, 2)), suma(suma(Cn, escalar(nCB, 2)), escalar(dCB, -6))];
  return [b.espalda, del, vista, cuello, b.manga];
}

/** Escote del delantero desde la escotadura hasta el cuello del hombro (ya recortado el escote). */
function tramoHastaHombro(del: Pieza): Pt[] {
  const [a, z] = corto(del, "escotadura", "cuelloHombro");
  const t = tramoPts(del, a, z);
  return a === "escotadura" ? t : t.reverse();
}

function tramoPts(pz: Pieza, a: string, z: string): Pt[] {
  const ia = pz.contorno.findIndex((q) => q.n === a);
  const iz = pz.contorno.findIndex((q) => q.n === z);
  const r: Pt[] = [];
  for (let k = ia; ; k = (k + 1) % pz.contorno.length) {
    r.push({ x: pz.contorno[k].x, y: pz.contorno[k].y });
    if (k === iz) break;
  }
  return r;
}

/** Botones y ojales sobre el centro delantero a partir de una altura (para solapas, donde ya no hay escote al centro). */
function botonesDesde(pz: Pieza, yInicio: number, n: number, sep: number) {
  const xCF = v(pz, "centroBajo").x;
  const fuera = Math.sign(v(pz, "frenteBajo").x - xCF) || 1;
  for (let k = 0; k < n; k++) {
    const y = yInicio - k * sep;
    pz.marcas.push({ t: "boton", p: P(xCF, y), r: 0.75 });
    pz.marcas.push({ t: "ojal", p: P(xCF + fuera * 0.3 - fuera * 0.9, y), ang: 0, l: 1.8 });
  }
}

function indiceMasCercano(pts: Pt[], q: Pt): number {
  let mejor = 0;
  let d = Infinity;
  pts.forEach((p, k) => {
    const dd = dist(p, q);
    if (dd < d) {
      d = dd;
      mejor = k;
    }
  });
  return mejor;
}

/** Cuello chal: cortado en una pieza con el delantero (y con la vista), costura al centro espalda. */
function chal(m: Medidas): Pieza[] {
  const b = blusa(m, { cruce: 2, vistaDelantera: false });
  const del = b.delantero;
  const yB = b.lineaBusto - 1;
  const frente = v(del, "frenteBajo").x;
  const B = P(frente, yB);
  const snp = { ...v(del, "cuelloHombro") };
  const R = suma(snp, escalar(unitario(resta(snp, v(del, "hombro"))), 2));
  const u = dir(B, R);
  const Lr = dist(B, R);
  let nL = perp(u);
  if (nL.x < 0) nL = escalar(nL, -1);
  // línea de cuello de espalda desde el hombro, paralela al quiebre y separada 2.5 cm en el centro
  const caida = Math.atan2(2.5, b.NB);
  let dCB = rotar(u, P(0, 0), caida);
  if ((dCB.x - u.x) * nL.x + (dCB.y - u.y) * nL.y > 0) dCB = rotar(u, P(0, 0), -caida);
  const Cn = suma(snp, escalar(dCB, b.NB));
  let nCB = perp(dCB);
  if (nCB.x * nL.x + nCB.y * nL.y < 0) nCB = escalar(nCB, -1);
  const ancho = 8;
  const Ct = suma(Cn, escalar(nCB, ancho));
  const W1 = suma(suma(B, escalar(u, Lr * 0.35)), escalar(nL, ancho * 0.75));
  const W2 = suma(suma(B, escalar(u, Lr * 0.8)), escalar(nL, ancho + 0.5));
  const borde = spline([B, W1, W2, Ct], 14);
  const bb = insertar(del, "quiebre", B);
  const [a] = corto(del, bb, "cuelloHombro");
  const linea = [...borde, Cn, snp];
  reemplazar(del, a, a === bb ? "cuelloHombro" : bb, a === bb ? linea : [...linea].reverse());
  // nombres en el centro espalda del cuello
  nombrarCerca(del, Cn, "cbCuello");
  nombrarCerca(del, Ct, "cbArriba");
  margen(del, ...corto(del, "cbCuello", "cbArriba"), 1);
  del.marcas.push({ t: "linea", pts: [B, R], estilo: "doblez" });
  del.marcas.push({ t: "texto", p: suma(suma(B, escalar(u, Lr * 0.45)), escalar(nL, 1)), s: "línea de quiebre", h: 0.7 });
  piquete(del, bb);
  piquete(del, "cuelloHombro");
  botonesDesde(del, yB, 3, 9);
  del.cortar = "Cortar 2 en tela (un par); el cuello se une en el centro espalda";
  // vista: borde delantero + chal + centro espalda + línea de cuello, y por dentro 8 cm
  const fb = v(del, "frenteBajo");
  const interior = curva(suma(snp, escalar(dir(snp, v(del, "hombro")), 3)), perp(dir(snp, v(del, "hombro"))).y < 0 ? perp(dir(snp, v(del, "hombro"))) : escalar(perp(dir(snp, v(del, "hombro"))), -1), P(fb.x - 9, yB - 4), P(0, -1), 0.45, 0.45, 24);
  const contVista: V[] = [
    { ...fb, n: "bajoFrente" },
    { ...B, n: "quiebre" },
    ...borde.slice(1, -1).map((p) => ({ ...p })),
    { ...Ct, n: "cbArriba" },
    { ...Cn, n: "cbCuello" },
    { ...snp, n: "cuelloHombro" },
    ...interior.map((p) => ({ ...p })),
    { x: fb.x - 9, y: fb.y, n: "bajoInterior" },
  ];
  const vista = crear("Vista con cuello chal", contVista, { cortar: "Cortar 2 en tela (un par) y 2 en entretela; unir en el centro espalda" });
  margen(vista, ...corto(vista, "bajoFrente", "bajoInterior"), 2);
  vista.hilo = [P(fb.x - 4.5, fb.y + 8), P(fb.x - 4.5, yB - 6)];
  return [b.espalda, del, vista, b.manga];
}

function nombrarCerca(pz: Pieza, p: Pt, n: string) {
  const k = indiceMasCercano(pz.contorno, p);
  pz.contorno[k].n = n;
}

/** Cuello marinero: escote en V adelante y cuello plano cuadrado en la espalda. */
function marinero(m: Medidas): Pieza[] {
  const b0 = blusaBase(m);
  const del = b0.delantero;
  const esp = b0.espalda;
  const bp = b0.cuerpo.ref.bp;
  cambiarEscote(del, 1, v(del, "centroCuello").y - (bp.y + 6), curvaV(0.12));
  cambiarEscote(esp, 1, 0.5, curvaRedonda(0.5, 0.45));
  for (const pz of [del, esp]) {
    piquete(pz, "cuelloHombro");
    piquete(pz, "centroCuello");
  }
  pinzasBajoBorde(del);
  const u = escotesUnidos(del, esp, 2);
  const fondo = 20;
  const cbBajo = suma(u.cbCuello, escalar(u.haciaAbajo, fondo));
  // lado hacia el hombro: perpendicular al centro espalda, del lado contrario al delantero
  let lado = perp(u.haciaAbajo);
  const cf = u.linea[0];
  if ((cf.x - u.cbCuello.x) * lado.x + (cf.y - u.cbCuello.y) * lado.y < 0) lado = escalar(lado, -1);
  const anchoAtras = u.NB + 10;
  const K = suma(cbBajo, escalar(lado, anchoAtras));
  // sobre el hombro, 9 cm desde el cuello
  const snp = v(del, "cuelloHombro");
  const X = suma(snp, escalar(dir(snp, v(del, "hombro")), 9));
  const exterior = [K, X, cf];
  const cont: V[] = [
    { ...cf, n: "cfCuello" },
    ...u.linea.slice(1, -1).map((p) => ({ ...p })),
    { ...u.cbCuello, n: "cbCuello" },
    { ...cbBajo, n: "cbBajo" },
    ...exterior.slice(0, -1).map((p) => ({ ...p })),
  ];
  const cuello = crear("Cuello marinero", cont, { cortar: "Cortar 2 al doblez en tela y 1 en entretela" });
  doblezBorde(cuello, "cbCuello", "cbBajo");
  piquete(cuello, enLongitud(u.linea, u.NF).p);
  cuello.hilo = [suma(cbBajo, escalar(u.haciaAbajo, -4)), suma(u.cbCuello, escalar(u.haciaAbajo, 4))].map((p) => suma(p, escalar(lado, 3))) as [Pt, Pt];
  return [esp, del, vistaEscote(esp, "Vista de escote espalda", 5), vistaEscote(del, "Vista de escote delantero", 5), cuello, b0.manga];
}

/** Cuello alto (tortuga o cuello vuelto): banda doblada al centro, cierre en la espalda. */
function alto(m: Medidas): Pieza[] {
  const b = blusa(m, { abrir: 1, bajarD: 1, bajarE: 0.5 });
  // espalda con cierre al centro
  const esp = b.espalda;
  const [a, z] = corto(esp, "centroCuello", "centroBajo");
  for (const q of esp.contorno) q.d = false;
  margen(esp, a, z, 1.5);
  esp.cortar = "Cortar 2 en tela (cierre de 40 cm al centro espalda)";
  const total = 2 * (b.NB + b.NF);
  const alto = 7;
  const bandaPz = rectangulo("Cuello alto (banda doblada)", total, 2 * alto, "Cortar 1 en tela (en tejido de punto: 90% del largo)", { dobladoAlCentro: true });
  for (const x of [b.NB, b.NB + b.NF, b.NB + 2 * b.NF]) piquete(bandaPz, P(x, 0));
  return [esp, b.delantero, vistaEscote(b.delantero, "Vista de escote delantero", 5), bandaPz, b.manga];
}

/** Cuello con lazo: tira que rodea el escote y se anuda al frente. */
function lazo(m: Medidas): Pieza[] {
  const b = blusa(m, { abrir: 1, bajarD: 1.5 });
  aberturaEspalda(b.espalda, 10);
  // abertura al centro delantero para el lazo
  const c = v(b.delantero, "centroCuello");
  b.delantero.marcas.push({ t: "linea", pts: [c, P(c.x, c.y - 8)], estilo: "colocacion" });
  b.delantero.marcas.push({ t: "texto", p: P(c.x - 2.2, c.y - 4), s: "abertura 8 cm", h: 0.7 });
  const lazoLargo = 55;
  const mitad = b.NB + b.NF + lazoLargo;
  const ancho = 7.5;
  // media tira (se unen en el centro espalda); la punta del lazo cortada al sesgo
  const cont: V[] = [
    { x: 0, y: 0, n: "cbCuello" },
    { x: mitad, y: 0, n: "punta" },
    { x: mitad - 4, y: 2 * ancho, n: "puntaArriba" },
    { x: 0, y: 2 * ancho, n: "cbArriba" },
  ];
  const tira = crear("Lazo (media tira)", cont, { cortar: "Cortar 2 en tela (unir en el centro espalda)" });
  tira.marcas.push({ t: "linea", pts: [P(0, ancho), P(mitad - 2, ancho)], estilo: "doblez" });
  tira.hilo = [P(mitad * 0.25, ancho / 2), P(mitad * 0.75, ancho / 2)];
  for (const x of [b.NB, b.NB + b.NF]) piquete(tira, P(x, 0));
  return [b.espalda, b.delantero, vistaEscote(b.espalda, "Vista de escote espalda", 5), tira, b.manga];
}

/** Cuello de volante circular sobre escote redondo, con abertura atrás. */
function volante(m: Medidas): Pieza[] {
  const b = blusa(m, { abrir: 0.5 });
  aberturaEspalda(b.espalda, 12);
  const total = 2 * (b.NB + b.NF);
  const grados = 358;
  const radio = total / ((grados * Math.PI) / 180);
  const ancho = 7;
  const anilloPz = anillo("Cuello de volante", radio, ancho, grados, "Cortar 2 en tela (volante y forro) o 1 con orilla en rollito");
  // piquetes: hombros y centro delantero (el corte queda en el centro espalda)
  const ang = (d: number) => d / radio;
  for (const d of [b.NB, b.NB + b.NF, b.NB + 2 * b.NF]) piquete(anilloPz, P(radio * Math.cos(ang(d)), radio * Math.sin(ang(d))));
  return [b.espalda, b.delantero, vistaEscote(b.espalda, "Vista de escote espalda", 5), vistaEscote(b.delantero, "Vista de escote delantero", 5), anilloPz, b.manga];
}

// ── Modelos ─────────────────────────────────────────────────────────────────

const MEDIDA = "Mide el escote ya cosido: espalda (centro a hombro) + delantero (hombro a centro). El borde de cuello debe medir lo mismo.";

export const CUELLOS: Modelo[] = [
  {
    id: "cuello-mao",
    categoria: "cuellos",
    nombre: "Cuello mao (mandarín)",
    descripcion: "Banda recta de 3.5 cm que sube pegada al cuello, con botón al frente.",
    pasos: [
      MEDIDA,
      "Traza el borde de cuello: recto la medida de espalda y luego curvo, subiendo 1.5 cm en el frente; agrega el cruce de botones.",
      "Sube 3.5 cm en el centro espalda y 3 cm en el frente, paralelo al borde de cuello.",
      "Redondea la esquina del frente y marca piquetes en el hombro y en el centro delantero.",
    ],
    generar: mao,
  },
  {
    id: "cuello-camisero",
    categoria: "cuellos",
    nombre: "Cuello camisero (con pie de cuello)",
    descripcion: "El cuello de camisa: un pie de cuello con botón y un cuello con puntas que dobla sobre él.",
    pasos: [
      MEDIDA,
      "Pie de cuello: borde recto en la espalda y curvo al frente, subiendo 2 cm; 3 cm de alto; llega hasta el cruce y se redondea.",
      "Cuello: su borde de abajo mide el borde de arriba del pie hasta el centro delantero; baja 1.2 cm al frente (al revés del pie).",
      "Alto del cuello: 4.5 cm en el centro espalda; la punta sale 1.6 cm hacia afuera.",
    ],
    generar: camisero,
  },
  {
    id: "cuello-sport",
    categoria: "cuellos",
    nombre: "Cuello sport (convertible)",
    descripcion: "Cuello de una pieza que se puede usar abotonado o abierto formando pequeñas solapas.",
    pasos: [
      MEDIDA,
      "Borde de cuello recto en la espalda y con 0.8 cm de subida al frente, hasta el centro delantero.",
      "Alto 7.5 cm parejo; la punta sale 2.5 cm.",
      "Marca la línea de quiebre a 3 cm del borde de cuello. La vista delantera forma las solapas al abrir.",
    ],
    generar: sport,
  },
  {
    id: "cuello-peter-pan",
    categoria: "cuellos",
    nombre: "Cuello bebé (Peter Pan)",
    descripcion: "Cuello plano y redondeado que descansa sobre los hombros.",
    pasos: [
      "Junta el delantero y la espalda por el hombro, con los puntos de cuello unidos y las puntas de hombro traslapadas 1.5 cm.",
      "Calca el escote del centro delantero al centro espalda: ése es el borde de cuello.",
      "Traza el borde exterior a 7 cm del escote y redondea la esquina del frente.",
      "El centro espalda va al doblez.",
    ],
    generar: peterPan,
  },
  {
    id: "cuello-solapa",
    categoria: "cuellos",
    nombre: "Cuello sastre (con solapa)",
    descripcion: "El cuello de saco: solapa que dobla sobre el pecho y cuello separado con muesca.",
    pasos: [
      "Agrega 2 cm de cruce y marca el punto de quiebre en el borde delantero, 1 cm abajo de la línea de busto.",
      "Prolonga el hombro 2 cm hacia el cuello: la línea de quiebre va de ese punto al punto de quiebre.",
      "Dibuja la solapa del otro lado de la línea de quiebre (8.5 cm de ancho); la muesca va al 70% del quiebre, a 4 cm de la línea, y de ahí la escotadura sube al 45% del escote.",
      "Cuello: desde el punto de cuello traza la medida de espalda paralela al quiebre, separándola 2.5 cm en el centro; 7.5 cm de ancho (3 de pie y 4.5 de caída).",
      "La punta del cuello forma la muesca con la solapa.",
    ],
    generar: solapa,
  },
  {
    id: "cuello-chal",
    categoria: "cuellos",
    nombre: "Cuello chal",
    descripcion: "Solapa y cuello en una sola pieza con el delantero, sin muesca, con costura al centro espalda.",
    pasos: [
      "Agrega 2 cm de cruce y marca el punto de quiebre 1 cm abajo de la línea de busto.",
      "Línea de quiebre del punto de quiebre a 2 cm más allá del cuello sobre la línea del hombro.",
      "Desde el punto de cuello traza la medida de espalda paralela al quiebre, separada 2.5 cm en el centro espalda; escuadra 8 cm.",
      "Une con una curva continua del punto de quiebre al centro espalda del cuello.",
      "La vista lleva la misma forma; delantero y vista se unen en el centro espalda.",
    ],
    generar: chal,
  },
  {
    id: "cuello-marinero",
    categoria: "cuellos",
    nombre: "Cuello marinero",
    descripcion: "Escote en V al frente y un cuello plano que cae cuadrado sobre la espalda.",
    pasos: [
      "Baja el escote delantero en V hasta 6 cm arriba del punto de busto.",
      "Junta delantero y espalda por el hombro traslapando 2 cm en la punta.",
      "En la espalda baja 20 cm por el centro y escuadra hacia el hombro (ancho de escote + 10 cm).",
      "Une esa esquina con un punto a 9 cm del cuello sobre el hombro y de ahí al fondo de la V.",
    ],
    generar: marinero,
  },
  {
    id: "cuello-alto",
    categoria: "cuellos",
    nombre: "Cuello alto (tortuga)",
    descripcion: "Banda doblada que sube por el cuello. En tela plana lleva cierre atrás; en punto, 10% más corta y sin cierre.",
    pasos: [
      "Abre el escote 1 cm en el hombro y bájalo 1 cm adelante y 0.5 cm atrás para que no apriete.",
      "Banda: largo del escote completo × 14 cm (7 cm doblada).",
      "Espalda con costura y cierre al centro.",
    ],
    generar: alto,
  },
  {
    id: "cuello-lazo",
    categoria: "cuellos",
    nombre: "Cuello con lazo",
    descripcion: "Tira que rodea el escote y se anuda en moño al frente, sobre una pequeña abertura.",
    pasos: [
      "Abre el escote 1 cm y bájalo 1.5 cm adelante. Marca una abertura de 8 cm al centro delantero.",
      "Tira: medio escote + 55 cm de lazo, por 15 cm de ancho (se dobla a la mitad).",
      "Corta dos medias tiras y únelas en el centro espalda; la punta del lazo va al sesgo.",
      "Abertura con botón en el centro espalda.",
    ],
    generar: lazo,
  },
  {
    id: "cuello-volante",
    categoria: "cuellos",
    nombre: "Cuello de volante",
    descripcion: "Volante circular que cae en ondas alrededor del escote.",
    pasos: [
      "Mide el escote completo y calcula el radio: escote ÷ 2π.",
      "Traza el círculo interior con ese radio y el exterior 7 cm más grande.",
      "Abre el círculo en el centro espalda y marca piquetes de hombros y centro delantero.",
      "Abertura con botón en el centro espalda.",
    ],
    generar: volante,
  },
];

export { hacia, interseccion, lineaCentro };
