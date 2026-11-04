// ─────────────────────────────────────────────────────────────────────────────
//  CATÁLOGO — aquí agregas, quitas o editas tus patrones.
//  Los precios están en la moneda de cobro (MXN). Precio 0 = patrón gratis.
//  Los patrones de ejemplo son ilustrativos: reemplázalos por los tuyos.
// ─────────────────────────────────────────────────────────────────────────────
import { FORMATOS_TODOS, type Formato } from "./config.ts";

export type Categoria = "vestidos" | "blusas" | "faldas" | "pantalones" | "enteros" | "chamarras" | "infantil";
export type Nivel = "principiante" | "intermedio" | "avanzado";
export type GrupoTallas = "mujer" | "infantil";

export type Patron = {
  slug: string;
  nombre: string;
  tipo: string; // "Vestido cruzado midi"
  categoria: Categoria;
  nivel: Nivel;
  precio: number; // MXN; 0 = gratis
  precioAntes?: number; // para mostrar descuento
  resumen: string;
  descripcion: string[];
  tallas: GrupoTallas;
  telas: string; // telas recomendadas
  consumo: string; // metros de tela
  merceria: string[];
  formatos: Formato[];
  /** Dibujo plano (ver components/DibujoPlano.tsx) y color de fondo de la tarjeta */
  dibujo: string;
  /** Fotos reales en /public (ej. ["/fotos/amapola-1.jpg"]). Si hay, se muestran antes del dibujo. */
  fotos?: string[];
  color: string;
  nuevo?: boolean;
  piezas: number;
  minutos: number; // tiempo aproximado de confección
};

export const CATEGORIAS: Record<Categoria, string> = {
  vestidos: "Vestidos",
  blusas: "Blusas y tops",
  faldas: "Faldas",
  pantalones: "Pantalones y shorts",
  enteros: "Overoles y enteros",
  chamarras: "Chamarras y kimonos",
  infantil: "Infantil",
};

export const NIVELES: Record<Nivel, { nombre: string; puntos: number }> = {
  principiante: { nombre: "Principiante", puntos: 1 },
  intermedio: { nombre: "Intermedio", puntos: 2 },
  avanzado: { nombre: "Avanzado", puntos: 3 },
};

// ── Tablas de medidas (medidas del cuerpo, en cm) ────────────────────────────
// Base de estatura 1.60 m (promedio latino), no 1.68 m como los patrones europeos.
export const TALLAS_MUJER = [
  { talla: "XS", busto: 80, cintura: 62, cadera: 86 },
  { talla: "S", busto: 84, cintura: 66, cadera: 90 },
  { talla: "M", busto: 90, cintura: 72, cadera: 96 },
  { talla: "L", busto: 96, cintura: 78, cadera: 102 },
  { talla: "XL", busto: 102, cintura: 84, cadera: 108 },
  { talla: "2XL", busto: 110, cintura: 92, cadera: 116 },
  { talla: "3XL", busto: 118, cintura: 100, cadera: 124 },
  { talla: "4XL", busto: 126, cintura: 108, cadera: 132 },
];

export const TALLAS_INFANTIL = [
  { talla: "1 año", estatura: 80, pecho: 52, cintura: 49, cadera: 54 },
  { talla: "2 años", estatura: 92, pecho: 54, cintura: 50, cadera: 56 },
  { talla: "4 años", estatura: 104, pecho: 57, cintura: 52, cadera: 60 },
  { talla: "6 años", estatura: 116, pecho: 60, cintura: 54, cadera: 64 },
  { talla: "8 años", estatura: 128, pecho: 64, cintura: 56, cadera: 68 },
  { talla: "10 años", estatura: 140, pecho: 68, cintura: 58, cadera: 72 },
];

export function rangoTallas(grupo: GrupoTallas): string {
  return grupo === "mujer" ? "XS a 4XL" : "1 a 10 años";
}

