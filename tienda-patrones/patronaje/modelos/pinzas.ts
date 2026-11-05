// Pinzas: dónde colocarlas y cómo trasladarlas (método de cortar y girar con
// centro en el punto de busto). Cada modelo devuelve espalda y delantero a la cintura.
import { type Pt, P, curva, dist, enLongitud, escalar, lerp, longitud, resta, suma, dir } from "../geometria.ts";
import type { Medidas } from "../medidas.ts";
import { type Cuerpo, type LugarPinza, cuerpoBase, delanteroConPinza } from "../bases/cuerpo.ts";
import {
  type Pieza,
  corto,
  idx,
  indicesTramo,
  insertar,
  margenBorde,
  piquete,
  reemplazar,
  tramo,
  trasladarPinza,
  v,
} from "../pieza.ts";
import { insertarEnBorde } from "./ayuda-mangas.ts";
import type { Modelo } from "./tipos.ts";

const PASO_CORTAR_GIRAR =
  "Corta desde el punto nuevo hasta el punto de busto, cierra la pinza vieja (gira la parte cortada con centro en el busto) y la abertura que se forma es la pinza nueva.";

function bodice(m: Medidas, lugar: LugarPinza): Pieza[] {
  const c = cuerpoBase(m);
  const d = delanteroConPinza(c, lugar);
  d.nombre = "Delantero";
  return [c.espalda, d];
}

/** Quita el doblez del centro delantero (pasa a ser costura). */
function centroConCostura(d: Pieza) {
  const [x, y] = corto(d, "centroCintura", "centroCuello");
  for (const k of indicesTramo(d, x, y)) {
    d.contorno[k].d = false;
  }
  margenBorde(d, "centroCintura", "centroCuello", 1.5);
  d.cortar = "Cortar 2 en tela (un par)";
}

/** Dos pinzas paralelas en el costado: la mitad de la pinza en cada una. */
function pinzasDobles(m: Medidas): Pieza[] {
  const c = cuerpoBase(m);
  let d = structuredClone(c.delantero);
  const sb = v(d, "sisaBajo");
  const n1 = insertar(d, "doble1", P(sb.x + 0.3, sb.y - 4));
  d = trasladarPinza(d, "pinzaBusto", n1, { fraccion: 0.5, nombre: "pinzaLateral1", retiro: 3 });
  const n2 = insertarEnBorde(d, "doble2", "pinzaLateral1B", "costadoCintura", 3);
  d = trasladarPinza(d, "pinzaBusto", n2, { nombre: "pinzaLateral2", retiro: 3.5 });
  d.nombre = "Delantero";
  return [c.espalda, d];
}

/** La pinza de busto se pasa a la cintura y se convierte en frunce bajo el busto. */
function pinzaEnFrunce(m: Medidas): Pieza[] {
  const c = cuerpoBase(m);
  const d = delanteroConPinza(c, "cintura");
  const pin = d.pinzas.find((p) => p.apice === "pinzaBusto")!;
  const a = v(d, pin.a);
  const b = v(d, pin.b);
  // la orilla se redondea 1 cm hacia abajo: el frunce cae sobre el busto
  const medioAB = lerp(a, b, 0.5);
  const bajo = P(medioAB.x, Math.min(a.y, b.y) - 1);
  const orilla = curva(a, dir(a, bajo), b, dir(bajo, b), 0.45, 0.45);
  d.pinzas = d.pinzas.filter((p) => p !== pin);
  // quita el ápice y reemplaza la abertura por la orilla curva
  d.contorno = d.contorno.filter((q) => q.n !== pin.apice);
  reemplazar(d, pin.a, pin.b, orilla, true);
  // zona de frunce: 2 cm más allá de cada pata
  const [x, y] = corto(d, "costadoCintura", "centroCintura");
  const t = tramo(d, x, y);
  const L = longitud(t);
  const sA = distanciaSobre(t, a);
  const sB = distanciaSobre(t, b);
  const s0 = Math.max(1, Math.min(sA, sB) - 2);
  const s1 = Math.min(L - 1, Math.max(sA, sB) + 2);
  piquete(d, enLongitud(t, s0).p);
  piquete(d, enLongitud(t, s1).p);
  d.marcas.push({ t: "texto", p: P(medioAB.x, medioAB.y + 3), s: "fruncir entre piquetes", h: 0.7 });
  d.marcas = d.marcas.filter((k) => k.t !== "taladro");
  d.nombre = "Delantero";
  return [c.espalda, d];
}

function distanciaSobre(t: Pt[], p: Pt): number {
  let mejor = 0;
  let md = Infinity;
  let s = 0;
  for (let i = 0; i < t.length; i++) {
    if (i) s += dist(t[i - 1], t[i]);
    const dd = dist(t[i], p);
    if (dd < md) {
      md = dd;
      mejor = s;
    }
  }
  return mejor;
}

