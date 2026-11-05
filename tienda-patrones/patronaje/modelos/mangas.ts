// Tipos de manga. Las montadas salen de la manga base; raglán, kimono,
// murciélago y hombro caído cambian también el cuerpo.
import {
  type Pt,
  P,
  angulo,
  curva,
  dir,
  dist,
  enLongitud,
  escalar,
  grados,
  lerp,
  longitud,
  masCercano,
  medio,
  perp,
  rotar,
  spline,
  suma,
  resta,
} from "../geometria.ts";
import type { Medidas } from "../medidas.ts";
import { cuerpoBase } from "../bases/cuerpo.ts";
import { mangaBase } from "../bases/manga.ts";
import { rectangulo } from "../bases/utiles.ts";
import {
  type Pieza,
  type V,
  agregarPinza,
  crear,
  dividir,
  girar,
  insertar,
  largoTramo,
  margen,
  margenBorde,
  mover,
  piquete,
  reemplazar,
  tramo,
  trasladarPinza,
  v,
} from "../pieza.ts";
import { blusaBase } from "./comun.ts";
import { abanico, insertarEnBorde, piquetesFrunce, trazarManga } from "./ayuda-mangas.ts";
import type { Modelo } from "./tipos.ts";

// ── Ayudas locales ──────────────────────────────────────────────────────────

const base = (m: Medidas, o: Parameters<typeof mangaBase>[2] = {}) => mangaBase(m, cuerpoBase(m), o);

/** Largo de manga corta desde el hombro: la copa más 6 cm de costura bajo brazo. */
const largoCorta = (m: Medidas) => base(m).ref.altoCopa + 6;

/** Tira o puño: rectángulo doblado a la mitad. */
function tira(nombre: string, largo: number, altoTerminado: number, cortar = "Cortar 2 en tela y 2 en entretela") {
  const r = rectangulo(nombre, largo, altoTerminado * 2, cortar, { dobladoAlCentro: true });
  r.ancla = P(0, 0);
  return r;
}

/** Contorno del brazo a cierta distancia del hombro (para tiras y puños). */
function brazoA(m: Medidas, desdeHombro: number) {
  const t = Math.max(0, Math.min(1, (desdeHombro - 12) / (m.largoBrazo - 12)));
  return m.brazo + (m.muneca - m.brazo) * t;
}

// ── Mangas montadas ─────────────────────────────────────────────────────────

function mangaCorta(m: Medidas): Pieza[] {
  const ancho = m.brazo + 5;
  const { manga } = base(m, { largo: largoCorta(m), bastilla: ancho - 3 });
  manga.nombre = "Manga corta";
  // sólo queda la guía de bíceps (la de codo cae fuera de la pieza)
  manga.marcas = manga.marcas.filter((k) => !(k.t === "linea" && Math.abs(k.pts[0].y) > 0.01));
  return [manga];
}

function mangaTresCuartos(m: Medidas): Pieza[] {
  const largo = m.largoBrazo * 0.78;
  const { manga } = base(m, { largo, bastilla: brazoA(m, largo) + 8 });
  manga.nombre = "Manga tres cuartos";
  return [manga];
}

/** Manga ajustada de una pieza: muñeca angosta, bastilla adelantada y pinza de codo. */
function mangaAjustada(m: Medidas): Pieza[] {
  const { manga, ref } = base(m, { bastilla: m.muneca + 5 });
  const pz = manga;
  pz.nombre = "Manga ajustada";
  // el brazo se dobla hacia adelante: la bastilla se corre 1.5 cm al frente
  // y la esquina de atrás baja para que la costura trasera tenga el largo del codo
  const bA = v(pz, "bastillaAtras");
  const bF = v(pz, "bastillaFrente");
  bA.x += 1.5;
  bF.x += 1.5;
  bA.y -= 2.5;
  const largoAtras = dist(v(pz, "sisaAtras"), bA);
  const largoFrente = dist(v(pz, "sisaFrente"), bF);
  const pinza = largoAtras - largoFrente;
  const sa = v(pz, "sisaAtras");
  const t = (0 - ref.yCodo) / (sa.y - bA.y);
  const enCodo = lerp(sa, bA, t);
  const haciaAdentro = escalar(perp(dir(sa, bA)), 1); // la normal hacia el centro de la manga
  const adentro = dist(suma(enCodo, haciaAdentro), P(0, ref.yCodo)) < dist(enCodo, P(0, ref.yCodo)) ? haciaAdentro : escalar(haciaAdentro, -1);
  agregarPinza(pz, "pinzaCodo", enCodo, suma(enCodo, escalar(adentro, 9)), pinza, 0);
  // las guías viejas de codo quedan torcidas: se quitan
  pz.marcas = pz.marcas.filter((k) => k.t !== "linea" || Math.abs(k.pts[0].y) < 0.01);
  pz.marcas.push({ t: "linea", pts: [P(-ref.anchoBiceps / 2, ref.yCodo), P(ref.anchoBiceps / 2 - 1, ref.yCodo)], estilo: "guia" });
  return [pz];
}

function mangaCampana(m: Medidas): Pieza[] {
  const largo = m.largoBrazo * 0.8;
  const { manga } = base(m, { largo, bastilla: m.brazo + 2 });
  const r = abanico(manga, { cortes: 6, copa: 0, bastilla: 5 + (m.busto - 80) * 0.03, bajarBastilla: 1.5, nombre: "Manga campana", margenBastilla: 1 });
  return [r];
}

