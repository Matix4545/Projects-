import type { Metadata } from "next";
import { Llamado, Migas, PieContenido, TarjetaEnlace } from "@/components/Contenido";
import { Bloque, Pagina } from "@/components/Pagina";
import { GUIAS } from "@/lib/contenido/guias";
import { HERRAMIENTAS } from "@/lib/contenido/herramientas";

export const metadata: Metadata = {
  title: "Guías: cómo reportar problemas en Ciudad Obregón · Reporta Cajeme",
  description:
    "Qué hacer si no hay agua, cómo reportar un bache, una lámpara fundida o el drenaje tapado en Cajeme, y cómo reclamar daños por un bache.",
  alternates: { canonical: "/guias" },
};

export default function Guias() {
  return (
    <Pagina titulo="Guías" subtitulo="Qué hacer y a quién reportar cada problema en Ciudad Obregón y Cajeme.">
      <Migas items={[{ nombre: "Guías", href: "/guias" }]} />
      <Bloque sinRelleno>
        <div className="grupo">
          {GUIAS.map((g) => (
            <TarjetaEnlace key={g.slug} href={`/guias/${g.slug}`} emoji={g.emoji} titulo={g.titulo} texto={g.descripcion} />
          ))}
        </div>
      </Bloque>
      <Bloque titulo="Herramientas gratis" sinRelleno nota="Sin registro. Lo que escribes no sale de tu celular.">
        <div className="grupo">
          {HERRAMIENTAS.map((h) => (
            <TarjetaEnlace key={h.slug} href={`/herramientas/${h.slug}`} emoji={h.emoji} titulo={h.titulo} texto={h.descripcion} />
          ))}
        </div>
      </Bloque>
      <Llamado
        titulo="¿Ya sabes qué reportar?"
        texto="Márcalo en el mapa en un minuto, sin dar tu nombre."
        secundario={{ href: "/colonias", texto: "Ver el agua por colonia" }}
      />
      <PieContenido />
    </Pagina>
  );
}