/** La pinza de busto repartida en tres alforzas cortas en el hombro. */
function pinzaEnAlforzas(m: Medidas): Pieza[] {
  const c = cuerpoBase(m);
  let d = structuredClone(c.delantero);
  const largoAlforza = 7;
  const enHombro = (t: number, n: string) => {
    const a = v(d, "cuelloHombro");
    const b = v(d, "hombro");
    return insertar(d, n, suma(a, escalar(resta(b, a), t)));
  };
  // los tres puntos se marcan antes de girar (se mueven con la pieza)
  const n1 = enHombro(0.3, "alf1");
  const n2 = enHombro(0.5, "alf2");
  const n3 = enHombro(0.7, "alf3");
  d = trasladarPinza(d, "pinzaBusto", n1, { fraccion: 1 / 3, nombre: "alforza1" });
  d = trasladarPinza(d, "pinzaBusto", n2, { fraccion: 0.5, nombre: "alforza2" });
  d = trasladarPinza(d, "pinzaBusto", n3, { nombre: "alforza3" });
  // cada alforza se cose sólo 7 cm desde el hombro: retiro = largo de pata − 7
  d.pinzas = d.pinzas.map((p) => {
    if (!p.apice.startsWith("alforza")) return p;
    const ap = v(d, p.apice);
    const pa = v(d, p.a);
    return { ...p, retiro: Math.max(0, dist(ap, pa) - largoAlforza) };
  });
  d.marcas.push({ t: "texto", p: P(v(d, "alforza2").x, v(d, "alforza2").y + 6), s: "alforzas: coser 7 cm, planchar hacia el centro", h: 0.6 });
  d.marcas = d.marcas.filter((k) => k.t !== "taladro");
  d.nombre = "Delantero";
  void idx;
  return [c.espalda, d];
}

/** Espalda con la pinza de hombro pasada al escote (más fácil de coser con cuello). */
function pinzaEspalda(m: Medidas): Pieza[] {
  const c: Cuerpo = cuerpoBase(m);
  let e = structuredClone(c.espalda);
  const t = tramo(e, "cuelloHombro", "centroCuello");
  const n = insertar(e, "pinzaEsc", enLongitud(t, longitud(t) * 0.55).p);
  e = trasladarPinza(e, "pinzaHombro", n, { nombre: "pinzaEscote", retiro: 0 });
  e.nombre = "Espalda";
  const d = delanteroConPinza(c, "costado");
  d.nombre = "Delantero";
  return [e, d];
}