function mangaGlobo(m: Medidas): Pieza[] {
  const largo = largoCorta(m) + 3;
  const { manga } = base(m, { largo, bastilla: m.brazo + 3 });
  const r = abanico(manga, { cortes: 6, copa: 3.5, bastilla: 1.5, subirCopa: 3, bajarBastilla: 1.5, nombre: "Manga globo", margenBastilla: 1 });
  piquetesFrunce(r, "sisaFrente", "sisaAtras", [0.2, 0.8]);
  r.marcas.push({ t: "texto", p: P(0, -2), s: "fruncir copa entre piquetes y bastilla", h: 0.7 });
  const b = tira("Tira de manga", brazoA(m, largo) + 3 + 2, 2.5);
  return [r, b];
}

function mangaFarol(m: Medidas): Pieza[] {
  const largo = m.largoBrazo * 0.55;
  const { manga } = base(m, { largo, bastilla: m.brazo + 3 });
  const r = abanico(manga, { cortes: 6, copa: 3, bastilla: 3, subirCopa: 2, bajarBastilla: 2.5, nombre: "Manga farol", margenBastilla: 1 });
  piquetesFrunce(r, "sisaFrente", "sisaAtras", [0.22, 0.78]);
  r.marcas.push({ t: "texto", p: P(0, -2), s: "fruncir copa y bastilla", h: 0.7 });
  const b = tira("Tira de manga", brazoA(m, largo) + 2.5 + 2, 3);
  return [r, b];
}

function mangaObispo(m: Medidas): Pieza[] {
  const alto = 5;
  const largo = m.largoBrazo + 3 - alto; // 3 cm de blusón sobre el puño
  const { manga } = base(m, { largo, bastilla: m.brazo + 2 });
  const r = abanico(manga, { cortes: 6, copa: 0, bastilla: 4.5, alargarAtras: 4, nombre: "Manga obispo", margenBastilla: 1 });
  // abertura del puño en la mitad trasera
  const t = tramo(r, "bastillaAtras", "bastillaFrente");
  const pA = enLongitud(t, longitud(t) * 0.25).p;
  r.marcas.push({ t: "linea", pts: [pA, P(pA.x, pA.y + 8)], estilo: "colocacion" });
  r.marcas.push({ t: "texto", p: P(pA.x + 2, pA.y + 10), s: "abertura", h: 0.6 });
  const puno = tira("Puño", m.muneca + 4 + 2, alto);
  puno.marcas.push({ t: "ojal", p: P(1.5, alto / 2), ang: 0, l: 1.4 }, { t: "boton", p: P(m.muneca + 4 + 2 - 1.5, alto / 2), r: 0.6 });
  return [r, puno];
}

/** Manga jamón: copa muy alta y abullonada, antebrazo ajustado. */
function mangaJamon(m: Medidas): Pieza[] {
  const [aj] = mangaAjustada(m);
  const sa = v(aj, "sisaAtras");
  const sf = v(aj, "sisaFrente");
  const T = v(aj, "copa");
  const h = T.y;
  // copa nueva en forma de hongo: sale hacia afuera y sube 6 cm
  const extra = 3.5;
  const puntos = [
    sf,
    P(sf.x + extra, h * 0.45),
    P(sf.x * 0.65, h + 5),
    P(0, h + 6.5),
    P(sa.x * 0.65, h + 5),
    P(sa.x - extra, h * 0.45),
    sa,
  ];
  const nueva = spline(puntos, 16);
  reemplazar(aj, "sisaFrente", "sisaAtras", nueva, true);
  insertar(aj, "copa", P(0, h + 6.5));
  aj.marcas = aj.marcas.filter((k) => k.t !== "piquete");
  const L = largoTramo(aj, "sisaFrente", "sisaAtras");
  const t = tramo(aj, "sisaFrente", "sisaAtras");
  piquete(aj, enLongitud(t, 7).p);
  piquete(aj, enLongitud(t, L - 7).p, true);
  piquete(aj, "copa");
  aj.marcas.push({ t: "texto", p: P(0, h - 3), s: "fruncir la copa entre piquetes", h: 0.7 });
  aj.nombre = "Manga jamón";
  return [aj];
}

/** Manga mariposa: semicírculo cosido entre los piquetes de la sisa, sin costura bajo el brazo. */
function mangaMariposa(m: Medidas): Pieza[] {
  const c = cuerpoBase(m);
  const { manga } = mangaBase(m, c);
  // tramo de copa entre los piquetes (lo que se cose a la sisa)
  const copa = tramo(manga, "sisaFrente", "sisaAtras");
  const Lc = longitud(copa);
  const desdeF = c.ref.sisaDelantera * 0.33;
  const desdeA = c.ref.sisaEspalda * 0.33;
  const largoCostura = Lc - desdeF - desdeA - 2.5; // sin embebido
  const ancho = 11 + (m.busto - 80) * 0.05;
  const R = largoCostura / Math.PI; // semicírculo interior
  const n = 40;
  const interior: V[] = [];
  const exterior: V[] = [];
  for (let k = 0; k <= n; k++) {
    const a = Math.PI * (1 - k / n); // de atrás (izq.) al frente (der.)
    const w = ancho * Math.sin((Math.PI * k) / n) ** 0.7;
    interior.push({ x: R * Math.cos(a), y: R * Math.sin(a) });
    exterior.push({ x: (R + w) * Math.cos(a), y: (R + w) * Math.sin(a) });
  }
  interior[0].n = "costuraAtras";
  interior[n].n = "costuraFrente";
  interior[n / 2].n = "hombro";
  exterior[n / 2].n = "bastillaCentro";
  // el arco interior es la costura a la sisa, el exterior la orilla con vuelo
  const cont: V[] = [...exterior.slice(1, -1).reverse(), ...interior];
  const pz = crear("Manga mariposa", cont, { cortar: "Cortar 2 en tela (un par)", ancla: P(0, 0) });
  // la orilla exterior (la que no pasa por el hombro) lleva dobladillo angosto
  const porHombro = tramo(pz, "costuraFrente", "costuraAtras").some((p) => p.n === "hombro");
  if (porHombro) margen(pz, "costuraAtras", "costuraFrente", 0.6);
  else margen(pz, "costuraFrente", "costuraAtras", 0.6);
  piquete(pz, "hombro");
  pz.hilo = [P(0, R + 2), P(0, R + ancho - 2)];
  pz.marcas.push({ t: "texto", p: P(0, R + 1.3), s: "coser entre los piquetes de la sisa", h: 0.6 });
  return [pz];
}

