// Patrones base (bloques).
import { cuerpoBase, delanteroConPinza } from "../bases/cuerpo.ts";
import { faldaBase } from "../bases/falda.ts";
import { mangaBase } from "../bases/manga.ts";
import { pantalonBase } from "../bases/pantalon.ts";
import { blusaBase } from "./comun.ts";
import type { Modelo } from "./tipos.ts";

export const BASES: Modelo[] = [
  {
    id: "cuerpo-base",
    categoria: "bases",
    nombre: "Cuerpo base",
    descripcion: "Delantero y espalda a la cintura, con pinza de busto en el costado y pinzas de cintura. Holgura de 10 cm en busto.",
    pasos: [
      "Traza un rectángulo de medio contorno de busto + 5 cm de ancho por el talle de espalda de alto.",
      "Baja la línea de busto (busto/12 + 13.5 cm) y marca el ancho de espalda y el ancho de pecho.",
      "Sube el delantero (busto/5 + 8.3 cm sobre la línea de busto) para dar el largo que pide el busto.",
      "Traza escotes, hombros (18° en espalda, 22° en delantero) y sisas perpendiculares al hombro y al costado.",
      "Abre la pinza de busto con ángulo de (busto/4 − 2.5)° hacia el punto de busto y pásala al costado.",
      "Reparte lo que sobra en la cintura entre costados y pinzas; las pinzas delanteras terminan 2.5 cm antes del busto.",
    ],
    generar: (m) => {
      const c = cuerpoBase(m);
      return [c.espalda, { ...delanteroConPinza(c, "costado"), nombre: "Delantero" }];
    },
  },
  {
    id: "blusa-base",
    categoria: "bases",
    nombre: "Blusa base con manga",
    descripcion: "El cuerpo base alargado a la cadera, con pinzas de pez y manga montada. Es la base para escotes, cuellos y mangas.",
    pasos: [
      "Parte del cuerpo base con la pinza de busto en el costado.",
      "Alarga el centro y el costado hasta la cadera + 2 cm; abre el costado al ancho de cadera más holgura.",
      "Convierte las pinzas de cintura en pinzas de pez (rombo) que terminan 13 cm abajo de la cintura.",
      "Traza la manga con la medida de la sisa: la copa mide la sisa + 2.5 cm de embebido.",
    ],
    generar: (m) => {
      const b = blusaBase(m);
      return [b.espalda, b.delantero, b.manga];
    },
  },
  {
    id: "manga-base",
    categoria: "bases",
    nombre: "Manga base",
    descripcion: "Manga montada larga, con copa calculada para la sisa del cuerpo base y piquetes de delantero (1) y espalda (2).",
    pasos: [
      "Ancho de bíceps = contorno de brazo + 5 cm; divide en delantero (−0.5) y espalda (+0.5).",
      "Busca la altura de copa con la que la curva de copa mide la sisa + 2.5 cm (embebido).",
      "Traza la copa en S: convexa arriba y cóncava abajo, más llena atrás.",
      "Baja el largo de brazo; la bastilla mide muñeca + 10 cm. Marca la línea de codo.",
    ],
    generar: (m) => [mangaBase(m, cuerpoBase(m)).manga],
  },
  {
    id: "falda-base",
    categoria: "bases",
    nombre: "Falda base (recta)",
    descripcion: "Falda recta a la rodilla con dos pinzas por pieza, delantero al doblez y espalda con cierre al centro.",
    pasos: [
      "Ancho de cada cuarto: cadera/4 + 1 cm (+0.5 delantero, −0.5 espalda). Baja la altura de cadera y el largo.",
      "Cintura terminada: cintura/4 + 0.5 cm. Lo que sobra se reparte entre el costado (curva de cadera) y las pinzas.",
      "Sube el costado 0.8 cm en la cintura y baja 1 cm el centro espalda.",
      "Pinzas delanteras de 9.5 y 8.5 cm alineadas con el busto; traseras de 14 y 12.5 cm.",
    ],
    generar: (m) => {
      const f = faldaBase(m);
      return [f.espalda, f.delantero];
    },
  },
  {
    id: "pantalon-base",
    categoria: "bases",
    nombre: "Pantalón base (recto)",
    descripcion: "Pantalón recto de tiro a la cintura, con raya, una pinza delantera y una o dos traseras.",
    pasos: [
      "Baja altura de cadera, tiro + 1 cm, rodilla y largo.",
      "Delantero: cadera/4 + 0.5 cm, entrepierna de cadera/16; espalda: cadera/4 + 1.5 cm, entrepierna de cadera/10 + 0.5.",
      "Centro espalda inclinado y 2.5 cm más alto en la cintura; entrepierna trasera 0.7 cm más baja.",
      "La raya va al centro de la pierna; reparte ancho de rodilla y bastilla a cada lado (espalda 1 cm más por lado).",
    ],
    generar: (m) => {
      const p = pantalonBase(m);
      return [p.espalda, p.delantero];
    },
  },
];
