// Cálculo de precios compartido entre el navegador y el servidor.
// El servidor SIEMPRE recalcula con esto; nunca confía en el precio que manda el navegador.
import { LICENCIAS, type Licencia } from "./config.ts";
import { buscarPatron, type Patron } from "./catalogo.ts";

export type Articulo = { slug: string; licencia: Licencia };

export function precioArticulo(patron: Patron, licencia: Licencia): number {
  // Un patrón gratis no lleva cargo de licencia personal; la emprendedora sí se cobra.
  return patron.precio + LICENCIAS[licencia].extra;
}

export type Linea = { patron: Patron; licencia: Licencia; precio: number };

/** Convierte artículos (slug + licencia) en líneas con precio, descartando slugs inválidos y duplicados. */
export function lineas(articulos: Articulo[]): Linea[] {
  const vistos = new Set<string>();
  const salida: Linea[] = [];
  for (const a of articulos) {
    const patron = buscarPatron(a.slug);
    if (!patron || !(a.licencia in LICENCIAS)) continue;
    const clave = `${a.slug}:${a.licencia}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    salida.push({ patron, licencia: a.licencia, precio: precioArticulo(patron, a.licencia) });
  }
  return salida;
}

export function total(ls: Linea[]): number {
  return ls.reduce((s, l) => s + l.precio, 0);
}