/** Manga casquillo: sólo la parte alta de la copa, entre piquetes, forrada. */
function mangaCasquillo(m: Medidas): Pieza[] {
  const c = cuerpoBase(m);
  const { manga, ref } = mangaBase(m, c);
  const copa = tramo(manga, "sisaFrente", "sisaAtras");
  const Lc = longitud(copa);
  const pF = enLongitud(copa, c.ref.sisaDelantera * 0.33 + 0.4).p;
  const pA = enLongitud(copa, Lc - (c.ref.sisaEspalda * 0.33 + 0.5)).p;
  const fondo = P(0, Math.min(pF.y, pA.y) - (4 + (m.busto - 80) * 0.03));
  const ladoA = curva(pA, P(0.25, -1), fondo, P(1, 0), 0.5, 0.5);
  const ladoF = curva(fondo, P(1, 0), pF, P(0.25, 1), 0.5, 0.5);
  const arriba = subCopa(copa, pF, pA);
  const cont: V[] = [
    { ...pA, n: "costuraAtras" },
    ...ladoA.slice(1, -1),
    { ...fondo, n: "orillaCentro" },
    ...ladoF.slice(1, -1),
    { ...pF, n: "costuraFrente" },
    ...arriba.slice(1, -1),
  ];
  const pz = crear("Manga casquillo", cont, { cortar: "Cortar 2 en tela y 2 en forro", ancla: P(0, 0) });
  insertar(pz, "copa", P(0, ref.altoCopa));
  piquete(pz, "copa");
  pz.hilo = [P(0, fondo.y + 1.5), P(0, ref.altoCopa - 2)];
  margenBorde(pz, "costuraAtras", "costuraFrente", 1);
  return [pz];
}

/** Tramo de la copa entre dos puntos (del frente hacia atrás). */
function subCopa(copa: Pt[], desde: Pt, hasta: Pt): Pt[] {
  const a = masCercano(copa, desde);
  const b = masCercano(copa, hasta);
  return [a.p, ...copa.slice(a.i + 1, b.i + 1), b.p];
}

/** Manga pétalo: dos piezas que se cruzan sobre el hombro. */
function mangaPetalo(m: Medidas): Pieza[] {
  const largo = largoCorta(m) + 2;
  const { manga } = base(m, { largo, bastilla: m.brazo + 4 });
  const T = v(manga, "copa");
  const bA = v(manga, "bastillaAtras");
  const bF = v(manga, "bastillaFrente");
  const cruce = 4.5;
  // puntos de cruce en la copa: 4.5 cm a cada lado del hombro
  const copa = tramo(manga, "sisaFrente", "sisaAtras");
  const Lc = longitud(copa);
  const iT = masCercano(copa, T);
  let sT = 0;
  for (let k = 0; k < iT.i; k++) sT += dist(copa[k], copa[k + 1]);
  const pFrente = enLongitud(copa, sT - cruce).p; // hacia el frente
  const pAtras = enLongitud(copa, sT + cruce).p; // hacia atrás
  void Lc;
  // pétalo delantero: costura delantera bajo brazo, bastilla completa y curva hasta el cruce trasero
  const curvaD = curva(bA, P(0.6, 1), pAtras, P(-0.3, 1), 0.45, 0.4);
  const copaD = subCopa(copa, v(manga, "sisaFrente"), pAtras);
  const del: V[] = [
    { ...bA, n: "bastillaAtras" },
    { ...bF, n: "bastillaFrente" },
    ...copaD.map((p, k) => ({ ...p, n: k === 0 ? "sisaFrente" : k === copaD.length - 1 ? "cruce" : undefined })),
    ...[...curvaD].reverse().slice(1, -1),
  ];
  const pd = crear("Pétalo delantero", del, { cortar: "Cortar 2 en tela y 2 en forro", ancla: P(0, 0) });
  margenBorde(pd, "cruce", "bastillaAtras", 1);
  margenBorde(pd, "bastillaAtras", "bastillaFrente", 1);
  // pétalo trasero: costura trasera bajo brazo y curva hasta el cruce delantero
  const curvaA = curva(bF, P(-0.6, 1), pFrente, P(0.3, 1), 0.45, 0.4);
  const copaA = subCopa(copa, pFrente, v(manga, "sisaAtras"));
  const tra: V[] = [
    { ...bA, n: "bastillaAtras" },
    { ...bF, n: "bastillaFrente" },
    ...curvaA.slice(1, -1),
    ...copaA.map((p, k) => ({ ...p, n: k === 0 ? "cruce" : k === copaA.length - 1 ? "sisaAtras" : undefined })),
  ];
  const pt = crear("Pétalo trasero", tra, { cortar: "Cortar 2 en tela y 2 en forro", ancla: P(0, 0) });
  margenBorde(pt, "bastillaFrente", "cruce", 1);
  margenBorde(pt, "bastillaAtras", "bastillaFrente", 1);
  for (const p of [pd, pt]) {
    piquete(p, P(T.x, T.y));
    p.hilo = [P(0, T.y * 0.55), P(0, v(manga, "bastillaAtras").y + 2.5)];
  }
  return [pd, pt];
}

