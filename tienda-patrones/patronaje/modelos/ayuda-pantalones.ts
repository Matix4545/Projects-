// Herramientas para transformar el pantalón base: cambiar la pierna, la cintura
// (elástica), el tiro (caído), y trazar pretinas, braguetas y bolsillos.
//
// El pantalón base tiene el delantero con el costado a la izquierda (x≈0) y el
// centro a la derecha; la espalda está reflejada (centro a la izquierda). Para
// trabajar igual con las dos piezas, el contorno se separa en tres partes,
// siempre en el orden del delantero:
//   arriba     centroCadera → centroCintura → … cintura … → costadoCintura → cadera
//   pierna     cadera → costado → bajo → entrepierna → tiro
//   tiroCurva  tiro → curva del tiro → centroCadera
import { type Pt, P, curva, dir, dist, escalar, interseccion, lerp, longitud, perp, suma } from "../geometria.ts";
import type { Medidas } from "../medidas.ts";
import {
  type Pieza,
  type V,
  clonar,
  corto,
  crear,
  doblezBorde,
  insertar,
  largoTramo,
  margenBorde,
  orientar,
  piquete,
  tiene,
  tramo,
  v,
} from "../pieza.ts";
import { anillo, rectangulo } from "../bases/utiles.ts";

export type Partes = { arriba: V[]; pierna: V[]; tiroCurva: V[]; frente: boolean; s: number };

/** Invierte una lista de vértices conservando el margen de cada tramo. */
export function invertir(l: V[]): V[] {
  const L = l.length;
  return l.map((_, j) => {
    const o = l[L - 1 - j];
    const ant = l[L - 2 - j];
    return { ...o, m: ant?.m, d: ant?.d };
  });
}

export function partes(pz: Pieza): Partes {
  const prueba = tramo(pz, "centroCadera", "cadera");
  const frente = prueba.some((q) => q.n === "centroCintura");
  const s = Math.sign(v(pz, "tiro").x - v(pz, "cadera").x) || 1;
  if (frente) {
    return {
      arriba: tramo(pz, "centroCadera", "cadera"),
      pierna: tramo(pz, "cadera", "tiro"),
      tiroCurva: tramo(pz, "tiro", "centroCadera"),
      frente,
      s,
    };
  }
  return {
    arriba: invertir(tramo(pz, "cadera", "centroCadera")),
    pierna: invertir(tramo(pz, "tiro", "cadera")),
    tiroCurva: invertir(tramo(pz, "centroCadera", "tiro")),
    frente,
    s,
  };
}

/** Vuelve a armar el contorno de la pieza a partir de sus partes. */
export function armar(pz: Pieza, p: Partes): Pieza {
  const r = clonar(pz);
  const sinUlt = (l: V[]) => l.slice(0, -1);
  r.contorno = p.frente
    ? [...sinUlt(p.arriba), ...sinUlt(p.pierna), ...sinUlt(p.tiroCurva)]
    : [...sinUlt(invertir(p.arriba)), ...sinUlt(invertir(p.tiroCurva)), ...sinUlt(invertir(p.pierna))];
  // quita pinzas cuyos vértices ya no existen
  const nombres = new Set(r.contorno.map((q) => q.n));
  r.pinzas = r.pinzas.filter((q) => nombres.has(q.a) && nombres.has(q.b) && nombres.has(q.apice));
  return orientar(r);
}

export type Pierna = {
  /** Altura de la bastilla (negativa, la cintura es y = 0). */
  yBajo: number;
  /** x del costado y de la entrepierna en la bastilla. */
  bajo: { lado: number; entre: number };
  /** Punto de rodilla opcional (con curva del muslo, como el pantalón base). */
  rodilla?: { y: number; lado: number; entre: number };
  /** Altura del tiro nuevo (para tiro caído). */
  tiro?: Pt;
};

