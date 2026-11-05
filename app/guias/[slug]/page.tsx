import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd, Llamado, Migas, PieContenido, Preguntas, TarjetaEnlace, Texto } from "@/components/Contenido";
import { Bloque, Pagina } from "@/components/Pagina";
import { GUIAS, guiaPorSlug } from "@/lib/contenido/guias";
import { herramientaPorSlug } from "@/lib/contenido/herramientas";
import { CONTENIDO_REVISADO, NOMBRE_SITIO, urlAbsoluta } from "@/lib/sitio";

export const dynamicParams = false;
export const generateStaticParams = () => GUIAS.map((g) => ({ slug: g.slug }));

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const g = guiaPorSlug((await params).slug);
  if (!g) return {};
  return {
    title: `${g.tituloSeo} · ${NOMBRE_SITIO}`,
    description: g.descripcion,
    alternates: { canonical: `/guias/${g.slug}` },
    openGraph: { title: g.tituloSeo, description: g.descripcion, type: "article", locale: "es_MX", siteName: NOMBRE_SITIO },
  };
}

const fechaRevision = new Date(`${CONTENIDO_REVISADO}T12:00:00`).toLocaleDateString("es-MX", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default async function PaginaGuia({ params }: Props) {
  const g = guiaPorSlug((await params).slug);
  if (!g) notFound();
  const herramientas = g.herramientas.map(herramientaPorSlug).filter((h) => h !== undefined);
  const relacionadas = g.relacionadas.map(guiaPorSlug).filter((r) => r !== undefined);

  return (
    <Pagina titulo={g.titulo} volver={{ href: "/guias", texto: "Guías" }}>
      <Migas items={[{ nombre: "Guías", href: "/guias" }, { nombre: g.titulo, href: `/guias/${g.slug}` }]} />
      <JsonLd
        datos={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: g.tituloSeo,
          description: g.descripcion,
          inLanguage: "es-MX",
          dateModified: CONTENIDO_REVISADO,
          mainEntityOfPage: urlAbsoluta(`/guias/${g.slug}`),
          about: { "@type": "City", name: "Ciudad Obregón", containedInPlace: { "@type": "State", name: "Sonora" } },
          publisher: { "@type": "Organization", name: NOMBRE_SITIO, url: urlAbsoluta("/") },
        }}
      />

      {/* Respuesta corta primero: es lo que leen los buscadores y los asistentes de IA */}
      <section className="rounded-2xl bg-white px-4 py-4">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-ios-azul">Respuesta corta</p>
        <p className="mt-1.5 text-[17px] leading-relaxed">{g.respuesta}</p>
      </section>

      <section>
        <h2 className="titulo-grupo">Paso a paso</h2>
        <ol className="grupo">
          {g.pasos.map((p, i) => (
            <li key={p.titulo} className="flex gap-3 px-4 py-3.5">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ios-azul text-[14px] font-bold text-white">{i + 1}</span>
              <div className="min-w-0">
                <h3 className="text-[16px] font-semibold leading-snug">{p.titulo}</h3>
                <p className="mt-1 text-[15px] leading-relaxed text-ios-secundario">{p.texto}</p>
                {p.enlace && (
                  <Link href={p.enlace.href} className="mt-1.5 inline-block text-[15px] font-medium text-ios-azul">
                    {p.enlace.texto} ›
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <Llamado titulo={g.llamado.titulo} texto={g.llamado.texto} href={g.llamado.href} boton={g.llamado.boton} />

      {g.canales && (
        <section>
          <h2 className="titulo-grupo">¿Dónde conviene reportarlo?</h2>
          {/* Tabla en computadora, tarjetas en celular */}
          <div className="hidden overflow-hidden rounded-2xl bg-white sm:block">
            <table className="w-full text-left text-[14px]">
              <thead className="text-[12px] uppercase tracking-wide text-ios-secundario">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Canal</th>
                  <th className="px-3 py-2.5 font-medium">Sirve para</th>
                  <th className="px-3 py-2.5 font-medium">A favor</th>
                  <th className="px-4 py-2.5 font-medium">En contra</th>
                </tr>
              </thead>
              <tbody>
                {g.canales.map((c) => (
                  <tr key={c.canal} className="border-t-[0.5px] border-ios-separador align-top">
                    <th scope="row" className="px-4 py-3 font-semibold">{c.canal}</th>
                    <td className="px-3 py-3">{c.sirve}</td>
                    <td className="px-3 py-3">{c.ventaja}</td>
                    <td className="px-4 py-3 text-ios-secundario">{c.limite}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="grupo sm:hidden">
            {g.canales.map((c) => (
              <li key={c.canal} className="px-4 py-3.5 text-[15px]">
                <p className="font-semibold">{c.canal}</p>
                <p className="mt-1">{c.sirve}</p>
                <p className="mt-1.5 text-ios-verde">✓ {c.ventaja}</p>
                <p className="mt-0.5 text-ios-secundario">✗ {c.limite}</p>
              </li>
            ))}
          </ul>
          <p className="nota-grupo">
            Lo que mejor funciona es combinarlos: el reporte oficial te da un folio y el mapa deja constancia pública.
          </p>
        </section>
      )}

      <Preguntas preguntas={g.preguntas} />

      {herramientas.length > 0 && (
        <Bloque titulo="Herramientas gratis" sinRelleno>
          <div className="grupo">
            {herramientas.map((h) => (
              <TarjetaEnlace key={h.slug} href={`/herramientas/${h.slug}`} emoji={h.emoji} titulo={h.titulo} texto={h.descripcion} />
            ))}
          </div>
        </Bloque>
      )}

      {relacionadas.length > 0 && (
        <Bloque titulo="También te puede servir" sinRelleno>
          <div className="grupo">
            {relacionadas.map((r) => (
              <TarjetaEnlace key={r.slug} href={`/guias/${r.slug}`} emoji={r.emoji} titulo={r.titulo} texto={r.descripcion} />
            ))}
          </div>
        </Bloque>
      )}

      <Texto>
        <p className="px-1 text-[13px] text-ios-secundario">
          Revisado el {fechaRevision}. Si algo cambió (un teléfono, un trámite), escríbenos desde <Link href="/acerca">Acerca de</Link>.
        </p>
      </Texto>
      <PieContenido />
    </Pagina>
  );
}