/** Manga camisera: copa baja, puño con botón, abertura con tira y dos pliegues. */
function mangaCamisera(m: Medidas): Pieza[] {
  const altoPuno = 6;
  const largoPuno = m.muneca + 6;
  const pliegue = 2.5;
  const largo = m.largoBrazo + 2 - altoPuno;
  const { manga } = base(m, { holguraBrazo: 8, embebido: 1, largo, bastilla: largoPuno + 2 * pliegue - 2 });
  manga.nombre = "Manga camisera";
  const bA = v(manga, "bastillaAtras");
  const bF = v(manga, "bastillaFrente");
  const ancho = bF.x - bA.x;
  margen(manga, "bastillaAtras", "bastillaFrente", 1);
  // abertura en la mitad trasera (a 1/4 del ancho desde atrás), 12 cm
  const xAb = bA.x + ancho * 0.25;
  manga.marcas.push({ t: "linea", pts: [P(xAb, bA.y), P(xAb, bA.y + 12)], estilo: "colocacion" });
  manga.marcas.push({ t: "texto", p: P(xAb + 2.5, bA.y + 13), s: "abertura", h: 0.6 });
  // dos pliegues hacia la abertura
  for (const x of [xAb + 3, xAb + 3 + pliegue + 2]) {
    manga.marcas.push({ t: "linea", pts: [P(x, bA.y), P(x, bA.y + 4)], estilo: "pliegue" });
    manga.marcas.push({ t: "linea", pts: [P(x + pliegue, bA.y), P(x + pliegue, bA.y + 4)], estilo: "pliegue" });
  }
  const puno = tira("Puño", largoPuno + 2, altoPuno);
  puno.marcas.push({ t: "ojal", p: P(1.6, altoPuno / 2), ang: 0, l: 1.5 }, { t: "boton", p: P(largoPuno + 2 - 1.6, altoPuno / 2), r: 0.6 });
  const vivo = rectangulo("Tira de abertura", 2 * 12 + 2, 3.2, "Cortar 2 en tela (al hilo)");
  vivo.ancla = P(0, 0);
  return [manga, puno, vivo];
}

// ── Mangas que cambian el cuerpo ────────────────────────────────────────────

/** Manga raglán de dos piezas (delantera y trasera) y cuerpo cortado en diagonal. */
function mangaRaglan(m: Medidas): Pieza[] {
  const b = blusaBase(m, { pinza: "costado" });
  const c = b.cuerpo;
  let esp = b.espalda;
  let del = b.delantero;
  // 1) La pinza de hombro de espalda pasa al escote (queda en el cuerpo)
  {
    const t = tramo(esp, "cuelloHombro", "centroCuello");
    const L = longitud(t);
    const n = insertar(esp, "pinzaEsc", enLongitud(t, L * 0.72).p);
    esp = trasladarPinza(esp, "pinzaHombro", n, { nombre: "pinzaEscote", retiro: 0 });
  }
  // 2) Puntos de la línea raglán: 3 cm del cuello y piquete de sisa
  const r1d = (() => {
    const t = tramo(del, "centroCuello", "cuelloHombro");
    return insertar(del, "raglanCuello", enLongitud(t, longitud(t) - 3).p);
  })();
  const r2d = insertarEnBorde(del, "raglanSisa", "sisaBajo", "hombro", c.ref.sisaDelantera * 0.33);
  const r1e = (() => {
    const t = tramo(esp, "cuelloHombro", "centroCuello");
    return insertar(esp, "raglanCuello", enLongitud(t, 3).p);
  })();
  const r2e = insertarEnBorde(esp, "raglanSisa", "sisaBajo", "hombro", c.ref.sisaEspalda * 0.33);
  const lineaRaglan = (a: Pt, bq: Pt, hacia: Pt) => {
    // ligeramente curva hacia el hombro
    const md = medio(a, bq);
    let n = perp(dir(a, bq));
    if (dist(suma(md, n), hacia) > dist(suma(md, escalar(n, -1)), hacia)) n = escalar(n, -1);
    return spline([a, suma(lerp(a, bq, 0.6), escalar(n, 0.9)), bq], 10);
  };
  const ld = lineaRaglan(v(del, r1d), v(del, r2d), v(del, "hombro"));
  const le = lineaRaglan(v(esp, r2e), v(esp, r1e), v(esp, "hombro"));
  const [hombroD, cuerpoD] = dividir(del, r1d, r2d, ld.slice(1, -1), ["Hombro delantero", "Delantero"]);
  const [hombroE, cuerpoE] = dividir(esp, r2e, r1e, le.slice(1, -1), ["Hombro trasero", "Espalda"]);

  // 3) Manga dividida al centro; se le pega cada hombro haciendo coincidir el piquete
  const { manga } = mangaBase(m, c);
  const tF = tramo(manga, "sisaFrente", "copa");
  insertar(manga, "muescaF", enLongitud(tF, c.ref.sisaDelantera * 0.33 + 2.5 * 0.15).p);
  const tA = tramo(manga, "copa", "sisaAtras");
  insertar(manga, "muescaA", enLongitud(tA, longitud(tA) - (c.ref.sisaEspalda * 0.33 + 2.5 * 0.18)).p);
  const yB = v(manga, "bastillaAtras").y;
  insertar(manga, "centroBastilla", P(0, yB));
  const [mitadA, mitadF] = dividir(manga, "copa", "centroBastilla", [], ["Manga raglán trasera", "Manga raglán delantera"]);
  const h = v(manga, "copa").y;

  const pegar = (hombro: Pieza, r2: string, mitad: Pieza, muesca: string, haciaCopa: Pt[]) => {
    const M = v(mitad, muesca);
    let q = mover(hombro, M.x - v(hombro, r2).x, M.y - v(hombro, r2).y);
    const rho = dist(v(q, r2), v(q, "hombro"));
    // punto de la copa (de la muesca hacia arriba) a distancia rho de la muesca
    let objetivo = haciaCopa[haciaCopa.length - 1];
    for (let k = 1; k < haciaCopa.length; k++) {
      if (dist(haciaCopa[k], M) >= rho) {
        const a = haciaCopa[k - 1];
        const bq = haciaCopa[k];
        const da = dist(a, M);
        const db = dist(bq, M);
        objetivo = lerp(a, bq, (rho - da) / (db - da || 1));
        break;
      }
    }
    const ang = angulo(resta(objetivo, M)) - angulo(resta(v(q, "hombro"), M));
    q = girar(q, M, ang);
    return q;
  };

  const sobreArriba = (pz: Pieza, desde: string, hasta: string) => tramo(pz, desde, hasta).map((p) => ({ x: p.x, y: p.y }));
  // delantera
  const hd = pegar(hombroD, r2d, mitadF, "muescaF", sobreArriba(mitadF, "muescaF", "copa"));
  const Q = P(0, h - 9);
  const brazoD = curva(v(hd, "hombro"), dir(v(hd, "cuelloHombro"), v(hd, "hombro")), Q, P(0, -1), 0.45, 0.5);
  const contD: V[] = [
    ...tramo(mitadF, "centroBastilla", "muescaF").slice(0, -1),
    ...tramo(hd, r2d, "hombro").map((p) => ({ ...p, m: undefined, d: false })),
    ...brazoD.slice(1).map((p) => ({ x: p.x, y: p.y })),
  ];
  const mD = crear("Manga raglán delantera", contD, { cortar: "Cortar 2 en tela (un par)", ancla: P(0, 0) });
  // trasera
  const he = pegar(hombroE, r2e, mitadA, "muescaA", sobreArriba(mitadA, "copa", "muescaA").reverse());
  const brazoE = curva(v(he, "hombro"), dir(v(he, "cuelloHombro"), v(he, "hombro")), Q, P(0, -1), 0.45, 0.5);
  const contE: V[] = [
    ...[...brazoE].reverse().slice(0, -1).map((p) => ({ x: p.x, y: p.y })),
    ...tramo(he, "hombro", r2e).map((p) => ({ ...p, m: undefined, d: false })),
    ...tramo(mitadA, "muescaA", "centroBastilla").slice(1),
  ];
  const mE = crear("Manga raglán trasera", contE, { cortar: "Cortar 2 en tela (un par)", ancla: P(0, 0) });
  for (const [pz, mu] of [
    [mD, "muescaF"],
    [mE, "muescaA"],
  ] as const) {
    margenBorde(pz, "centroBastilla", pz === mD ? "bastillaFrente" : "bastillaAtras", 2.5);
    piquete(pz, "hombro");
    piquete(pz, "raglanCuello");
    pz.marcas = pz.marcas.filter((k) => k.t !== "linea" && k.t !== "taladro");
    pz.marcas.push({ t: "piquete", p: v(pz, "raglanSisa"), doble: mu === "muescaA" });
    const xh = pz === mD ? (v(pz, "bastillaFrente").x) / 2 : v(pz, "bastillaAtras").x / 2;
    pz.hilo = [P(xh, -4), P(xh, yB + 10)];
  }
  piquete(cuerpoD, "raglanSisa");
  piquete(cuerpoE, "raglanSisa", true);
  return [cuerpoE, cuerpoD, mE, mD];
}

