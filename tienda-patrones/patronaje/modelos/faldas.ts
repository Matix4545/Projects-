// Tipos de falda. Todas salen de la falda base (bases/falda.ts) o de rectángulos y círculos.
import { type Pt, P, curva, dentro, dir, dist, escalar, perp, suma } from "../geometria.ts";
import type { Medidas } from "../medidas.ts";
import { faldaBase as faldaBaseOriginal } from "../bases/falda.ts";
import { anillo, rectangulo, vista } from "../bases/utiles.ts";
import {
  type Pieza,
  type V,
  clonar,
  completar,
  corto,
  dividir,
  doblezBorde,
  girar,
  hiloVertical,
  insertar,
  idx,
  margenBorde,
  piquete,
  tiene,
  trasladarPinza,
  v,
} from "../pieza.ts";
import {
  abrirPinzaAlBajo,
  cinturaFalda,
  cruceConTramo,
  evase,
  godet,
  nesgas,
  panel,
  pinzasDe,
  pretina,
  puntoEnY,
  ordenBastilla,
  ordenCintura,
  ordenCostado,
  rellenarPinza,
  sanearPinzas,
} from "./ayuda-faldas.ts";
import type { Modelo } from "./tipos.ts";

const G = "faldas" as const;

/** Falda base con las pinzas revisadas (ver sanearPinzas). */
function faldaBase(m: Medidas, o?: Parameters<typeof faldaBaseOriginal>[1]) {
  const f = faldaBaseOriginal(m, o);
  sanearPinzas(f.delantero);
  sanearPinzas(f.espalda);
  return f;
}

/** Dirección hacia el costado de una pieza de falda (+1 o −1). */
const haciaCostado = (pz: Pieza) => Math.sign(v(pz, "costadoBajo").x - v(pz, "centroBajo").x) || 1;

function renombrar(pz: Pieza, nombre: string, cortar?: string): Pieza {
  pz.nombre = nombre;
  if (cortar) pz.cortar = cortar;
  return pz;
}

/** Abertura (sin tela extra) en el centro espalda: margen de 4 cm desde la marca hasta la bastilla. */
function abertura(pz: Pieza, alto: number) {
  const yB = v(pz, "centroBajo").y;
  const n = insertar(pz, "abertura", P(v(pz, "centroBajo").x, yB + alto));
  margenBorde(pz, n, "centroBajo", 4);
  piquete(pz, n);
  pz.marcas.push({ t: "texto", p: P(v(pz, n).x + haciaCostado(pz) * 3, yB + alto - 2), s: "fin de la abertura", h: 0.7 });
}

/** Aletilla de abertura (tela extra que se encima) en el centro espalda. */
function aletilla(pz: Pieza, alto: number, ancho: number) {
  const s = haciaCostado(pz);
  const cb = v(pz, "centroBajo");
  const ab = insertar(pz, "aletillaArriba", P(cb.x, cb.y + alto));
  const [x, y] = corto(pz, ab, "centroBajo");
  // nuevo contorno: … x → (aletilla) → y …
  const i = idx(pz, x);
  const pa = v(pz, ab);
  const ext: V[] = [
    { x: pa.x - s * ancho, y: pa.y - ancho, n: "aletillaPico", m: 1 },
    { x: cb.x - s * ancho, y: cb.y, n: "aletillaBajo", m: 3 },
  ];
  // si el tramo va de la abertura a la bastilla, la aletilla se mete en ese orden; si no, al revés
  if (x === ab) pz.contorno.splice(i + 1, 0, ...ext);
  else {
    ext[0].m = 1;
    ext[1].m = 1;
    pz.contorno.splice(i + 1, 0, { ...ext[1], m: 1 }, { ...ext[0], m: 1 });
    v(pz, "centroBajo").m = 3;
  }
  piquete(pz, ab);
}