/** Cambia la pierna (largo, ancho, forma) conservando cintura, cadera y tiro. */
export function cambiarPierna(pz: Pieza, o: Pierna): Pieza {
  const p = partes(pz);
  const C = p.arriba[p.arriba.length - 1]; // cadera
  const T = o.tiro ?? p.pierna[p.pierna.length - 1];
  const lado: V[] = [];
  const entre: V[] = [];
  const hl = P(o.bajo.lado, o.yBajo);
  const he = P(o.bajo.entre, o.yBajo);
  if (o.rodilla) {
    const kl = P(o.rodilla.lado, o.rodilla.y);
    const ke = P(o.rodilla.entre, o.rodilla.y);
    const tiroY = T.y;
    const cl = curva(C, P(0, -1), kl, dir(P(C.x, tiroY), kl), 0.4, 0.4);
    lado.push(...cl.slice(1, -1), { ...kl, n: "costadoRodilla" });
    const ce = curva(T, dir(T, ke), ke, P(0, -1), 0.35, 0.4);
    entre.push({ ...ke, n: "entrepiernaRodilla" }, ...[...ce].reverse().slice(1, -1));
  }
  p.pierna = [
    { ...C, n: "cadera", m: undefined, d: false },
    ...lado,
    { ...hl, n: "costadoBajo" },
    { ...he, n: "entrepiernaBajo" },
    ...entre,
    { ...T, n: "tiro" },
  ];
  if (o.tiro) {
    // nueva curva de tiro hasta el tiro caído
    const cc = p.tiroCurva[p.tiroCurva.length - 1];
    const sig = p.tiroCurva[p.tiroCurva.length - 2];
    const salida = dir(cc, sig); // dirección con que la curva vieja salía del centro
    const nueva = curva(cc, salida, T, P(p.s, 0), 0.6, 0.5);
    p.tiroCurva = [{ ...T, n: "tiro" }, ...[...nueva].reverse().slice(1, -1), { ...cc }];
  }
  const r = armar(pz, p);
  margenBorde(r, "costadoBajo", "entrepiernaBajo", 3);
  if (o.rodilla) {
    piquete(r, "costadoRodilla");
    piquete(r, "entrepiernaRodilla");
  }
  return r;
}

/** Vuelve a trazar la raya (línea de planchado) y el hilo hasta la nueva bastilla. */
export function raya(pz: Pieza, x: number, yArriba: number, yBajo: number): void {
  pz.marcas = pz.marcas.filter((m) => !(m.t === "linea" && m.estilo === "pliegue"));
  pz.marcas.push({ t: "linea", pts: [P(x, yArriba), P(x, yBajo)], estilo: "pliegue" });
  const largo = yArriba - yBajo;
  pz.hilo = [P(x, yArriba - Math.min(3, largo * 0.1)), P(x, yBajo + Math.min(10, largo * 0.15))];
}

/**
 * Cintura para elástico (sin pinzas): el costado sube recto desde la cadera y el
 * centro también, para que la pretina pase por la cadera al ponerse.
 */
export function cinturaElastica(pz: Pieza, o: { yLado?: number; yCentro?: number } = {}): Pieza {
  const p = partes(pz);
  const cc = p.arriba[0];
  const C = p.arriba[p.arriba.length - 1];
  const viejoCentro = p.arriba.find((q) => q.n === "centroCintura")!;
  const yLado = o.yLado ?? 0.6;
  const yCentro = o.yCentro ?? viejoCentro.y;
  // el centro sube recto desde el punto del centro a la altura de cadera
  let centroCadera: Pt = P(cc.x, C.y);
  const interseca = interseccion(cc, viejoCentro, P(0, C.y), P(1, C.y));
  if (interseca && Math.abs(cc.x - viejoCentro.x) > 0.01) centroCadera = interseca;
  const arriba: V[] = [{ ...cc, m: undefined }];
  if (dist(centroCadera, cc) > 0.3 && Math.abs(centroCadera.x - cc.x) > 0.05) arriba.push({ ...centroCadera });
  arriba.push({ x: centroCadera.x, y: yCentro, n: "centroCintura" }, { x: C.x, y: yLado, n: "costadoCintura" }, { ...C, n: "cadera" });
  p.arriba = arriba;
  const r = armar(pz, p);
  r.pinzas = [];
  return r;
}