/**
 * Manga murciélago: cortada en una con el cuerpo y axila casi en la cintura.
 * Cada media bastilla se ajusta para que la costura bajo brazo de espalda y
 * delantero mida lo mismo.
 */
function mangaMurcielago(m: Medidas): Pieza[] {
  // la pinza de busto va al hombro: el costado queda libre para la axila
  const b = blusaBase(m, { pinza: "hombro" });
  const largo = m.largoBrazo;
  const w = (m.muneca + 8) / 2;
  const sobreCintura = 4;
  const construir = (pz: Pieza, haciaX: number, grad: number): Pieza => {
    const r = structuredClone(pz);
    const a = grados(grad);
    const H = v(r, "hombro");
    const dS = P(haciaX * Math.cos(a), -Math.sin(a));
    const O = suma(H, escalar(dS, largo));
    let nAbajo = perp(dS);
    if (nAbajo.y > 0) nAbajo = escalar(nAbajo, -1);
    const U = suma(O, escalar(nAbajo, w));
    const sisaBajo = v(r, "sisaBajo");
    const cint = v(r, "costadoCintura");
    const axila = lerp(cint, sisaBajo, sobreCintura / dist(cint, sisaBajo));
    const tanU = rotar(escalar(dS, -1), P(0, 0), grados(28 * haciaX));
    const bajoBrazo = curva(U, tanU, axila, dir(axila, cint), 0.55, 0.45);
    const nAx = insertar(r, "axila", axila);
    const nuevos = [H, O, ...bajoBrazo];
    if (tramo(r, "hombro", nAx).length <= tramo(r, nAx, "hombro").length) reemplazar(r, "hombro", nAx, nuevos, true);
    else reemplazar(r, nAx, "hombro", [...nuevos].reverse(), true);
    insertar(r, "punoArriba", O);
    insertar(r, "punoAbajo", U);
    margenBorde(r, "punoArriba", "punoAbajo", 2);
    r.marcas = r.marcas.filter((k) => k.t !== "piquete");
    piquete(r, "hombro");
    r.nombre = pz.nombre;
    return r;
  };
  const largoBajo = (pz: Pieza) => largoTramoBorde(pz, "punoAbajo", "costadoCintura");
  const del = construir(b.delantero, -1, 20);
  const objetivo = largoBajo(del);
  // la espalda arranca más adentro del costado: se busca la caída del brazo
  // trasero con la que la costura bajo brazo mide lo mismo que la delantera
  let esp = construir(b.espalda, 1, 20);
  let error = Math.abs(largoBajo(esp) - objetivo);
  for (let g = 2; g <= 36; g += 0.25) {
    const c = construir(b.espalda, 1, g);
    const e = Math.abs(largoBajo(c) - objetivo);
    if (e < error) {
      error = e;
      esp = c;
    }
  }
  return [esp, del];
}

