// Direcciones legibles para las páginas de colonias: "Col. Cajeme (Norte)" → "col-cajeme-norte".
// Sin imports para poder probarlo con `node --test`.

/** Texto → slug en minúsculas, sin acentos ni signos (máximo 80 caracteres) */
export function slugify(texto: string): string {
  const limpio = texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
  return limpio || "colonia";
}

export type ConSlug<T> = T & { slug: string };

/**
 * Slugs únicos y estables: la colonia con el id más bajo se queda con el nombre limpio y las
 * repetidas llevan "-<id>" al final (p. ej. dos "Las Palmas" → "las-palmas" y "las-palmas-418").
 */
export function asignarSlugs<T extends { id: number; nombre: string }>(zonas: T[]): ConSlug<T>[] {
  const usados = new Set<string>();
  return [...zonas]
    .sort((a, b) => a.id - b.id)
    .map((z) => {
      const base = slugify(z.nombre);
      let slug = base;
      while (usados.has(slug)) slug = `${slug}-${z.id}`;
      usados.add(slug);
      return { ...z, slug };
    });
}

/**
 * Busca una colonia por su slug. También acepta "<nombre>-<id>" (el enlace que arma el mapa sin
 * conocer la lista completa): en ese caso `canonico` es false y la página redirige al slug bueno.
 */
export function buscarPorSlug<T extends { id: number; nombre: string; slug: string }>(
  lista: T[],
  slug: string,
): { zona: T; canonico: boolean } | null {
  const exacta = lista.find((z) => z.slug === slug);
  if (exacta) return { zona: exacta, canonico: true };
  const partes = /^(.*)-(\d+)$/.exec(slug);
  if (!partes) return null;
  const zona = lista.find((z) => z.id === Number(partes[2]));
  return zona && slugify(zona.nombre) === partes[1] ? { zona, canonico: false } : null;
}

/** Enlace a la página de una colonia desde el mapa (la página lo redirige al slug definitivo) */
export const enlaceColonia = (z: { id: number; nombre: string }) => `/colonias/${slugify(z.nombre)}-${z.id}`;