/**
 * Media pretina recta doblada a lo largo (se cortan dos y se unen en el centro
 * espalda), con piquetes en el centro delantero, el costado y el centro espalda.
 * Así cabe en el rollo del plotter aun en tallas grandes.
 */
export function pretina(largoDelantero: number, largoEspalda: number, alto = 4, cruce = 3.5, nombre = "Pretina"): Pieza {
  const total = cruce + largoDelantero + largoEspalda;
  const r = rectangulo(nombre, total, alto * 2, "Cortar 2 en tela (un par) y 2 en entretela", { dobladoAlCentro: true });
  // piquetes: fin del cruce (centro delantero) | costado
  for (const x of [cruce, cruce + largoDelantero]) piquete(r, P(x, 0));
  r.marcas.push({ t: "texto", p: P(cruce / 2 + 0.2, alto * 1.5), s: "cruce", h: 0.6 });
  r.marcas.push({ t: "texto", p: P(total - 3, alto * 1.5), s: "centro espalda", h: 0.6 });
  r.marcas.push({ t: "ojal", p: P(1.6, alto / 2), ang: 0, l: 2 });
  r.marcas.push({ t: "texto", p: P(total / 2, alto * 0.5), s: "el cruce y el ojal solo en la pieza del lado izquierdo", h: 0.5 });
  return r;
}

/** Media pretina elástica (delantera o trasera), unida en los costados; ojales para el cordón en la delantera. */
export function pretinaElastica(contorno: number, anchoElastico = 4, cordon = true): Pieza {
  const alto = 2 * (anchoElastico + 0.6);
  const largo = contorno / 2;
  const r = rectangulo("Pretina elástica", largo, alto, "Cortar 2 en tela (delantera y trasera)", { dobladoAlCentro: true });
  piquete(r, P(largo / 2, 0));
  if (cordon) {
    const x = largo / 2;
    r.marcas.push({ t: "ojal", p: P(x - 1.5, alto * 0.72), ang: Math.PI / 2, l: 1.4 }, { t: "ojal", p: P(x + 1.5, alto * 0.72), ang: Math.PI / 2, l: 1.4 });
    r.marcas.push({ t: "texto", p: P(x, alto * 0.88), s: "ojales solo en la delantera", h: 0.5 });
  }
  r.marcas.push({ t: "texto", p: P(largo / 2, alto * 0.25), s: `elástico de ${anchoElastico} cm: cintura - 5 cm`, h: 0.6 });
  return r;
}

/**
 * Pretina alta en curva (cono): la orilla de abajo mide la cintura y la de arriba
 * se abre `abre` cm por pieza para seguir la forma del cuerpo arriba de la cintura.
 */
export function pretinaCurva(nombre: string, largo: number, alto: number, abre: number, alDoblez: boolean): Pieza {
  const radio = (largo * alto) / abre;
  const grados = ((largo / radio) * 180) / Math.PI;
  let r = anillo(nombre, radio, alto, grados, alDoblez ? "Cortar 2 al doblez en tela y 1 en entretela" : "Cortar 4 en tela y 2 en entretela");
  // gira el arco para que quede horizontal
  const ang = Math.PI / 2 - (grados * Math.PI) / 360;
  r = { ...r, contorno: r.contorno.map((q) => ({ ...q, x: q.x * Math.cos(ang) - q.y * Math.sin(ang), y: q.x * Math.sin(ang) + q.y * Math.cos(ang) })) };
  r.hilo = r.hilo ? (r.hilo.map((q) => P(q.x * Math.cos(ang) - q.y * Math.sin(ang), q.x * Math.sin(ang) + q.y * Math.cos(ang))) as [Pt, Pt]) : null;
  if (alDoblez) doblezBorde(r, "centroIni", "bordeIni");
  return orientar(r);
}