/**
 * Manga kimono: la línea bajo brazo es paralela a la de hombro y arranca a la
 * misma profundidad en delantero y espalda, así ambas costuras miden lo mismo.
 */
function mangaKimono(m: Medidas): Pieza[] {
  const b = blusaBase(m, { pinza: "hombro" });
  const a = grados(35);
  const largo = m.largoBrazo * 0.55;
  const profundidad = 4 + (m.busto - 80) * 0.03; // esquina de la axila bajo la sisa
  const radio = 5;
  const datos = [
    { pz: b.espalda, haciaX: 1 },
    { pz: b.delantero, haciaX: -1 },
  ].map(({ pz, haciaX }) => {
    const r = structuredClone(pz);
    const H = v(r, "hombro");
    const dS = P(haciaX * Math.cos(a), -Math.sin(a));
    const O = suma(H, escalar(dS, largo));
    const sb = v(r, "sisaBajo");
    const lado = dir(sb, v(r, "costadoCintura"));
    const K = suma(sb, escalar(lado, profundidad));
    const proy = (O.x - K.x) * dS.x + (O.y - K.y) * dS.y;
    return { r, H, dS, O, K, lado, proy };
  });
  const Lu = (datos[0].proy + datos[1].proy) / 2;
  return datos.map(({ r, H, dS, O, K, lado }) => {
    const U = suma(K, escalar(dS, Lu));
    const a1 = suma(K, escalar(dS, radio));
    const axila = suma(K, escalar(lado, radio));
    const nAx = insertar(r, "axila", axila);
    const nuevos = [H, O, U, ...curva(a1, escalar(dS, -1), axila, lado, 0.55, 0.55)];
    if (tramo(r, "hombro", nAx).length <= tramo(r, nAx, "hombro").length) reemplazar(r, "hombro", nAx, nuevos, true);
    else reemplazar(r, nAx, "hombro", [...nuevos].reverse(), true);
    insertar(r, "punoArriba", O);
    insertar(r, "punoAbajo", U);
    margenBorde(r, "punoArriba", "punoAbajo", 2);
    r.marcas = r.marcas.filter((k) => k.t !== "piquete");
    piquete(r, "hombro");
    return r;
  });
}

/** Largo del borde entre dos puntos, por el camino corto. */
function largoTramoBorde(pz: Pieza, a: string, bq: string): number {
  const t1 = tramo(pz, a, bq);
  const t2 = tramo(pz, bq, a);
  return t1.length <= t2.length ? largoTramo(pz, a, bq) : largoTramo(pz, bq, a);
}

/** Hombro caído: el hombro se alarga 6 cm y la sisa baja 3 cm; la copa queda más plana. */
function mangaCaida(m: Medidas): Pieza[] {
  const b = blusaBase(m, { pinza: "francesa" });
  const caida = 6;
  const bajar = 3;
  const modificar = (pz: Pieza, haciaX: number) => {
    const r = structuredClone(pz);
    const snp = v(r, "cuelloHombro");
    const H = v(r, "hombro");
    const dH = dir(snp, H);
    const H2 = suma(suma(H, escalar(dH, caida)), P(0, -1));
    const sisaBajo = v(r, "sisaBajo");
    const nAx = insertarEnBorde(r, "axila", "sisaBajo", "costadoCintura", bajar);
    const S2 = v(r, nAx);
    const bajada = escalar(perp(dir(snp, H2)), haciaX < 0 ? 1 : -1);
    const curvaSisa = curva(H2, bajada.y < 0 ? bajada : escalar(bajada, -1), S2, P(haciaX, 0), 0.55, 0.5);
    void sisaBajo;
    const nuevos = [H, ...curvaSisa];
    if (tramo(r, "hombro", nAx).length <= tramo(r, nAx, "hombro").length) reemplazar(r, "hombro", nAx, nuevos, true);
    else reemplazar(r, nAx, "hombro", [...nuevos].reverse(), true);
    insertar(r, "hombroCaido", H2);
    r.marcas = r.marcas.filter((k) => k.t !== "piquete");
    piquete(r, "hombroCaido");
    return r;
  };
  const del = modificar(b.delantero, -1);
  const esp = modificar(b.espalda, 1);
  const sisaD = largoTramoBorde(del, "hombroCaido", "axila");
  const sisaE = largoTramoBorde(esp, "hombroCaido", "axila");
  piqueteBorde(del, "axila", "hombroCaido", sisaD * 0.4);
  piqueteBorde(esp, "axila", "hombroCaido", sisaE * 0.4, true);
  const { manga } = trazarManga({
    nombre: "Manga hombro caído",
    sisaDelantera: sisaD,
    sisaEspalda: sisaE,
    embebido: 1,
    anchoBiceps: m.brazo + 10,
    largo: m.largoBrazo - caida,
    bastilla: m.muneca + 12,
    llenura: 0.8,
  });
  // los piquetes de la manga a la misma altura que en el cuerpo
  manga.marcas = manga.marcas.filter((k) => k.t !== "piquete");
  piquete(manga, "copa");
  piqueteBorde(manga, "sisaFrente", "copa", sisaD * 0.4 + 0.2);
  piqueteBorde(manga, "sisaAtras", "copa", sisaE * 0.4 + 0.2, true);
  return [esp, del, manga];
}

/** Piquete sobre el borde a–b a `d` cm de a (en cualquier sentido). */
function piqueteBorde(pz: Pieza, a: string, bq: string, d: number, doble = false) {
  const t1 = tramo(pz, a, bq);
  const t2 = tramo(pz, bq, a).reverse();
  const t = t1.length <= t2.length ? t1 : t2;
  piquete(pz, enLongitud(t, d).p, doble);
}