/** Lleva cada pinza de cintura hasta la línea de corte de abajo (para canesús). */
function cerrarPinzasEnCorte(pz: Pieza, a: string, b: string): Pieza {
  let r = clonar(pz);
  for (const n of [...pinzasDe(r)].sort().reverse()) {
    const pin = r.pinzas.find((q) => q.apice === n)!;
    const ap = v(r, n);
    const base = P((v(r, pin.a).x + v(r, pin.b).x) / 2, (v(r, pin.a).y + v(r, pin.b).y) / 2);
    let p = cruceConTramo(r, ...corto(r, a, b), ap, dir(base, ap));
    if (!p) continue;
    // lejos de las esquinas, para no confundir el corte con ellas
    const ea = v(r, a);
    const eb = v(r, b);
    if (dist(p, ea) < 0.8) p = suma(ea, escalar(dir(ea, eb), 0.8));
    if (dist(p, eb) < 0.8) p = suma(eb, escalar(dir(eb, ea), 0.8));
    const d = insertar(r, `${n}Canesu`, p);
    r = trasladarPinza(r, n, d, { nombre: `${n}Cerrada` });
    rellenarPinza(r, `${n}Cerrada`);
  }
  return r;
}

/** Cuarto de círculo con la cintura arriba (para faldas circulares). */
function cuartoCirculo(nombre: string, radio: number, largo: number, cortar: string, alDoblez: boolean, costuraCierre = false): Pieza {
  let pz = anillo(nombre, radio, largo, 90, cortar);
  pz = girar(pz, P(0, 0), -Math.PI * 0.75);
  if (alDoblez) doblezBorde(pz, "centroIni", "bordeIni");
  if (costuraCierre) margenBorde(pz, "centroFin", "bordeFin", 1.5);
  // hilo: paralelo al doblez (o a la bisectriz si no hay doblez)
  const a = v(pz, "centroIni");
  const b = v(pz, "bordeIni");
  if (alDoblez) {
    const d = dir(a, b);
    let nrm = perp(d);
    if (!dentro(suma(suma(a, escalar(d, largo * 0.5)), escalar(nrm, 3)), pz.contorno)) nrm = escalar(nrm, -1);
    pz.hilo = [suma(suma(a, escalar(d, largo * 0.3 + radio)), escalar(nrm, 4)), suma(suma(a, escalar(d, largo * 0.7 + radio * 0.5)), escalar(nrm, 4))];
  } else {
    pz.hilo = [P(0, -(radio + largo * 0.3)), P(0, -(radio + largo * 0.75))];
  }
  pz.ancla = P(0, 0);
  pz.marcas.push({ t: "texto", p: P(0, -(radio + largo * 0.8)), s: "Deja colgar 24 h antes de emparejar la bastilla", h: 0.8 });
  return pz;
}

/** Líneas de pliegues sobre un panel rectangular. */
function lineasPliegue(pz: Pieza, alto: number, dobleces: number[], colocacion: number[]) {
  for (const x of dobleces) pz.marcas.push({ t: "linea", pts: [P(x, 0), P(x, alto)], estilo: "pliegue" });
  for (const x of colocacion) pz.marcas.push({ t: "linea", pts: [P(x, 0), P(x, alto)], estilo: "colocacion" });
}

/** Pieza completa (las dos mitades) a partir del delantero al doblez. */
function delanteroCompleto(pz: Pieza): Pieza {
  return completar(pz, ...corto(pz, "centroBajo", "centroCintura"));
}

/** Delantero que cruza el centro hasta `x` (falda cruzada o tulipán), cortado con la línea `interior`. */
function cortarCruce(full: Pieza, x: number, yBajoX: number, interior: (w: Pt, h: Pt) => Pt[]): Pieza {
  const w = insertar(full, "cruceCintura", P(x, 1.5));
  const [h1, h2] = ordenBastilla(full, "costadoBajo", "costadoBajo*");
  const pb = cruceConTramo(full, h1, h2, P(yBajoX, -10), P(0, -1)) ?? P(yBajoX, v(full, "centroBajo").y);
  const h = insertar(full, "cruceBajo", pb);
  const [a, b] = dividir(full, w, h, interior(v(full, w), v(full, h)));
  return tiene(a, "costadoBajo") ? a : b;
}

/** x de las patas de las pinzas reflejadas (las que quedan del otro lado del centro). */
function patasReflejadas(full: Pieza): number[][] {
  return full.pinzas.filter((p) => p.apice.endsWith("*")).map((p) => [v(full, p.a).x, v(full, p.b).x].sort((a, b) => a - b));
}

