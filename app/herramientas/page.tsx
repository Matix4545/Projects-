import type { Metadata } from "next";
import { Llamado, Migas, PieContenido, TarjetaEnlace } from "@/components/Contenido";
import { Bloque, Pagina } from "@/components/Pagina";
import { GUIAS } from "@/lib/contenido/guias";
import { HERRAMIENTAS } from "@/lib/contenido/herramientas";

export const metadata: Metadata = {
  title: "Herramientas gratis para vecinos de Cajeme · Reporta Cajeme",
  description:
    "Calculadora del tinaco, generador de escritos de petición y calculadora del costo de los baches. Gratis, sin registro y sin guardar tus datos.",
  alternates: { canonical: "/herramientas" },
};

export default function Herramientas() {
  return (
    <Pagina titulo="Herramientas" subtitulo="Gratis y sin registro. Lo que escribes se queda en tu celular.">
      <Migas items={[{ nombre: "Herramientas", href: "/herramientas" }]} />
      <Bloque sinRelleno>
        <div className="grupo">
          {HERRAMIENTAS.map((h) => (
            <TarjetaEnlace key={h.slug} href={`/herramientas/${h.slug}`} emoji={h.emoji} titulo={h.titulo} texto={h.descripcion} />
          ))}
        </div>
      </Bloque>
      <Bloque titulo="Guías" sinRelleno>
        <div className="grupo">
          {GUIAS.slice(0, 4).map((g) => (
            <TarjetaEnlace key={g.slug} href={`/guias/${g.slug}`} emoji={g.emoji} titulo={g.titulo} texto={g.descripcion} />
          ))}
        </div>
      </Bloque>
      <Llamado titulo="¿Tienes un problema en tu calle?" texto="Márcalo en el mapa en un minuto, sin dar tu nombre." />
      <PieContenido />
    </Pagina>
  );
}