// ── Patrones ─────────────────────────────────────────────────────────────────
export const PATRONES: Patron[] = [
  {
    slug: "vestido-amapola",
    nombre: "Amapola",
    tipo: "Vestido cruzado midi",
    categoria: "vestidos",
    nivel: "intermedio",
    precio: 129,
    precioAntes: 159,
    resumen: "Vestido cruzado con falda de vuelo, manga corta con puño y lazo a la cintura.",
    descripcion: [
      "Un vestido que favorece a todos los cuerpos: el cruce del frente se ajusta con el lazo y la falda de medio vuelo cae con movimiento.",
      "Incluye dos largos (rodilla y midi) y dos mangas (corta con puño y tres cuartos).",
    ],
    tallas: "mujer",
    telas: "Telas ligeras con caída: rayón, viscosa, crepé, popelina suave o lino delgado.",
    consumo: "2.40 a 3.30 m en tela de 1.50 m de ancho",
    merceria: ["Entretela ligera (30 cm)", "Hilo a tono"],
    formatos: FORMATOS_TODOS,
    dibujo: "vestido-cruzado",
    color: "#F3D9CF",
    nuevo: true,
    piezas: 9,
    minutos: 240,
  },
  {
    slug: "blusa-jacaranda",
    nombre: "Jacaranda",
    tipo: "Blusa con manga globo",
    categoria: "blusas",
    nivel: "principiante",
    precio: 89,
    resumen: "Blusa holgada de cuello redondo con manga globo fruncida y abertura en la espalda.",
    descripcion: [
      "Una blusa fácil para tu primer proyecto con mangas: sin pinzas, sin cierres y con un botón en la espalda.",
      "La manga globo se frunce con elástico, así que no tienes que pelear con la cabeza de manga.",
    ],
    tallas: "mujer",
    telas: "Popelina, batista, lino, gasa de algodón o seda lavada.",
    consumo: "1.40 a 2.00 m en tela de 1.50 m de ancho",
    merceria: ["1 botón de 1 cm", "Elástico de 6 mm (60 cm)", "Bies o entretela ligera"],
    formatos: FORMATOS_TODOS,
    dibujo: "blusa-globo",
    color: "#DCD6EF",
    piezas: 5,
    minutos: 150,
  },
  {
    slug: "falda-bugambilia",
    nombre: "Bugambilia",
    tipo: "Falda de vuelo con pretina elástica",
    categoria: "faldas",
    nivel: "principiante",
    precio: 69,
    resumen: "Falda de medio vuelo con bolsas laterales y pretina elástica. Tres largos.",
    descripcion: [
      "La falda perfecta para empezar: cuatro piezas, bolsas en la costura lateral y pretina con elástico que no necesita cierre.",
      "Tres largos incluidos: mini, rodilla y midi.",
    ],
    tallas: "mujer",
    telas: "Popelina, gabardina ligera, lino, rayón o mezclilla delgada.",
    consumo: "1.30 a 2.60 m en tela de 1.50 m de ancho",
    merceria: ["Elástico de 3 cm (cintura + 5 cm)"],
    formatos: FORMATOS_TODOS,
    dibujo: "falda-vuelo",
    color: "#F6D7E2",
    piezas: 4,
    minutos: 90,
  },
  {
    slug: "pantalon-mezquite",
    nombre: "Mezquite",
    tipo: "Pantalón palazzo de tiro alto",
    categoria: "pantalones",
    nivel: "intermedio",
    precio: 119,
    resumen: "Palazzo de pierna amplia con pinzas al frente, bolsas en diagonal y cierre lateral.",
    descripcion: [
      "Pantalón de tiro alto que alarga la figura. Pinzas al frente, bolsas en diagonal y pretina recta con cierre invisible lateral.",
      "Incluye ajuste de largo para estaturas de 1.50 m a 1.75 m marcado en el patrón.",
    ],
    tallas: "mujer",
    telas: "Lino, crepé, gabardina ligera, tencel o rayón grueso.",
    consumo: "2.20 a 2.80 m en tela de 1.50 m de ancho",
    merceria: ["Cierre invisible de 20 cm", "Entretela para pretina", "1 botón o broche"],
    formatos: FORMATOS_TODOS,
    dibujo: "pantalon-palazzo",
    color: "#E8DCC8",
    piezas: 7,
    minutos: 210,
  },
  {
    slug: "overol-pitahaya",
    nombre: "Pitahaya",
    tipo: "Overol de tirantes",
    categoria: "enteros",
    nivel: "avanzado",
    precio: 149,
    resumen: "Overol con peto, tirantes cruzados en la espalda, bolsas de parche y pierna recta.",
    descripcion: [
      "Un proyecto para subir de nivel: peto con vista, tirantes que se cruzan en la espalda, bolsas de parche y bragueta con cierre.",
      "Dos versiones: pantalón largo y short.",
    ],
    tallas: "mujer",
    telas: "Mezclilla de 8 a 10 oz, gabardina, lona ligera o pana fina.",
    consumo: "2.30 a 3.00 m en tela de 1.50 m de ancho",
    merceria: ["Cierre de 15 cm", "2 hebillas de overol", "4 botones de presión"],
    formatos: FORMATOS_TODOS,
    dibujo: "overol",
    color: "#CFE0E8",
    nuevo: true,
    piezas: 12,
    minutos: 360,
  },
  {
    slug: "top-nopal",
    nombre: "Nopal",
    tipo: "Playera básica de punto",
    categoria: "blusas",
    nivel: "principiante",
    precio: 0,
    resumen: "La playera de cuello redondo que vas a coser una y otra vez. Gratis para que conozcas nuestros patrones.",
    descripcion: [
      "Nuestro regalo para que pruebes cómo quedan nuestras tallas: playera de punto con cuello redondo, manga corta o larga.",
      "Se cose en una tarde, con máquina recta (puntada zigzag) o con overlock.",
    ],
    tallas: "mujer",
    telas: "Jersey de algodón con licra, punto de viscosa o modal.",
    consumo: "1.00 a 1.60 m en tela de 1.50 m de ancho",
    merceria: ["Hilo a tono", "Aguja para punto"],
    formatos: ["carta", "a4", "plotter", "instructivo"],
    dibujo: "playera",
    color: "#D5E5D0",
    piezas: 4,
    minutos: 75,
  },
  {
    slug: "vestido-colibri",
    nombre: "Colibrí",
    tipo: "Vestido infantil con olanes",
    categoria: "infantil",
    nivel: "principiante",
    precio: 79,
    resumen: "Vestido para niña con canesú, olanes en los hombros y falda fruncida. De 1 a 10 años.",
    descripcion: [
      "El vestido de fiesta (o de todos los días) más fácil: canesú forrado que deja los acabados limpios, olanes en los hombros y falda fruncida.",
      "Abotonado en la espalda. Con opción de manga corta en lugar de olanes.",
    ],
    tallas: "infantil",
    telas: "Popelina estampada, batista, lino o gasa de algodón.",
    consumo: "0.80 a 1.60 m en tela de 1.50 m de ancho",
    merceria: ["3 a 5 botones de 1 cm", "Hilo a tono"],
    formatos: FORMATOS_TODOS,
    dibujo: "vestido-nina",
    color: "#FBE3B8",
    piezas: 6,
    minutos: 150,
  },
  {
    slug: "kimono-brisa",
    nombre: "Brisa",
    tipo: "Kimono ligero",
    categoria: "chamarras",
    nivel: "principiante",
    precio: 69,
    resumen: "Kimono abierto de manga amplia con banda al frente. Dos largos: cadera y rodilla.",
    descripcion: [
      "Tres piezas principales y costuras rectas: ideal para estampados grandes que no quieres cortar en muchas piezas.",
      "Con o sin cinto, y con opción de flecos en la orilla.",
    ],
    tallas: "mujer",
    telas: "Rayón, gasa, chifón, satín o lino ligero.",
    consumo: "1.60 a 2.40 m en tela de 1.50 m de ancho",
    merceria: ["Hilo a tono"],
    formatos: FORMATOS_TODOS,
    dibujo: "kimono",
    color: "#D9E7E1",
    piezas: 4,
    minutos: 100,
  },
];

export function buscarPatron(slug: string): Patron | undefined {
  return PATRONES.find((p) => p.slug === slug);
}