export const PINZAS: Modelo[] = [
  {
    id: "pinza-costado",
    categoria: "pinzas",
    nombre: "Pinza de costado",
    descripcion:
      "La más común en blusas y vestidos. Sale del costado unos 5 cm abajo de la sisa y apunta al punto de busto; termina 2 cm antes de él.",
    pasos: [
      "Marca el punto de busto (la parte más alta del busto) en el delantero.",
      "En el costado, mide unos 5 cm hacia abajo desde la sisa.",
      PASO_CORTAR_GIRAR,
      "Acorta la pinza 2 cm antes del punto de busto (2.5–3 cm en bustos grandes) para que no haga pico.",
      "Al coser, plancha la pinza hacia abajo.",
    ],
    generar: (m) => bodice(m, "costado"),
  },
  {
    id: "pinza-hombro",
    categoria: "pinzas",
    nombre: "Pinza de hombro",
    descripcion: "Sale de la mitad del hombro hacia el punto de busto. Da forma en el pecho y es la base de los cortes princesa desde hombro.",
    pasos: [
      "Marca un punto a la mitad del hombro (un poco más cerca del cuello).",
      PASO_CORTAR_GIRAR,
      "Termina la pinza 2 cm antes del busto; plánchala hacia el centro.",
    ],
    generar: (m) => bodice(m, "hombro"),
  },
  {
    id: "pinza-sisa",
    categoria: "pinzas",
    nombre: "Pinza de sisa",
    descripcion: "Sale de la sisa, a la altura del ancho de pecho, hacia el busto. Queda escondida en blusas con manga.",
    pasos: [
      "Marca en la sisa el punto donde la línea de ancho de pecho toca la curva.",
      PASO_CORTAR_GIRAR,
      "Así está trazada en el cuerpo base: el ángulo de la pinza es (busto ÷ 4 − 2.5)°.",
    ],
    generar: (m) => bodice(m, "sisa"),
  },
  {
    id: "pinza-cintura",
    categoria: "pinzas",
    nombre: "Pinza de cintura (todo el busto en la cintura)",
    descripcion:
      "Toda la pinza de busto se suma a la pinza de cintura: queda una sola pinza grande alineada con el punto de busto. Ideal para vestidos entallados sin costado marcado.",
    pasos: [
      "Corta por la pata de la pinza de cintura más cercana al costado hasta el punto de busto.",
      "Cierra la pinza de busto: la pinza de cintura se abre más.",
      "La pinza queda vertical, alineada con el punto de busto; termina 2.5 cm antes de él.",
    ],
    generar: (m) => bodice(m, "cintura"),
  },
  {
    id: "pinza-francesa",
    categoria: "pinzas",
    nombre: "Pinza francesa",
    descripcion: "Sale del costado muy cerca de la cintura y sube en diagonal al busto. Estiliza y adelgaza la figura.",
    pasos: [
      "Marca en el costado un punto a 1/5 del largo del costado, arriba de la cintura.",
      PASO_CORTAR_GIRAR,
      "Es larga: termínala 3 cm antes del busto y plánchala hacia abajo.",
    ],
    generar: (m) => bodice(m, "francesa"),
  },
  {
    id: "pinza-centro",
    categoria: "pinzas",
    nombre: "Pinza de centro delantero",
    descripcion: "Sale del centro delantero a la altura del busto. El centro ya no puede ir al doblez: lleva costura.",
    pasos: [
      "Marca en el centro delantero un punto a la altura del busto.",
      PASO_CORTAR_GIRAR,
      "El centro queda quebrado: agrega 1.5 cm de margen y corta dos piezas (un par).",
    ],
    generar: (m) => {
      const [e, d] = bodice(m, "centro");
      centroConCostura(d);
      return [e, d];
    },
  },
  {
    id: "pinza-escote",
    categoria: "pinzas",
    nombre: "Pinza de escote",
    descripcion: "Sale de la mitad del escote hacia el busto. Muy bonita convertida en frunces o alforzas bajo un cuello.",
    pasos: [
      "Marca un punto a la mitad de la curva del escote.",
      PASO_CORTAR_GIRAR,
      "Endereza la curva del escote cerrando la pinza en papel antes de cortar.",
    ],
    generar: (m) => bodice(m, "escote"),
  },
  {
    id: "pinzas-dobles",
    categoria: "pinzas",
    nombre: "Pinzas dobles (paralelas)",
    descripcion: "La pinza de busto se reparte en dos pinzas más chicas en el costado. Quedan más planas: útil en bustos grandes.",
    pasos: [
      "Marca dos puntos en el costado separados 3 cm (el primero a 4 cm de la sisa).",
      "Corta al primero y gira para cerrar la mitad de la pinza de busto.",
      "Corta al segundo y cierra el resto.",
      "Ambas apuntan al busto: termina la de arriba 3 cm y la de abajo 3.5 cm antes del busto.",
    ],
    generar: pinzasDobles,
  },
  {
    id: "pinza-en-frunce",
    categoria: "pinzas",
    nombre: "Pinza convertida en frunce",
    descripcion: "En vez de coser la pinza, su amplitud se frunce bajo el busto. Para blusas con corte imperio o pretina.",
    pasos: [
      "Pasa toda la pinza de busto a la cintura (como en la pinza de cintura).",
      "No cierres la pinza: redondea la orilla 1 cm hacia abajo entre las patas.",
      "Marca piquetes 2 cm más allá de cada pata: ahí va el frunce.",
      "Frunce hasta que la orilla mida lo mismo que la pieza a la que se une.",
    ],
    generar: pinzaEnFrunce,
  },
  {
    id: "pinza-en-alforzas",
    categoria: "pinzas",
    nombre: "Pinza convertida en alforzas",
    descripcion: "La pinza de busto se reparte en tres alforzas cortas en el hombro que se sueltan arriba del busto.",
    pasos: [
      "Marca tres puntos en el hombro (a 30, 50 y 70 % desde el cuello).",
      "Traslada un tercio de la pinza a cada punto, cortando y girando.",
      "Cose cada alforza sólo 7 cm desde el hombro y plánchalas hacia el centro.",
    ],
    generar: pinzaEnAlforzas,
  },
  {
    id: "pinza-espalda",
    categoria: "pinzas",
    nombre: "Pinzas de espalda",
    descripcion:
      "La pinza de hombro de la espalda apunta al omóplato (7–8 cm de largo) y puede pasarse al escote; la de cintura va en línea con el omóplato.",
    pasos: [
      "La pinza de hombro está a la mitad del hombro y mide busto ÷ 32 − 0.8 cm.",
      "Para pasarla al escote, marca un punto a la mitad del escote, corta hasta la punta de la pinza y gira para cerrar la del hombro.",
      "La pinza de cintura sube en vertical hasta 1 cm abajo de la línea de busto.",
      "Si prefieres no coser pinza de hombro, embebe ese ancho al unir los hombros (en telas que lo permitan).",
    ],
    generar: pinzaEspalda,
  },
];