// ── Catálogo ────────────────────────────────────────────────────────────────

export const MANGAS: Modelo[] = [
  {
    id: "manga-recta-corta",
    categoria: "mangas",
    nombre: "Manga corta",
    descripcion: "La manga base cortada a medio brazo, con la bastilla casi del ancho del bíceps. La más usada en blusas y vestidos.",
    pasos: [
      "Calca la manga base con sus piquetes de copa.",
      "Mide desde la copa el largo deseado (unos 18–20 cm para talla M) y traza la bastilla recta.",
      "Deja la bastilla 1.5 cm más angosta que el bíceps de cada lado para que no se abra.",
      "Agrega 2.5 cm de dobladillo con los costados en espejo.",
    ],
    generar: mangaCorta,
  },
  {
    id: "manga-tres-cuartos",
    categoria: "mangas",
    nombre: "Manga tres cuartos",
    descripcion: "Termina entre el codo y la muñeca (78 % del largo de brazo). Favorecedora y práctica.",
    pasos: [
      "Sobre la manga base marca el largo a tres cuartos (más o menos 10 cm abajo del codo).",
      "El ancho de la bastilla es el contorno del brazo a esa altura más 8 cm de holgura.",
      "Une la bastilla con los costados en línea recta desde el bíceps.",
    ],
    generar: mangaTresCuartos,
  },
  {
    id: "manga-ajustada",
    categoria: "mangas",
    nombre: "Manga ajustada con pinza de codo",
    descripcion: "Manga larga de una pieza, angosta en la muñeca, con pinza de codo para que el brazo se doble con comodidad.",
    pasos: [
      "Angosta la bastilla a la muñeca + 5 cm y córrela 1.5 cm hacia el frente (el brazo cuelga hacia adelante).",
      "Baja 2.5 cm la esquina trasera de la bastilla: la costura de atrás queda más larga.",
      "La diferencia entre la costura trasera y la delantera es el ancho de la pinza de codo.",
      "Traza la pinza en la costura trasera, a la altura del codo, de 9 cm de largo hacia el centro.",
    ],
    generar: mangaAjustada,
  },
  {
    id: "manga-campana",
    categoria: "mangas",
    nombre: "Manga campana",
    descripcion: "Se abre en la bastilla como campana; la copa queda igual a la base, así que se monta sin frunce.",
    pasos: [
      "Divide la manga en 7 tiras con 6 cortes verticales de la bastilla hasta la copa.",
      "Corta hasta la copa sin separarla (bisagra) y abre cada corte en la bastilla (unos 5 cm).",
      "Redondea la bastilla bajándola un poco al centro y une las tiras con una curva suave.",
      "Como hay mucho vuelo, termina la orilla con dobladillo angosto o bies.",
    ],
    telas: "Telas con caída: rayón, crepé, gasa.",
    generar: mangaCampana,
  },
  {
    id: "manga-globo",
    categoria: "mangas",
    nombre: "Manga globo (abullonada)",
    descripcion: "Manga corta con volumen arriba y abajo, fruncida en la copa y en una tira que ajusta al brazo.",
    pasos: [
      "Usa la manga corta base y divídela en 7 tiras.",
      "Abre los cortes 3.5 cm en la copa y 1.5 cm en la bastilla.",
      "Sube 3 cm el centro de la copa para que tenga volumen y baja 1.5 cm el centro de la bastilla.",
      "Frunce la copa entre los piquetes hasta que mida lo mismo que la sisa.",
      "Frunce la bastilla a la tira: contorno de brazo + 3 cm de holgura.",
    ],
    generar: mangaGlobo,
  },
  {
    id: "manga-farol",
    categoria: "mangas",
    nombre: "Manga farol",
    descripcion: "Manga a medio brazo con volumen parejo, fruncida arriba y abajo como un farolito.",
    pasos: [
      "Corta la manga base a 55 % del largo de brazo y divídela en 7 tiras.",
      "Separa las tiras en paralelo 3 cm (la misma amplitud en la copa y en la bastilla).",
      "Sube 2 cm la copa y baja 2.5 cm la bastilla al centro para que el volumen caiga bonito.",
      "Frunce la copa entre piquetes y la bastilla a una tira de 3 cm.",
    ],
    generar: mangaFarol,
  },
  {
    id: "manga-obispo",
    categoria: "mangas",
    nombre: "Manga obispo",
    descripcion: "Manga larga con vuelo abajo, fruncida en un puño; la parte de atrás es más larga para que el blusón caiga hacia el codo.",
    pasos: [
      "Usa la manga base larga, quítale el alto del puño y súmale 3 cm de blusón.",
      "Divide en 7 tiras y abre cada corte 4.5 cm sólo en la bastilla.",
      "Baja 4 cm la mitad trasera de la bastilla (curva) para dar largo en el codo.",
      "Marca la abertura del puño en la mitad trasera y frunce la bastilla al puño (muñeca + 4 cm + 2 cm de cruce).",
    ],
    generar: mangaObispo,
  },
  {
    id: "manga-jamon",
    categoria: "mangas",
    nombre: "Manga jamón",
    descripcion: "Muy abullonada en el hombro y ajustada del codo a la muñeca. Típica de blusas victorianas y de novia.",
    pasos: [
      "Parte de la manga ajustada con pinza de codo.",
      "Redibuja la copa: súbela 6.5 cm al centro y sácala 3.5 cm hacia afuera a cada lado, en forma de hongo.",
      "Del codo hacia abajo la manga no cambia.",
      "Frunce o haz pliegues en la copa entre los piquetes hasta que mida la sisa.",
    ],
    generar: mangaJamon,
  },
  {
    id: "manga-raglan",
    categoria: "mangas",
    nombre: "Manga raglán",
    descripcion: "La costura de la manga va en diagonal del cuello a la axila. La manga incluye la parte del hombro; cómoda y deportiva.",
    pasos: [
      "En delantero y espalda marca un punto en el escote a 3 cm del hombro y une con una curva suave hasta el piquete de la sisa.",
      "En la espalda pasa antes la pinza de hombro al escote.",
      "Corta los cuerpos por esa línea: la parte del hombro se va a la manga.",
      "Divide la manga al centro. Pega cada hombro a su mitad haciendo coincidir el piquete de sisa y apoyando el punto de hombro en la copa.",
      "Une el punto de hombro con el centro de la manga con una curva: es la costura de hombro y brazo.",
    ],
    generar: mangaRaglan,
  },
  {
    id: "manga-kimono",
    categoria: "mangas",
    nombre: "Manga kimono",
    descripcion: "La manga se corta en una sola pieza con el cuerpo, sin costura en la sisa. La axila se baja y se redondea.",
    pasos: [
      "Pasa la pinza de busto al hombro (el costado debe quedar libre).",
      "Prolonga la línea de hombro hacia afuera con 35° de caída y mide el largo de manga desde el hombro.",
      "Baja 4 cm sobre el costado y traza desde ahí la línea bajo brazo, paralela al hombro.",
      "Cierra la bastilla y redondea la esquina de la axila con 5 cm de radio.",
      "Como delantero y espalda bajan lo mismo, la costura bajo brazo mide igual en las dos piezas.",
    ],
    generar: mangaKimono,
  },
  {
    id: "manga-murcielago",
    categoria: "mangas",
    nombre: "Manga murciélago",
    descripcion: "Manga unida al cuerpo con la axila muy profunda, casi en la cintura: queda como un ala al levantar el brazo.",
    pasos: [
      "Parte de la blusa con la pinza de busto en el hombro.",
      "Prolonga el hombro con 20° de caída hasta el largo de brazo (en la espalda ajusta la caída para que la costura bajo brazo mida igual).",
      "En la muñeca la manga mide la mitad de muñeca + 8 cm.",
      "Traza una curva amplia de la muñeca al costado, 4 cm arriba de la cintura.",
      "Para que no se suba, termina la manga y la cintura con puño o resorte.",
    ],
    generar: mangaMurcielago,
  },
  {
    id: "manga-caida",
    categoria: "mangas",
    nombre: "Manga de hombro caído",
    descripcion: "La costura de la sisa cae sobre el brazo: el hombro del cuerpo se alarga y la copa de la manga es baja y ancha.",
    pasos: [
      "Alarga el hombro 6 cm (y baja 1 cm la punta) en delantero y espalda.",
      "Baja la sisa 3 cm en el costado y traza la sisa nueva, más recta.",
      "Mide las sisas nuevas. Traza una manga con bíceps de brazo + 10 cm y copa baja (casi sin embebido).",
      "Quita a la manga los 6 cm que ganó el hombro.",
    ],
    generar: mangaCaida,
  },
  {
    id: "manga-mariposa",
    categoria: "mangas",
    nombre: "Manga mariposa",
    descripcion: "Manga corta en semicírculo que cae en ondas; se cose sólo en la parte alta de la sisa, sin costura bajo el brazo.",
    pasos: [
      "Mide la copa de la manga base entre los piquetes delantero y trasero (sin embebido).",
      "Ese largo es el borde interior de un semicírculo: radio = largo ÷ 3.14.",
      "Traza el borde exterior a 11 cm en el centro, bajando a cero en las puntas.",
      "Cose la orilla con dobladillo de pañuelo y monta la manga entre los piquetes; el resto de la sisa lleva vista o bies.",
    ],
    generar: mangaMariposa,
  },
  {
    id: "manga-casquillo",
    categoria: "mangas",
    nombre: "Manga casquillo",
    descripcion: "Manguita que sólo cubre la punta del hombro. Es la parte alta de la copa, forrada.",
    pasos: [
      "Marca en la copa los piquetes delantero y trasero.",
      "Traza una curva de piquete a piquete que baje unos 4 cm por debajo de los piquetes en el centro.",
      "Corta la pieza en tela y en forro; únelas por la orilla curva y voltea.",
      "Monta entre los piquetes; el resto de la sisa se termina con vista o bies.",
    ],
    generar: mangaCasquillo,
  },
  {
    id: "manga-petalo",
    categoria: "mangas",
    nombre: "Manga pétalo (tulipán)",
    descripcion: "Dos piezas curvas que se cruzan sobre el hombro como pétalos de tulipán.",
    pasos: [
      "Usa la manga corta y marca dos puntos en la copa, a 4.5 cm a cada lado del piquete de hombro.",
      "Desde la esquina trasera de la bastilla traza una curva hasta el punto delantero de la copa: es el pétalo trasero.",
      "Desde la esquina delantera, una curva hasta el punto trasero: es el pétalo delantero.",
      "Forra cada pétalo, únelos por la costura bajo brazo y encima uno al otro en la copa.",
    ],
    generar: mangaPetalo,
  },
  {
    id: "manga-camisera",
    categoria: "mangas",
    nombre: "Manga camisera con puño",
    descripcion: "Manga de camisa: copa baja y bíceps amplio, dos pliegues, abertura con tira y puño abotonado.",
    pasos: [
      "Traza la manga con 8 cm de holgura de bíceps y sólo 1 cm de embebido (copa más baja).",
      "Quita el alto del puño al largo y suma 2 cm de blusón.",
      "La bastilla mide el puño más dos pliegues de 2.5 cm.",
      "Marca la abertura de 12 cm a un cuarto del ancho desde atrás y los pliegues hacia ella.",
      "Puño: muñeca + 6 cm, con 2 cm de cruce para botón y ojal.",
    ],
    generar: mangaCamisera,
  },
];
