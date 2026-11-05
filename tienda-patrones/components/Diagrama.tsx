import { talla } from "@/patronaje/medidas.ts";
import type { Modelo } from "@/patronaje/modelos/tipos.ts";
import { svgPiezas } from "@/patronaje/exportar/svg.ts";

/** Diagrama de las piezas de patrón de un modelo (talla M), generado al compilar el sitio. */
export function Diagrama({ modelo, className = "" }: { modelo: Modelo; className?: string }) {
  let svg = "";
  try {
    svg = svgPiezas(modelo.generar(talla("M")), { detalle: false, anchoLinea: 0.35, maxAncho: 140, separacion: 4 });
  } catch {
    return null;
  }
  return (
    <div
      className={`diagrama ${className}`}
      role="img"
      aria-label={`Piezas de patrón: ${modelo.nombre}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
