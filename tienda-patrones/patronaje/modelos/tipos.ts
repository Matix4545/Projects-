import type { Medidas } from "../medidas.ts";
import type { Pieza } from "../pieza.ts";

export type Categoria = "bases" | "pinzas" | "escotes" | "cuellos" | "mangas" | "vestidos" | "faldas" | "pantalones";

export const CATEGORIAS_PATRONAJE: Record<Categoria, { nombre: string; intro: string }> = {
  bases: {
    nombre: "Patrones base",
    intro: "Los bloques de los que salen todas las transformaciones: cuerpo, manga, falda y pantalón, con holguras para tela plana.",
  },
  pinzas: {
    nombre: "Pinzas",
    intro: "La pinza de busto siempre apunta al punto de busto y puede salir de cualquier borde del delantero. Se traslada cortando hasta el punto de busto y girando.",
  },
  escotes: {
    nombre: "Tipos de escote",
    intro: "Se trazan sobre el cuerpo base: se abre el escote en el hombro y se baja en el centro. Cada escote lleva su vista.",
  },
  cuellos: {
    nombre: "Tipos de cuello",
    intro: "Los cuellos se trazan con la medida del escote: largo del escote de espalda más el del delantero.",
  },
  mangas: {
    nombre: "Tipos de manga",
    intro: "Salen de la manga base: se corta y se separa para dar vuelo o frunce, o se une al cuerpo (raglán, kimono).",
  },
  vestidos: {
    nombre: "Cortes de vestido",
    intro: "Los cortes (princesa, imperio, cintura) se hacen pasando las pinzas a costuras.",
  },
  faldas: {
    nombre: "Tipos de falda",
    intro: "De la falda recta salen todas: cerrando pinzas se da vuelo, con círculos se hacen circulares y con rectángulos tableadas y plisadas.",
  },
  pantalones: {
    nombre: "Tipos de pantalón",
    intro: "Del pantalón base se cambian el ancho de la pierna, el largo, el tiro y la cintura.",
  },
};

export type Modelo = {
  /** Identificador para la línea de comandos y la dirección web, ej. "escote-v". */
  id: string;
  categoria: Categoria;
  nombre: string;
  /** Qué es y cuándo se usa (1–2 frases). */
  descripcion: string;
  /** Cómo se transforma desde la base, paso a paso. */
  pasos: string[];
  /** Telas recomendadas (opcional). */
  telas?: string;
  generar: (m: Medidas) => Pieza[];
};