/** Largo de la cintura terminada (con pinzas cerradas) de delantero y espalda. */
export function cinturas(d: Pieza, e: Pieza): { d: number; e: number } {
  const med = (pz: Pieza) => {
    const a = largoTramo(pz, "centroCintura", "costadoCintura");
    const b = largoTramo(pz, "costadoCintura", "centroCintura");
    return Math.min(a, b);
  };
  return { d: med(d), e: med(e) };
}

/**
 * Vista y pie de bragueta para cierre de 18 cm (delantero con el centro a la derecha).
 * Marca en el delantero el pespunte en J.
 */
export function bragueta(d: Pieza, largoCierre = 18): Pieza[] {
  const cc = v(d, "centroCintura");
  const ch = v(d, "centroCadera");
  const u = dir(cc, ch); // hacia abajo por el centro
  const n = escalar(perp(u), -1); // hacia el costado (adentro de la pieza)
  const L = Math.min(largoCierre + 1.5, dist(cc, ch) - 0.5);
  const fin = suma(cc, escalar(u, L));
  const ancho = 4;
  const q0 = suma(cc, escalar(n, ancho));
  const q1 = suma(q0, escalar(u, L - ancho));
  const curvaJ = curva(q1, u, fin, escalar(n, -1), 0.55, 0.55);
  // pespunte en J sobre el delantero
  const j0 = suma(cc, escalar(n, ancho - 0.5));
  const j1 = suma(j0, escalar(u, L - ancho));
  d.marcas.push({ t: "linea", pts: [j0, ...curva(j1, u, suma(fin, escalar(u, -0.3)), escalar(n, -1), 0.55, 0.55)], estilo: "costura" });
  d.marcas.push({ t: "texto", p: suma(suma(cc, escalar(n, 2)), escalar(u, L + 2)), s: "fin del cierre", h: 0.6 });
  piquete(d, fin);
  const vistaB = crear(
    "Vista de bragueta",
    [{ ...cc, n: "arriba" }, { ...fin, n: "abajo" }, ...[...curvaJ].reverse().slice(1, -1), { ...q1 }, { ...q0, n: "arribaAdentro" }],
    { cortar: "Cortar 1 en tela y 1 en entretela" },
  );
  vistaB.hilo = [suma(suma(cc, escalar(n, 2)), escalar(u, 3)), suma(suma(cc, escalar(n, 2)), escalar(u, L - 5))];
  const pie = rectangulo("Pie de bragueta", 7, L + 1.5, "Cortar 1 en tela (doblado a lo largo)");
  pie.marcas.push({ t: "linea", pts: [P(3.5, 0), P(3.5, L + 1.5)], estilo: "doblez" });
  pie.hilo = [P(1.8, 3), P(1.8, L - 2)];
  return [vistaB, pie];
}

/** Punto del contorno sobre el tramo desde→hasta a la altura y (por interpolación). */
export function puntoEnAltura(pz: Pieza, desde: string, hasta: string, y: number): Pt {
  const t = tramo(pz, desde, hasta);
  for (let k = 1; k < t.length; k++) {
    const a = t[k - 1];
    const b = t[k];
    if ((a.y - y) * (b.y - y) <= 0 && a.y !== b.y) return lerp(a, b, (y - a.y) / (b.y - a.y));
  }
  return t[t.length - 1];
}

/**
 * Bolsillo sesgado delantero: recorta la esquina del delantero y devuelve la
 * bolsa (forro) y el costadillo (tela).
 */