const largoCircular = (m: Medidas) => m.largoRodilla - 2;

export const FALDAS: Modelo[] = [
  {
    id: "falda-recta",
    categoria: G,
    nombre: "Falda recta",
    descripcion: "Falda de corte recto desde la cadera, con pinzas, cierre y abertura en el centro espalda y pretina.",
    pasos: [
      "Usa la falda base tal cual: el costado baja recto desde la cadera.",
      "Marca la abertura en el centro espalda, 18 cm arriba de la bastilla, y deja 4 cm de margen desde ahí hacia abajo.",
      "Pretina: cintura + 2 cm de holgura + 3 cm de traslape, por 8 cm de ancho (doblada a 4 cm).",
    ],
    telas: "Gabardina, lino, mezclilla delgada, crepé grueso.",
    generar: (m) => {
      const f = faldaBase(m);
      abertura(f.espalda, 18);
      return [f.espalda, f.delantero, pretina(m)];
    },
  },
  {
    id: "falda-lapiz",
    categoria: G,
    nombre: "Falda lápiz (tubo)",
    descripcion: "Falda ajustada que se angosta hacia la bastilla. Lleva aletilla en el centro espalda para poder caminar.",
    pasos: [
      "Parte de la falda base y mete 2.5 cm el costado en la bastilla (delantero y espalda); une recto con la cadera.",
      "En el centro espalda marca 20 cm desde la bastilla y agrega una aletilla de 4 cm con el pico a 45°.",
      "Corta la espalda en par: una aletilla queda encima de la otra.",
    ],
    telas: "Telas con cuerpo y un poco de elasticidad: gabardina stretch, crepé, piqué.",
    generar: (m) => {
      const f = faldaBase(m);
      for (const pz of [f.delantero, f.espalda]) {
        const cb = v(pz, "costadoBajo");
        cb.x -= haciaCostado(pz) * 2.5;
      }
      aletilla(f.espalda, 20, 4);
      return [renombrar(f.espalda, "Falda lápiz espalda"), renombrar(f.delantero, "Falda lápiz delantero"), pretina(m)];
    },
  },
  {
    id: "falda-evase",
    categoria: G,
    nombre: "Falda evasé (línea A)",
    descripcion: "Falda que se abre desde la cadera en forma de A. El vuelo sale de cerrar las pinzas de cintura.",
    pasos: [
      "Corta desde la bastilla hasta la punta de cada pinza siguiendo su línea.",
      "Cierra la pinza más cercana al costado por completo y la otra a la mitad: la bastilla se abre.",
      "Agrega 3 cm de vuelo en el costado, girando desde la cadera para que el costado no cambie de largo.",
      "Empareja la bastilla en curva suave, a escuadra con el centro y con el costado.",
    ],
    telas: "Popelina, lino, gabardina ligera, mezclilla delgada.",
    generar: (m) => {
      const f = faldaBase(m);
      return [renombrar(evase(f.espalda), "Falda evasé espalda"), renombrar(evase(f.delantero), "Falda evasé delantero"), pretina(m)];
    },
  },
  {
    id: "falda-circular",
    categoria: G,
    nombre: "Falda circular",
    descripcion: "Falda de círculo completo con mucho vuelo y sin pinzas. Se corta en dos medios círculos (o cuatro cuartos si la tela no alcanza).",
    pasos: [
      "Radio de cintura = (cintura + 2 cm) ÷ 6.28. Traza un cuarto de círculo con ese radio desde la esquina.",
      "Desde la cintura, mide el largo de la falda para trazar la bastilla, paralela a la cintura.",
      "Si dos veces (radio + largo) cabe en el ancho de la tela, corta 2 piezas al doblez; si no, 4 cuartos con costuras.",
      "Deja colgar la falda 24 horas antes de emparejar la bastilla: el sesgo se estira.",
    ],
    telas: "Telas con caída: crepé, rayón, satén, punto. En telas firmes queda más armada.",
    generar: (m) => {
      const c = cinturaFalda(m);
      const r = c / (2 * Math.PI);
      const L = largoCircular(m);
      const alDoblez = 2 * (r + L) <= 145;
      const cuarto = cuartoCirculo("Falda circular", r, L, alDoblez ? "Cortar 2 al doblez en tela" : "Cortar 4 en tela", alDoblez);
      return [cuarto, pretina(m)];
    },
  },
  {
    id: "falda-media-capa",
    categoria: G,
    nombre: "Falda de media capa (semicircular)",
    descripcion: "Medio círculo: menos vuelo que la circular y más que la evasé. Una sola pieza al doblez con cierre en el centro espalda.",
    pasos: [
      "Radio de cintura = (cintura + 2 cm) ÷ 3.14. Traza un cuarto de círculo con ese radio.",
      "Mide el largo desde la cintura y traza la bastilla paralela.",
      "Corta 1 pieza con un lado al doblez (centro delantero): el otro lado es el centro espalda, con cierre.",
    ],
    telas: "Crepé, rayón, lino ligero, gabardina ligera.",
    generar: (m) => {
      const c = cinturaFalda(m);
      const r = c / Math.PI;
      const pz = cuartoCirculo("Falda media capa", r, largoCircular(m), "Cortar 1 al doblez en tela", true, true);
      return [pz, pretina(m)];
    },
  },
  {
    id: "falda-godets",
    categoria: G,
    nombre: "Falda con godets",
    descripcion: "Falda recta con seis triángulos de tela (godets) insertados en la parte de abajo: ceñida arriba y con movimiento abajo.",
    pasos: [
      "Usa la falda base. Marca 30 cm arriba de la bastilla en los costados y en la línea de la primera pinza.",
      "En la línea de la pinza corta desde la bastilla hasta la marca: ahí entra un godet.",
      "Godet: triángulo con lados de 30 cm y bastilla curva de 26 cm. Cose primero un lado, luego el otro, hasta el piquete.",
    ],
    telas: "Crepé, rayón, punto firme, lino ligero.",
    generar: (m) => {
      const f = faldaBase(m);
      const alto = Math.min(30, f.ref.largo * 0.5);
      for (const pz of [f.delantero, f.espalda]) {
        const cb = v(pz, "costadoBajo");
        piquete(pz, P(cb.x, cb.y + alto));
        const ap = pz.pinzas.length ? v(pz, pz.pinzas[0].apice) : P((v(pz, "centroBajo").x + v(pz, "costadoBajo").x) / 2, 0);
        const yB = v(pz, "centroBajo").y;
        pz.marcas.push({ t: "linea", pts: [P(ap.x, yB), P(ap.x, yB + alto)], estilo: "colocacion" });
        pz.marcas.push({ t: "texto", p: P(ap.x + haciaCostado(pz) * 2.5, yB + alto + 1.5), s: "corta aquí: godet", h: 0.7 });
        pz.marcas.push({ t: "taladro", p: P(ap.x, yB + alto) });
      }
      return [f.espalda, f.delantero, godet(alto, 26), pretina(m)];
    },
  },
  {
    id: "falda-tableada",
    categoria: G,
    nombre: "Falda tableada (tablones)",
    descripcion: "Falda de rectángulos con tablones encontrados: cajas planas por el derecho que se abren al caminar.",
    pasos: [
      "Cada tablón usa 3 veces su ancho: el frente visible y dos dobleces de medio ancho que se juntan por el revés.",
      "Divide la mitad de la cintura (+1 cm) entre los tablones de cada panel, de unos 9 cm cada uno.",
      "Corta dos rectángulos de 3 × (cintura + 2) ÷ 2 de ancho por el largo de la falda.",
      "Dobla cada línea ─·─ y llévala sobre la línea - - - más cercana; hilvana arriba y plancha.",
    ],
    telas: "Telas que marcan bien el planchado: gabardina, lana, poliéster, cuadros escoceses.",
    generar: (m) => {
      const c = cinturaFalda(m) / 2;
      const K = Math.max(3, Math.round(c / 9));
      const fz = c / K;
      const L = m.largoRodilla - 4;
      const piezas = ["Panel delantero", "Panel espalda"].map((n, i) => {
        const pz = panel(n, 3 * fz * K, L, i === 0 ? "Cortar 1 en tela" : "Cortar 1 en tela (cierre en el costado izquierdo)");
        const dobleces: number[] = [];
        const coloc: number[] = [];
        for (let k = 0; k < K; k++) {
          dobleces.push(3 * fz * k + fz, 3 * fz * k + 2 * fz);
          if (k > 0) coloc.push(3 * fz * k);
        }
        lineasPliegue(pz, L, dobleces, coloc);
        pz.marcas.push({ t: "texto", p: P(1.5 * fz, L - 3), s: `Tablones de ${fz.toFixed(1)} cm`, h: 0.8 });
        return pz;
      });
      return [...piezas, pretina(m)];
    },
  },
  {
    id: "falda-plisada",
    categoria: G,
    nombre: "Falda plisada",
    descripcion: "Falda de rectángulos con pliegues angostos (de unos 4 cm) todos hacia el mismo lado.",
    pasos: [
      "Cada pliegue usa 3 veces su ancho visible: 1 de frente y 2 que se meten debajo.",
      "Divide la mitad de la cintura (+1 cm) entre pliegues de unos 4 cm.",
      "Corta dos rectángulos de 3 × (cintura + 2) ÷ 2 por el largo; marca dobleces y colocaciones.",
      "Lleva cada línea de doblez sobre la siguiente línea de colocación, siempre hacia el mismo lado, y plancha.",
    ],
    telas: "Poliéster, gasa de poliéster o telas que guarden el plisado.",
    generar: (m) => {
      const c = cinturaFalda(m) / 2;
      const K = Math.max(6, Math.round(c / 4));
      const fz = c / K;
      const L = m.largoRodilla - 4;
      const piezas = ["Panel delantero", "Panel espalda"].map((n) => {
        const pz = panel(n, 3 * fz * K, L, "Cortar 1 en tela");
        const dobleces: number[] = [];
        const coloc: number[] = [];
        for (let k = 0; k < K; k++) {
          coloc.push(3 * fz * k + fz);
          if (k < K - 1) dobleces.push(3 * fz * (k + 1));
        }
        lineasPliegue(pz, L, dobleces, coloc);
        pz.marcas.push({ t: "texto", p: P(4 * fz, L - 3), s: `Pliegues de ${fz.toFixed(1)} cm hacia el mismo lado`, h: 0.8 });
        return pz;
      });
      return [...piezas, pretina(m)];
    },
  },
  {
    id: "falda-nesgas",
    categoria: G,
    nombre: "Falda de nesgas (6 piezas)",
    descripcion: "Falda armada con paneles verticales (nesgas) que se abren hacia la bastilla. Las pinzas quedan escondidas en las costuras.",
    pasos: [
      "Corta delantero y espalda por la línea de la primera pinza, hasta la bastilla.",
      "Junta las dos pinzas en esa costura: la costura entra curva de la cintura a la cadera.",
      "Desde la cadera, agrega 6 cm de vuelo a cada lado de cada costura y en los costados.",
      "Empareja las bastillas a escuadra con las costuras.",
    ],
    telas: "Lino, gabardina ligera, crepé, mezclilla delgada.",
    generar: (m) => {
      const f = faldaBase(m);
      const [cd, ld] = nesgas(f.delantero, m, { vuelo: 6 });
      const [ce, le] = nesgas(f.espalda, m, { vuelo: 6 });
      return [
        renombrar(cd, "Nesga centro delantero", "Cortar 1 al doblez en tela"),
        renombrar(ld, "Nesga costado delantero", "Cortar 2 en tela (un par)"),
        renombrar(le, "Nesga costado espalda", "Cortar 2 en tela (un par)"),
        renombrar(ce, "Nesga centro espalda", "Cortar 2 en tela (un par)"),
        pretina(m),
      ];
    },
  },
  {
    id: "falda-canesu",
    categoria: G,
    nombre: "Falda con canesú y frunces",
    descripcion: "Canesú ajustado a la cadera (sin pinzas) y falda fruncida debajo.",
    pasos: [
      "Traza la línea del canesú justo debajo de la punta de las pinzas (unos 10 cm al frente y 15 cm atrás).",
      "Corta por esa línea y cierra las pinzas del canesú llevándolas hasta el corte.",
      "La falda de abajo es un rectángulo 1.6 veces el ancho del canesú: se frunce hasta medirlo.",
      "Corta el canesú doble: una pieza es la vista.",
    ],
    telas: "Popelina, batista, lino, rayón.",
    generar: (m) => {
      const f = faldaBase(m);
      const piezas: Pieza[] = [];
      const lados: [Pieza, string, string][] = [
        [f.delantero, "delantero", "al doblez"],
        [f.espalda, "espalda", "par"],
      ];
      for (const [pz, nombre, tipo] of lados) {
        const largoPinza = Math.max(...pinzasDe(pz).map((n) => -v(pz, n).y));
        const y = -(largoPinza + 0.8);
        const c = insertar(pz, "canesuCentro", P(v(pz, "centroBajo").x, y));
        const pl = puntoEnY(pz, ...ordenCostado(pz, "costadoCintura", "cadera"), y)!;
        const l = insertar(pz, "canesuCostado", pl);
        const [a, b] = dividir(pz, c, l, []);
        const arriba = tiene(a, "centroCintura") ? a : b;
        const abajo = tiene(a, "centroCintura") ? b : a;
        const canesu = cerrarPinzasEnCorte(arriba, c, l);
        canesu.nombre = `Canesú ${nombre}`;
        canesu.cortar = tipo === "al doblez" ? "Cortar 2 al doblez (canesú y vista) y 1 en entretela" : "Cortar 4 en tela (2 de canesú y 2 de vista)";
        const ancho = dist(v(canesu, c), v(canesu, l));
        const alto = Math.abs(v(abajo, "centroBajo").y - y);
        const falda = panel(`Falda ${nombre}`, ancho * 1.6, alto, tipo === "al doblez" ? "Cortar 1 al doblez en tela" : "Cortar 2 en tela (un par)");
        if (tipo === "al doblez") doblezBorde(falda, "d", "a");
        falda.marcas.push({ t: "texto", p: P(ancho * 0.8, alto - 2.5), s: `Frunce hasta ${ancho.toFixed(1)} cm`, h: 0.8 });
        piquete(falda, P(ancho * 0.8, alto));
        piezas.push(canesu, falda);
      }
      return piezas;
    },
  },
  {
    id: "falda-globo",
    categoria: G,
    nombre: "Falda globo",
    descripcion: "Falda abombada: la tela de afuera es más larga y ancha y se frunce arriba y abajo sobre un forro recto más corto.",
    pasos: [
      "Forro: la falda base 4 cm más corta.",
      "Falda de afuera: rectángulos 1.8 veces la cadera de ancho y 14 cm más largos que el forro.",
      "Frunce la falda de afuera en la cintura y en la bastilla; cose la bastilla de afuera a la del forro para formar el globo.",
    ],
    telas: "Tafeta, organza, popelina firme, satén duquesa.",
    generar: (m) => {
      const L = m.largoRodilla - 8;
      const f = faldaBase(m, { largo: L });
      const ancho = 0.45 * (m.cadera + 4);
      const alto = L + 14;
      const fuera = [
        panel("Globo delantero", ancho, alto, "Cortar 1 al doblez en tela", 1),
        panel("Globo espalda", ancho, alto, "Cortar 2 en tela (un par)", 1),
      ];
      doblezBorde(fuera[0], "d", "a");
      for (const p of fuera) p.marcas.push({ t: "texto", p: P(ancho / 2, alto - 4), s: "Frunce arriba y abajo", h: 0.9 });
      return [renombrar(f.espalda, "Forro espalda", "Cortar 2 en forro (un par)"), renombrar(f.delantero, "Forro delantero", "Cortar 1 al doblez en forro"), ...fuera, pretina(m)];
    },
  },
  {
    id: "falda-tulipan",
    categoria: G,
    nombre: "Falda tulipán",
    descripcion: "Dos delanteros que se cruzan con la orilla en curva, como pétalos. Se abre un poco al frente en la bastilla.",
    pasos: [
      "Dibuja el delantero completo (las dos mitades).",
      "Marca en la cintura un punto pasando el centro, entre las pinzas del otro lado.",
      "Traza una curva desde ese punto hasta la bastilla, 15% antes del centro de tu lado.",
      "Corta por la curva: es un pétalo. Corta en par y pon vista en la orilla curva.",
    ],
    telas: "Telas con cuerpo: tafeta, gabardina ligera, crepé grueso, satén.",
    generar: (m) => {
      const f = faldaBase(m);
      const full = delanteroCompleto(f.delantero);
      const patas = patasReflejadas(full).sort((a, b) => a[0] - b[0]);
      const anchoBajo = Math.abs(v(full, "costadoBajo").x);
      const x = patas.length > 1 ? (patas[0][1] + patas[1][0]) / 2 : (patas[0]?.[1] ?? 6) + 3;
      const yB = v(full, "centroBajo").y;
      let petalo = cortarCruce(full, x, -0.15 * anchoBajo, (w, h) => curva(w, P(-0.1, -1), h, P(-1, -0.7), 0.35, 0.75).slice(1, -1));
      petalo = renombrar(petalo, "Delantero tulipán", "Cortar 2 en tela (un par)");
      petalo.ancla = P(0, 0);
      void yB;
      const vt = vista(petalo, ...corto(petalo, "cruceCintura", "cruceBajo"), 4, "Vista del pétalo", "Cortar 2 en tela (un par) y 2 en entretela");
      return [f.espalda, petalo, vt, pretina(m)];
    },
  },
  {
    id: "falda-sirena",
    categoria: G,
    nombre: "Falda sirena",
    descripcion: "Ajustada de la cintura a la rodilla y con mucho vuelo de la rodilla hacia abajo. Hecha de seis nesgas.",
    pasos: [
      "Alarga la falda base a media pantorrilla y córtala en nesgas por la línea de la primera pinza.",
      "Mete 1.5 cm cada costura a la altura de la rodilla para ceñir.",
      "Desde la rodilla, abre 12 cm a cada lado de cada costura y en los costados.",
      "Empareja las bastillas en curva a escuadra con las costuras.",
    ],
    telas: "Crepé, satén con caída, punto grueso, tafeta para vestir de noche.",
    generar: (m) => {
      const L = m.largoRodilla + 28;
      const f = faldaBase(m, { largo: L });
      const yR = -(m.largoRodilla - 2);
      const op = { vuelo: 12, yVuelo: yR, entalle: 1.5 };
      const [cd, ld] = nesgas(f.delantero, m, op);
      const [ce, le] = nesgas(f.espalda, m, op);
      return [
        renombrar(cd, "Sirena centro delantero", "Cortar 1 al doblez en tela"),
        renombrar(ld, "Sirena costado delantero", "Cortar 2 en tela (un par)"),
        renombrar(le, "Sirena costado espalda", "Cortar 2 en tela (un par)"),
        renombrar(ce, "Sirena centro espalda", "Cortar 2 en tela (un par)"),
        pretina(m),
      ];
    },
  },
  {
    id: "falda-cruzada",
    categoria: G,
    nombre: "Falda cruzada (envolvente)",
    descripcion: "Falda en A que se envuelve al cuerpo: dos delanteros que se cruzan y se amarran con lazos. Sin cierre.",
    pasos: [
      "Haz la falda evasé y dibuja el delantero completo.",
      "Cada delantero pasa del centro hasta después de las pinzas del otro lado (unos 15 cm).",
      "La orilla del cruce lleva 3 cm de margen para doblar como vista.",
      "Espalda al doblez. Pretina del largo de la cintura más el cruce, y dos lazos de 60 cm.",
    ],
    telas: "Lino, rayón, popelina, crepé, mezclilla ligera.",
    generar: (m) => {
      const f = faldaBase(m);
      const del = evase(f.delantero, { vuelo: 3 });
      const esp = evase(f.espalda, { vuelo: 3 });
      const full = delanteroCompleto(del);
      const patas = patasReflejadas(full);
      const x = (patas.length ? Math.max(...patas.flat()) : 8) + 3;
      const cruce = cortarCruce(full, x, x, () => []);
      margenBorde(cruce, ...corto(cruce, "cruceCintura", "cruceBajo"), 3);
      renombrar(cruce, "Delantero cruzado", "Cortar 2 en tela (un par)");
      cruce.ancla = P(0, 0);
      // espalda al doblez, sin cierre
      doblezBorde(esp, "centroCintura", "centroBajo");
      esp.marcas = esp.marcas.filter((q) => q.t !== "texto");
      renombrar(esp, "Espalda", "Cortar 1 al doblez en tela");
      const lazo = rectangulo("Lazo", 60, 8, "Cortar 2 en tela", { dobladoAlCentro: true });
      return [esp, cruce, pretina(m, { cruce: 2 * x, nombre: "Pretina cruzada" }), lazo];
    },
  },
  {
    id: "falda-escalonada",
    categoria: G,
    nombre: "Falda escalonada (de olanes)",
    descripcion: "Tres tiras rectangulares, cada una 1.5 veces más ancha que la de arriba, fruncidas y unidas. Cintura con elástico.",
    pasos: [
      "Primera tira: 1.25 veces la cadera de ancho; cada tira siguiente es 1.5 veces la anterior.",
      "Reparte el largo en 27%, 33% y 40% de arriba hacia abajo.",
      "Frunce cada tira y cósela a la de arriba. La cintura es una jareta con elástico de 2.5 cm.",
    ],
    telas: "Batista, gasa de algodón, popelina ligera, rayón.",
    generar: (m) => {
      const L = m.largoRodilla + 10;
      const anchos = [1.25 * (m.cadera + 4)];
      anchos.push(anchos[0] * 1.5, anchos[0] * 2.25);
      const altos = [0.27 * L, 0.33 * L, 0.4 * L];
      const tiras = anchos.map((a, i) => {
        const pz = panel(`Tira ${i + 1}`, a / 2, altos[i], "Cortar 2 en tela", i === 2 ? 2 : 1);
        if (i > 0) pz.marcas.push({ t: "texto", p: P(a / 4, altos[i] - 2.5), s: `Frunce hasta ${(anchos[i - 1] / 2).toFixed(1)} cm`, h: 0.9 });
        return pz;
      });
      const jareta = rectangulo("Jareta de cintura", m.cadera + 6, 7, "Cortar 1 en tela", { dobladoAlCentro: true });
      jareta.marcas.push({ t: "texto", p: P((m.cadera + 6) / 2, 5), s: `Elástico de 2.5 cm: ${(m.cintura - 4).toFixed(0)} cm`, h: 0.8 });
      jareta.hilo = [P(4, 1.5), P(4, 5.5)];
      return [...tiras, jareta];
    },
  },
  {
    id: "falda-al-bies",
    categoria: G,
    nombre: "Falda al bies",
    descripcion: "Falda en A sin pinzas cortada al sesgo (45°): se pega al cuerpo y cae con movimiento. Cintura con vista.",
    pasos: [
      "Cierra por completo las dos pinzas de cintura llevándolas a la bastilla y agrega 5 cm de vuelo en el costado.",
      "Dibuja el delantero completo; la línea de hilo va a 45° del centro.",
      "Vistas de cintura de 5 cm en lugar de pretina; cierre invisible en el centro espalda.",
      "Deja colgar 24 h antes de emparejar la bastilla.",
    ],
    telas: "Satén, crepé de china, charmeuse, rayón, seda.",
    generar: (m) => {
      const f = faldaBase(m);
      const del = delanteroCompleto(evase(f.delantero, { vuelo: 5, fraccion: 1 }));
      const esp = evase(f.espalda, { vuelo: 5, fraccion: 1 });
      del.hilo = hiloVertical(del, Math.PI / 4);
      esp.hilo = hiloVertical(esp, Math.PI / 4);
      renombrar(del, "Delantero al bies", "Cortar 1 al bies en tela");
      renombrar(esp, "Espalda al bies", "Cortar 2 al bies en tela (un par)");
      del.ancla = P(0, 0);
      const vd = vista(del, ...ordenCintura(del, "costadoCintura", "costadoCintura*"), 5, "Vista cintura delantera", "Cortar 1 en tela y 1 en entretela");
      const ve = vista(esp, ...ordenCintura(esp, "costadoCintura", "centroCintura"), 5, "Vista cintura espalda", "Cortar 2 en tela y 2 en entretela");
      return [esp, del, ve, vd];
    },
  },
];

void abrirPinzaAlBajo;
