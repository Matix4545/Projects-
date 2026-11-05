// Tipos de pantalón: todos salen del pantalón base (bases/pantalon.ts).
import { P } from "../geometria.ts";
import type { Medidas } from "../medidas.ts";
import { type Pantalon, pantalonBase } from "../bases/pantalon.ts";
import { rectangulo } from "../bases/utiles.ts";
import { type Pieza, abrir, clonar, corto, insertar, margenBorde, piquete, v } from "../pieza.ts";
import {
  igualar,
  bolsilloSesgado,
  bolsilloTrasero,
  bragueta,
  cambiarPierna,
  cinturaElastica,
  cinturas,
  colocar,
  largoTobillo,
  partes,
  pretina,
  pretinaCurva,
  pretinaElastica,
  puntoEnAltura,
  raya,
} from "./ayuda-pantalones.ts";
import type { Modelo } from "./tipos.ts";

// ── Ayudas locales ───────────────────────────────────────────────────────────

/** Pantalón base con la espalda rectificada (costado igual, entrepierna 0.3 cm menor). */
function base(m: Medidas, o: Parameters<typeof pantalonBase>[1] = {}): Pantalon {
  const b = pantalonBase(m, o);
  return { ...b, espalda: igualar(b.delantero, b.espalda) };
}

/** Punto del costado a la altura y (sirve para delantero y espalda). */
function costadoEn(pz: Pieza, y: number) {
  const [a, b] = corto(pz, "costadoCintura", "costadoBajo");
  return puntoEnAltura(pz, a, b, y);
}

/** Pierna recta desde la cadera y el tiro, con `abreLado`/`abreEntre` cm de vuelo en la bastilla. */
function piernaRecta(pz: Pieza, yBajo: number, abreLado: number, abreEntre: number): Pieza {
  const p = partes(pz);
  const C = p.arriba[p.arriba.length - 1];
  const T = p.pierna[p.pierna.length - 1];
  return cambiarPierna(pz, { yBajo, bajo: { lado: C.x - p.s * abreLado, entre: T.x + p.s * abreEntre } });
}

/** Pierna con ancho de rodilla y bastilla repartidos a cada lado de la raya (como el base). */
function piernaPorRaya(pz: Pieza, xRaya: number, esEspalda: boolean, yBajo: number, bastilla: number, rodilla?: { y: number; total: number }): Pieza {
  const s = partes(pz).s;
  const medio = (total: number) => total / 4 + (esEspalda ? 1 : -1);
  const hb = medio(bastilla);
  return cambiarPierna(pz, {
    yBajo,
    bajo: { lado: xRaya - s * hb, entre: xRaya + s * hb },
    rodilla: rodilla ? { y: rodilla.y, lado: xRaya - s * medio(rodilla.total), entre: xRaya + s * medio(rodilla.total) } : undefined,
  });
}

function marcarRayas(b: Pantalon, d: Pieza, e: Pieza, yBajo: number) {
  raya(d, b.ref.rayaDelantero, b.ref.cadera, yBajo);
  raya(e, b.ref.rayaEspalda, b.ref.tiro, yBajo);
}

/** Pretina, vista y pie de bragueta y bolsillos sesgados sobre un pantalón con cintura de pinzas. */
function terminarConBragueta(e: Pieza, d: Pieza, o: { bolsillos?: boolean; alto?: number } = {}): Pieza[] {
  const c = cinturas(d, e);
  const del = clonar(d);
  const brag = bragueta(del);
  const piezas: Pieza[] = [];
  if (o.bolsillos) {
    const b = bolsilloSesgado(del);
    piezas.push(e, b.delantero, pretina(c.d, c.e, o.alto ?? 4), ...brag, b.bolsa, b.costadillo);
  } else {
    piezas.push(e, del, pretina(c.d, c.e, o.alto ?? 4), ...brag);
  }
  return piezas;
}