export function bolsilloSesgado(d: Pieza, o: { ancho?: number; bajada?: number; fondo?: number } = {}): { delantero: Pieza; bolsa: Pieza; costadillo: Pieza } {
  const ancho = o.ancho ?? 4;
  const bajada = o.bajada ?? 17;
  const fondo = o.fondo ?? 26;
  const kc = v(d, "costadoCintura");
  const cc = v(d, "centroCintura");
  const s = Math.sign(cc.x - kc.x) || 1;
  const yW = kc.y;
  // puntos sobre el costado (de la cintura a la cadera y más abajo)
  const costado = (y: number) => {
    const desde = tiene(d, "costadoRodilla") ? "costadoRodilla" : "costadoBajo";
    // el costado va de costadoCintura → cadera → abajo en el delantero
    return puntoEnAltura(d, "costadoCintura", desde, y);
  };
  const A = P(kc.x + s * ancho, yW - 0.05 * ancho);
  const B = costado(yW - bajada);
  const r = clonar(d);
  const nA = insertar(r, "bolsilloA", A);
  const nB = insertar(r, "bolsilloB", B);
  // contorno nuevo: se quita la esquina costadoCintura (entre A y B) y se une A→B en curva suave
  const ia = r.contorno.findIndex((q) => q.n === nA);
  const ib = r.contorno.findIndex((q) => q.n === nB);
  const corte = curva(r.contorno[ia], dir(r.contorno[ia], B), r.contorno[ib], P(0, -1), 0.3, 0.25);
  const nuevo: V[] = [];
  const N = r.contorno.length;
  for (let k = 0; k < N; k++) {
    // el tramo A → … → B (hacia adelante) es la esquina que se quita
    const dentroEsquina = ia < ib ? k > ia && k < ib : k > ia || k < ib;
    if (dentroEsquina) continue;
    nuevo.push(r.contorno[k]);
    if (k === ia) nuevo.push(...corte.slice(1, -1).map((p) => ({ ...p })));
  }
  r.contorno = nuevo;
  r.marcas.push({ t: "texto", p: suma(lerp(A, B, 0.5), P(s * 2.5, 0)), s: "boca de bolsillo", h: 0.6 });
  // costadillo y bolsa: siguen el costado hasta el fondo
  const lado = tramo(d, "costadoCintura", tiene(d, "costadoRodilla") ? "costadoRodilla" : "costadoBajo").filter((q) => q.y >= yW - fondo);
  const fondoLado = costado(yW - fondo);
  const piezaBolsa = (nombre: string, xDentro: number, prof: number, cortar: string) => {
    const xIn = kc.x + s * xDentro;
    const abajoLado = costado(yW - prof);
    const curvaFondo = curva(abajoLado, P(s, -0.3), P(xIn, yW - prof + 3), P(0, 1), 0.5, 0.5);
    const arriba = lado.filter((q) => q.y > abajoLado.y).map((q) => ({ x: q.x, y: q.y }) as V);
    arriba[0].n = "costadoCintura";
    // la boca del bolsillo toca el costado en B: se marca para casar con el delantero
    const iB = arriba.findIndex((q) => q.y < B.y);
    if (iB > 0) arriba.splice(iB, 0, { ...B, n: "bolsilloB" });
    const pts: V[] = [
      ...arriba,
      { ...abajoLado },
      ...curvaFondo.slice(1).map((q) => ({ ...q })),
      { x: xIn, y: cc.y + (kc.y - cc.y) * (1 - (xIn - kc.x) / (cc.x - kc.x)) },
    ];
    const pz = crear(nombre, pts, { cortar });
    pz.hilo = [P(xIn - s * 3, yW - 4), P(xIn - s * 3, yW - prof + 6)];
    return pz;
  };
  const bolsa = piezaBolsa("Bolsa de bolsillo", ancho + 8, fondo, "Cortar 2 en forro (un par)");
  const costadillo = piezaBolsa("Costadillo", ancho + 4, fondo - 2, "Cortar 2 en tela (un par)");
  costadillo.marcas.push({ t: "linea", pts: [A, lerp(A, B, 0.5), B], estilo: "colocacion" });
  if (costadillo.contorno.some((q) => q.n === "bolsilloB")) piquete(costadillo, "bolsilloB");
  piquete(r, nB);
  void fondoLado;
  return { delantero: r, bolsa, costadillo };
}

