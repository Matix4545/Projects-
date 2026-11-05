import { BASES } from "./bases.ts";
import { CUELLOS } from "./cuellos.ts";
import { ESCOTES } from "./escotes.ts";
import { FALDAS } from "./faldas.ts";
import { MANGAS } from "./mangas.ts";
import { PANTALONES } from "./pantalones.ts";
import { PINZAS } from "./pinzas.ts";
import { VESTIDOS } from "./vestidos.ts";
import type { Categoria, Modelo } from "./tipos.ts";

export { CATEGORIAS_PATRONAJE } from "./tipos.ts";
export type { Categoria, Modelo };

export const MODELOS: Modelo[] = [...BASES, ...PINZAS, ...ESCOTES, ...CUELLOS, ...MANGAS, ...VESTIDOS, ...FALDAS, ...PANTALONES];

export function modelo(id: string): Modelo {
  const m = MODELOS.find((x) => x.id === id);
  if (!m) throw new Error(`No existe el modelo "${id}". Usa "lista" para ver los disponibles.`);
  return m;
}

export function porCategoria(c: Categoria): Modelo[] {
  return MODELOS.filter((m) => m.categoria === c);
}