/** Quita la pinza delantera: su abertura queda en la cintura (para convertirla en pliegue). */
function sinPinza(pz: Pieza): Pieza {
  const r = clonar(pz);
  const pin = r.pinzas.find((q) => q.apice === "pinza");
  if (!pin) return r;
  r.contorno = r.contorno.filter((q) => q.n !== pin.apice);
  r.pinzas = r.pinzas.filter((q) => q !== pin);
  return r;
}

function bolsillosTraseros(e: Pieza, ancho = 14, alto = 15) {
  const kc = v(e, "costadoCintura");
  const cc = v(e, "centroCintura");
  const mx = (kc.x + cc.x) / 2;
  const my = (kc.y + cc.y) / 2;
  colocar(e, P(mx - ancho / 2, my - 6), ancho, alto, "bolsillo trasero");
}

const tobillo = (m: Medidas) => largoTobillo(m);

// ── Modelos ──────────────────────────────────────────────────────────────────

export const PANTALONES: Modelo[] = [
  {
    id: "pantalon-recto",
    categoria: "pantalones",
    nombre: "Pantalón recto con bragueta",
    descripcion: "El clásico de vestir: pierna recta, pinzas, pretina con cruce, bragueta con cierre y bolsillos sesgados.",
    telas: "Gabardina, lino, dril, casimir ligero o tencel.",
    pasos: [
      "Parte del pantalón base al tobillo.",
      "Bragueta: vista de 4 cm de ancho por el largo del cierre (18 cm) + 1.5 cm, y pie de bragueta doblado de 3.5 cm.",
      "Bolsillo sesgado: marca 4 cm en la cintura desde el costado y 17 cm en el costado; une con una curva suave y recorta la esquina.",
      "Costadillo y bolsa siguen el costado hasta 26 cm de fondo; la bolsa llega 12 cm hacia el centro.",
      "Pretina en dos mitades unidas en el centro espalda: media cintura terminada + 3.5 cm de cruce, de 4 cm de alto (8 cm doblada).",
    ],
    generar: (m) => {
      const b = base(m);
      return terminarConBragueta(b.espalda, b.delantero, { bolsillos: true });
    },
  },
  {
    id: "pantalon-pitillo",
    categoria: "pantalones",
    nombre: "Pantalón pitillo (skinny)",
    descripcion: "Ajustado de la cadera al tobillo. Solo funciona en tela con elastano (2 a 5 %), porque casi no lleva holgura.",
    telas: "Mezclilla stretch, gabardina stretch o bengalina (con 2–5 % de elastano).",
    pasos: [
      "Traza el pantalón base sin holgura en cadera ni cintura: la elasticidad de la tela da la comodidad.",
      "Rodilla: contorno de rodilla + 1 cm; bastilla: tobillo + 5 cm (lo justo para que pase el pie).",
      "Bragueta, pretina con cruce y bolsillos traseros de parche estilo jean.",
      "Prueba en manta con elastano antes de cortar: si la tela estira menos de 2 %, suma 2 cm de holgura en cadera.",
    ],
    generar: (m) => {
      const b = base(m, { holguraCadera: 0, holguraCintura: 0, rodilla: m.rodilla + 1, bastilla: m.tobillo + 5 });
      const e = clonar(b.espalda);
      bolsillosTraseros(e);
      return [...terminarConBragueta(e, b.delantero, { bolsillos: true }), bolsilloTrasero()];
    },
  },
  {
    id: "pantalon-palazzo",
    categoria: "pantalones",
    nombre: "Pantalón palazzo",
    descripcion: "Pierna muy amplia que cae recta desde la cadera hasta el piso, de cintura alta con pretina en curva.",
    telas: "Crepé, rayón, lino, tencel o satín pesado: telas con buena caída.",
    pasos: [
      "Del pantalón base, baja el costado recto desde la cadera y la entrepierna recta desde el tiro.",
      "Abre 6 cm de vuelo en la bastilla en el costado y en la entrepierna.",
      "Alarga hasta casi el piso (para usar con tacón).",
      "Pretina en curva de 6 cm de alto: la orilla de arriba se abre 1.5 cm por pieza para seguir el cuerpo.",
    ],
    generar: (m) => {
      const b = base(m, { holguraCadera: 6 });
      const yB = -(m.tiro + m.largoPierna - 1);
      const d = piernaRecta(b.delantero, yB, 6, 6);
      const e = igualar(d, piernaRecta(b.espalda, yB, 6, 6));
      marcarRayas(b, d, e, yB);
      const c = cinturas(d, e);
      const del = clonar(d);
      const brag = bragueta(del);
      return [
        e,
        del,
        pretinaCurva("Pretina alta delantera", c.d, 6, 1.5, false),
        pretinaCurva("Pretina alta trasera", c.e, 6, 1.5, false),
        ...brag,
      ];
    },
  },
  {
    id: "pantalon-campana",
    categoria: "pantalones",
    nombre: "Pantalón acampanado",
    descripcion: "Ajustado del muslo a la rodilla y con vuelo desde la rodilla hasta la bastilla.",
    telas: "Mezclilla, gabardina o crepé con algo de elastano.",
    pasos: [
      "Pantalón base con poca holgura de cadera (3 cm).",
      "Cierra la rodilla: contorno de rodilla + 5 cm.",
      "Abre la bastilla: rodilla + 19 cm (unos 20 cm más que un recto) y alarga hasta el piso.",
      "Une rodilla y bastilla con líneas rectas para que el vuelo empiece en la rodilla.",
    ],
    generar: (m) => {
      const b = base(m, { holguraCadera: 3, rodilla: m.rodilla + 5, bastilla: m.rodilla + 24, largo: m.tiro + m.largoPierna - 1 });
      return terminarConBragueta(b.espalda, b.delantero);
    },
  },
  {
    id: "pantalon-culotte",
    categoria: "pantalones",
    nombre: "Pantalón culotte",
    descripcion: "Pantalón amplio a media pantorrilla con piernas en línea A; parece falda al caminar.",
    telas: "Lino, crepé, gabardina ligera o popelina.",
    pasos: [
      "Del pantalón base, corta a media pantorrilla (rodilla + 14 cm).",
      "Baja el costado recto desde la cadera y abre 7 cm en la bastilla.",
      "Baja la entrepierna recta desde el tiro y abre 5 cm en la bastilla.",
      "Bastilla de 3 cm, pretina con cruce y bragueta.",
    ],
    generar: (m) => {
      const b = base(m, { holguraCadera: 6 });
      const yB = -(m.largoRodilla + 14);
      const d = piernaRecta(b.delantero, yB, 7, 5);
      const e = igualar(d, piernaRecta(b.espalda, yB, 7, 5));
      marcarRayas(b, d, e, yB);
      return terminarConBragueta(e, d);
    },
  },
  {
    id: "pantalon-jogger",
    categoria: "pantalones",
    nombre: "Pantalón jogger",
    descripcion: "Deportivo de cintura elástica con cordón, pierna que se angosta y puños de punto en el tobillo.",
    telas: "Felpa, french terry, punto grueso o gabardina ligera; puños de resorte (rib).",
    pasos: [
      "Pantalón base con 8 cm de holgura de cadera para moverse.",
      "Quita las pinzas y sube el costado y el centro rectos desde la cadera: la cintura debe pasar por la cadera.",
      "Angosta la bastilla a tobillo + 12 cm y acorta 3 cm (el puño completa el largo).",
      "Pretina elástica en dos mitades (delantera y trasera) con dos ojales al frente para el cordón.",
      "Puños de resorte: 80 % de la bastilla por 7 cm de alto (14 cm doblados).",
    ],
    generar: (m) => {
      const bast = m.tobillo + 12;
      const b = base(m, { holguraCadera: 8, rodilla: m.rodilla + 8, bastilla: bast, largo: tobillo(m) - 3 });
      const d = cinturaElastica(b.delantero);
      const e = igualar(d, cinturaElastica(b.espalda));
      margenBorde(d, "costadoBajo", "entrepiernaBajo", 1);
      margenBorde(e, "costadoBajo", "entrepiernaBajo", 1);
      const c = cinturas(d, e);
      const bol = bolsilloSesgado(d);
      const puno = rectangulo("Puño", Math.round(bast * 0.8), 14, "Cortar 2 en tela de resorte (rib)", { dobladoAlCentro: true });
      return [e, bol.delantero, pretinaElastica(2 * (c.d + c.e), 4), puno, bol.bolsa, bol.costadillo];
    },
  },
  {
    id: "pantalon-pinzas",
    categoria: "pantalones",
    nombre: "Pantalón con pliegues",
    descripcion: "Pantalón de vestir con dos pliegues al frente que dan amplitud en la cadera y caen sobre la raya.",
    telas: "Lino, casimir, gabardina, tencel o crepé.",
    pasos: [
      "Pantalón base con 6 cm de holgura de cadera; la pinza delantera se deja abierta: se vuelve parte del primer pliegue.",
      "Corta por la raya de la cintura a la bastilla y separa 2.5 cm en paralelo (primer pliegue).",
      "A 4 cm hacia el costado corta otra vez de la cintura a la bastilla y abre 2.5 cm solo en la cintura (segundo pliegue).",
      "Marca los pliegues hacia el costado; la cintura con pliegues cerrados mide lo mismo que la del base.",
      "Pretina, bragueta y bolsillos sesgados.",
    ],
    generar: (m) => {
      const b = base(m, { holguraCadera: 6, bastilla: Math.round(m.cadera * 0.44) });
      const xr = b.ref.rayaDelantero;
      let d = sinPinza(b.delantero);
      const yW = (v(d, "pinzaA").y + v(d, "pinzaB").y) / 2;
      const p1 = insertar(d, "pliegue1", P(xr, yW));
      const r1 = insertar(d, "raya", P(xr, b.ref.bajo));
      d = abrir(d, p1, r1, 2.5, { paralelo: true });
      const p2 = insertar(d, "pliegue2", P(xr - 4, yW + 0.15));
      const r2 = insertar(d, "raya2", P(xr - 4, b.ref.bajo));
      d = abrir(d, p2, r2, 2.5);
      // la raya del delantero queda en el primer corte
      raya(d, (v(d, "raya").x + v(d, "raya'").x) / 2, b.ref.cadera, b.ref.bajo);
      // marcas de pliegue: de cada orilla, 8 cm hacia abajo
      for (const n of ["pinzaA", "pinzaB", "pliegue2", "pliegue2'"]) {
        const q = v(d, n);
        d.marcas.push({ t: "linea", pts: [P(q.x, q.y), P(q.x, q.y - 8)], estilo: "pliegue" });
        piquete(d, n);
      }
      d.marcas.push({ t: "texto", p: P(xr - 2, yW - 10), s: "pliegues hacia el costado", h: 0.6 });
      return terminarConBragueta(b.espalda, d, { bolsillos: true });
    },
  },
  {
    id: "pantalon-cargo",
    categoria: "pantalones",
    nombre: "Pantalón cargo",
    descripcion: "Pantalón recto y holgado con bolsillos de parche con fuelle y cartera a los lados de la pierna y bolsillos traseros.",
    telas: "Dril, gabardina, ripstop o lona ligera.",
    pasos: [
      "Pantalón base con 6 cm de holgura de cadera y pierna un poco más ancha.",
      "Marca el bolsillo lateral sobre la costura del costado, 4 cm abajo del tiro: 9 cm hacia el delantero y 9 cm hacia la espalda, por 20 cm de alto.",
      "Bolsillo de 22 × 20 cm con un fuelle (pliegue encontrado) de 4 cm al centro; cartera de 19 × 7 cm encima.",
      "Bolsillos traseros de parche, bragueta, pretina y bolsillos sesgados al frente.",
    ],
    generar: (m) => {
      const b = base(m, { holguraCadera: 6, bastilla: Math.round(m.cadera * 0.44) });
      const e = clonar(b.espalda);
      const d0 = clonar(b.delantero);
      const yTop = b.ref.tiro - 4;
      const ld = costadoEn(d0, yTop);
      const le = costadoEn(e, yTop);
      colocar(d0, P(ld.x + 0.5, yTop), 9, 20, "bolsillo cargo");
      colocar(e, P(le.x - 9.5, yTop), 9, 20, "bolsillo cargo");
      d0.marcas.push({ t: "linea", pts: [P(ld.x + 0.5, yTop + 2), P(ld.x + 10, yTop + 2)], estilo: "colocacion" });
      e.marcas.push({ t: "linea", pts: [P(le.x - 10, yTop + 2), P(le.x - 0.5, yTop + 2)], estilo: "colocacion" });
      bolsillosTraseros(e);
      const bolsa = rectangulo("Bolsillo cargo", 22, 23, "Cortar 2 en tela");
      margenBorde(bolsa, "c", "d", 3);
      for (const x of [9, 11, 13]) bolsa.marcas.push({ t: "linea", pts: [P(x, 0), P(x, 23)], estilo: "pliegue" });
      const cartera = rectangulo("Cartera", 19, 14, "Cortar 2 en tela y 2 en entretela", { dobladoAlCentro: true });
      cartera.marcas.push({ t: "ojal", p: P(9.5, 2.2), ang: Math.PI / 2, l: 2 });
      return [...terminarConBragueta(e, d0, { bolsillos: true }), bolsa, cartera, bolsilloTrasero()];
    },
  },
  {
    id: "pantalon-short",
    categoria: "pantalones",
    nombre: "Short con vuelta",
    descripcion: "Short de 7 cm de entrepierna con vuelta (valenciana) de 3 cm en la bastilla.",
    telas: "Dril, mezclilla ligera, lino o gabardina.",
    pasos: [
      "Pantalón base con 5 cm de holgura de cadera; corta a 7 cm abajo del tiro.",
      "Costado: baja recto desde la cadera y abre 1 cm en la bastilla.",
      "Entrepierna: mete 1.5 cm en el delantero y 3 cm en la espalda para que la pierna no se abra atrás.",
      "Bastilla de 7 cm: dobla 1 cm, luego 3 cm, y voltea 3 cm hacia afuera para la vuelta.",
      "Pretina, bragueta y bolsillos sesgados (más cortos).",
    ],
    generar: (m) => {
      const b = base(m, { holguraCadera: 5 });
      const yB = b.ref.tiro - 7;
      const pD = partes(b.delantero);
      const pE = partes(b.espalda);
      const cD = pD.arriba[pD.arriba.length - 1];
      const tD = pD.pierna[pD.pierna.length - 1];
      const cE = pE.arriba[pE.arriba.length - 1];
      const tE = pE.pierna[pE.pierna.length - 1];
      const d = cambiarPierna(b.delantero, { yBajo: yB, bajo: { lado: cD.x - pD.s * 1, entre: tD.x - pD.s * 1.5 } });
      const e = igualar(d, cambiarPierna(b.espalda, { yBajo: yB, bajo: { lado: cE.x - pE.s * 1, entre: tE.x - pE.s * 3 } }));
      margenBorde(d, "costadoBajo", "entrepiernaBajo", 7);
      margenBorde(e, "costadoBajo", "entrepiernaBajo", 7);
      marcarRayas(b, d, e, yB);
      const c = cinturas(d, e);
      const del = clonar(d);
      const brag = bragueta(del);
      const bol = bolsilloSesgado(del, { bajada: 15, fondo: Math.min(22, -yB - 6) });
      return [e, bol.delantero, pretina(c.d, c.e), ...brag, bol.bolsa, bol.costadillo];
    },
  },
  {
    id: "pantalon-bermuda",
    categoria: "pantalones",
    nombre: "Bermuda",
    descripcion: "Pantalón corto a la rodilla, de pierna recta y holgada.",
    telas: "Dril, lino, gabardina o mezclilla ligera.",
    pasos: [
      "Pantalón base con 5 cm de holgura de cadera; corta 2 cm abajo de la línea de rodilla.",
      "La bastilla mide el ancho de rodilla del base + 4 cm, repartido a cada lado de la raya (la espalda 1 cm más por lado).",
      "Costado y entrepierna rectos de la cadera y del tiro a la bastilla.",
      "Bastilla de 4 cm, pretina, bragueta y bolsillos sesgados.",
    ],
    generar: (m) => {
      const b = base(m, { holguraCadera: 5 });
      const yB = -(m.largoRodilla + 2);
      const bast = Math.round(m.cadera * 0.42) + 8;
      const d = piernaPorRaya(b.delantero, b.ref.rayaDelantero, false, yB, bast);
      const e = igualar(d, piernaPorRaya(b.espalda, b.ref.rayaEspalda, true, yB, bast));
      margenBorde(d, "costadoBajo", "entrepiernaBajo", 4);
      margenBorde(e, "costadoBajo", "entrepiernaBajo", 4);
      marcarRayas(b, d, e, yB);
      return terminarConBragueta(e, d, { bolsillos: true });
    },
  },
  {
    id: "pantalon-capri",
    categoria: "pantalones",
    nombre: "Pantalón capri (pescador)",
    descripcion: "Pantalón angosto a media pantorrilla con abertura en el costado.",
    telas: "Gabardina stretch, algodón con elastano o lino.",
    pasos: [
      "Pantalón base; corta a media pantorrilla (a la mitad entre rodilla y tobillo).",
      "Rodilla: contorno de rodilla + 8 cm; bastilla: contorno de rodilla + 2 cm.",
      "Deja una abertura de 7 cm en la costura del costado, arriba de la bastilla.",
      "Bastilla de 3 cm, pretina y bragueta.",
    ],
    generar: (m) => {
      const b = base(m);
      const yB = -(m.largoRodilla + 0.5 * (tobillo(m) - m.largoRodilla));
      const rod = { y: -m.largoRodilla, total: m.rodilla + 8 };
      const d = piernaPorRaya(b.delantero, b.ref.rayaDelantero, false, yB, m.rodilla + 2, rod);
      const e = igualar(d, piernaPorRaya(b.espalda, b.ref.rayaEspalda, true, yB, m.rodilla + 2, rod));
      marcarRayas(b, d, e, yB);
      for (const pz of [d, e]) {
        piquete(pz, costadoEn(pz, yB + 7));
        const q = costadoEn(pz, yB + 4);
        pz.marcas.push({ t: "texto", p: P(q.x + (pz === d ? 3.5 : -3.5), q.y), s: "abertura", h: 0.6 });
      }
      return terminarConBragueta(e, d);
    },
  },
  {
    id: "pantalon-harem",
    categoria: "pantalones",
    nombre: "Pantalón harem (bombacho)",
    descripcion: "Tiro caído y mucha amplitud en la cadera, fruncido en la cintura elástica y recogido en puños en el tobillo.",
    telas: "Rayón, viscosa, punto de algodón o gasa: telas suaves que se frunzan bien.",
    pasos: [
      "Pantalón base con 14 cm de holgura de cadera.",
      "Quita las pinzas y sube costado y centro rectos: la cintura queda del ancho de cadera y se frunce con elástico.",
      "Baja el tiro unos 16 cm y alárgalo 2 cm; traza la curva nueva desde el centro.",
      "Une con líneas rectas el tiro caído y la cadera con la bastilla (tobillo + 14 cm de vuelta completa).",
      "Puños de tobillo + 5 cm por 4 cm (8 cm doblados) y pretina elástica.",
    ],
    generar: (m) => {
      const b = base(m, { holguraCadera: 14 });
      const caida = 16 + (m.cadera - 96) * 0.05;
      const d0 = cinturaElastica(b.delantero);
      const e0 = cinturaElastica(b.espalda);
      const yB = -(tobillo(m) - 3);
      const pD = partes(d0);
      const pE = partes(e0);
      const cD = pD.arriba[pD.arriba.length - 1];
      const cE = pE.arriba[pE.arriba.length - 1];
      const tD0 = pD.pierna[pD.pierna.length - 1];
      const tE0 = pE.pierna[pE.pierna.length - 1];
      const tD = P(tD0.x + pD.s * 2, tD0.y - caida);
      const tE = P(tE0.x + pE.s * 2, tE0.y - caida);
      const anchoD = Math.abs(tD.x - cD.x);
      const anchoE = Math.abs(tE.x - cE.x);
      const bast = m.tobillo + 14;
      const a = 5;
      const bb = (anchoD + anchoE - bast) / 2 - a;
      const d = cambiarPierna(d0, { yBajo: yB, tiro: tD, bajo: { lado: cD.x + pD.s * a, entre: tD.x - pD.s * bb } });
      const e = igualar(d, cambiarPierna(e0, { yBajo: yB, tiro: tE, bajo: { lado: cE.x + pE.s * a, entre: tE.x - pE.s * bb } }));
      margenBorde(d, "costadoBajo", "entrepiernaBajo", 1);
      margenBorde(e, "costadoBajo", "entrepiernaBajo", 1);
      raya(d, (cD.x + tD.x) / 2, b.ref.cadera, yB);
      raya(e, (cE.x + tE.x) / 2, b.ref.cadera, yB);
      // tallas anidadas desde el centro de la bastilla: el tobillo casi no cambia entre tallas
      const centroBajo = (pz: typeof d) => P((v(pz, "costadoBajo").x + v(pz, "entrepiernaBajo").x) / 2, yB);
      d.ancla = centroBajo(d);
      e.ancla = centroBajo(e);
      const c = cinturas(d, e);
      const puno = rectangulo("Puño", m.tobillo + 5, 8, "Cortar 2 en tela", { dobladoAlCentro: true });
      return [e, d, pretinaElastica(2 * (c.d + c.e), 3, false), puno];
    },
  },
  {
    id: "pantalon-tiro-alto",
    categoria: "pantalones",
    nombre: "Pantalón de tiro alto con pretina alta",
    descripcion: "Pantalón recto que sube arriba de la cintura con una pretina en curva de 8 cm que sigue la forma del cuerpo.",
    telas: "Gabardina, crepé grueso, lino o mezclilla.",
    pasos: [
      "Parte del pantalón base (cintura natural).",
      "Pretina alta en curva: la orilla de abajo mide la cintura terminada de cada pieza y la de arriba se abre 1.6 cm adelante y 1.2 cm atrás.",
      "Se traza como un tramo de cono: radio = cintura × alto ÷ abertura.",
      "Corta 4 piezas de cada pretina (exterior y vista) y entretela las exteriores; agrega 3.5 cm de cruce en la del lado izquierdo para la bragueta.",
    ],
    generar: (m) => {
      const b = base(m);
      const c = cinturas(b.delantero, b.espalda);
      const del = clonar(b.delantero);
      const brag = bragueta(del);
      return [
        b.espalda,
        del,
        pretinaCurva("Pretina alta delantera", c.d, 8, 1.6, false),
        pretinaCurva("Pretina alta trasera", c.e, 8, 1.2, false),
        ...brag,
      ];
    },
  },
];