/** Rectángulo para colocar un bolsillo (líneas de colocación sobre la pieza). */
export function colocar(pz: Pieza, esquina: Pt, ancho: number, alto: number, rotulo?: string): void {
  const a = esquina;
  const b = P(a.x + ancho, a.y);
  const c = P(a.x + ancho, a.y - alto);
  const d = P(a.x, a.y - alto);
  pz.marcas.push({ t: "linea", pts: [a, b, c, d, a], estilo: "colocacion" });
  if (rotulo) pz.marcas.push({ t: "texto", p: P(a.x + ancho / 2, a.y - alto / 2), s: rotulo, h: 0.6 });
}

/** Bolsillo de parche trasero en punta (estilo jean). */
export function bolsilloTrasero(ancho = 14, alto = 15): Pieza {
  const r = crear(
    "Bolsillo trasero",
    [
      { x: 0, y: 0, n: "a" },
      { x: ancho / 2, y: -2, n: "punta" },
      { x: ancho, y: 0, n: "b" },
      { x: ancho + 0.5, y: alto, n: "c" },
      { x: -0.5, y: alto, n: "d" },
    ],
    { cortar: "Cortar 2 en tela" },
  );
  margenBorde(r, "c", "d", 3);
  r.hilo = [P(ancho / 2, 2), P(ancho / 2, alto - 3)];
  return r;
}

/**
 * Rectifica la espalda para que su costado mida lo mismo que el del delantero y su
 * entrepierna 0.3 cm menos (se embebe al coser). Mueve el punto de la bastilla a lo
 * largo de la última línea de la costura, como se rectifica a mano.
 */
export function igualar(d: Pieza, e: Pieza): Pieza {
  const r = clonar(e);
  const L = (pz: Pieza, a: string, b: string) => {
    const [x, y] = corto(pz, a, b);
    return largoTramo(pz, x, y);
  };
  const ajustar = (desde: string, punta: string, objetivo: number) => {
    const [x, y] = corto(r, desde, punta);
    const t = tramo(r, x, y);
    const fin = t[0].n === punta ? t[0] : t[t.length - 1];
    const vecino = t[0].n === punta ? t[1] : t[t.length - 2];
    const actual = L(r, desde, punta);
    const delta = objetivo - actual;
    if (Math.abs(delta) < 0.1) return;
    const u = dir(vecino, fin);
    const q = v(r, punta);
    q.x = fin.x + u.x * delta;
    q.y = fin.y + u.y * delta;
  };
  ajustar("costadoCintura", "costadoBajo", L(d, "costadoCintura", "costadoBajo"));
  const entreD = L(d, "tiro", "entrepiernaBajo");
  const entreE = L(r, "tiro", "entrepiernaBajo");
  if (entreE > entreD - 0.2 || entreE < entreD - 0.8) ajustar("tiro", "entrepiernaBajo", entreD - 0.3);
  return r;
}

/** Medidas de control: costados, entrepiernas y cintura. */
export function controlar(d: Pieza, e: Pieza, costadillo?: Pieza) {
  const L = (pz: Pieza, a: string, b: string) => Math.min(largoTramo(pz, a, b), largoTramo(pz, b, a));
  const costadoD = tiene(d, "costadoCintura") || !costadillo
    ? L(d, "costadoCintura", "costadoBajo")
    : L(costadillo, "costadoCintura", "bolsilloB") + L(d, "bolsilloB", "costadoBajo");
  return {
    costadoD,
    costadoE: L(e, "costadoCintura", "costadoBajo"),
    entreD: L(d, "tiro", "entrepiernaBajo"),
    entreE: L(e, "tiro", "entrepiernaBajo"),
    cintura: tiene(d, "costadoCintura") ? cinturas(d, e) : { d: NaN, e: NaN },
  };
}

export function largoTobillo(m: Medidas) {
  return m.tiro + m.largoPierna - 4;
}

export { longitud };
