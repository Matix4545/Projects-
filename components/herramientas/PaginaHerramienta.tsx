// Marco común de las herramientas: título, migas, datos estructurados, la herramienta,
// el llamado a reportar, preguntas frecuentes y guías relacionadas.
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { JsonLd, Llamado, Migas, PieContenido, Preguntas, TarjetaEnlace } from "@/components/Contenido";
import { Bloque, Pagina } from "@/components/Pagina";
import { guiaPorSlug } from "@/lib/contenido/guias";
import { herramientaPorSlug, type Herramienta } from "@/lib/contenido/herramientas";
import { NOMBRE_SITIO, urlAbsoluta } from "@/lib/sitio";

export function metadatosHerramienta(slug: string): Metadata {
  const h = herramientaPorSlug(slug);
  if (!h) return {};
  return {
    title: `${h.tituloSeo} · ${NOMBRE_SITIO}`,
    description: h.descripcion,
    alternates: { canonical: `/herramientas/${h.slug}` },
    openGraph: { title: h.tituloSeo, description: h.descripcion, locale: "es_MX", siteName: NOMBRE_SITIO },
  };
}

export function PaginaHerramienta({
  slug,
  intro,
  llamado,
  preguntas,
  guias,
  children,
}: {
  slug: string;
  intro: ReactNode;
  llamado: { titulo: string; texto: string; href?: string; boton?: string };
  preguntas: { p: string; r: string }[];
  guias: string[];
  children: ReactNode;
}) {
  const h = herramientaPorSlug(slug) as Herramienta;
  const relacionadas = guias.map(guiaPorSlug).filter((g) => g !== undefined);
  return (
    <Pagina titulo={h.titulo} volver={{ href: "/herramientas", texto: "Herramientas" }}>
      <Migas items={[{ nombre: "Herramientas", href: "/herramientas" }, { nombre: h.titulo, href: `/herramientas/${h.slug}` }]} />
      <JsonLd
        datos={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: h.tituloSeo,
          description: h.descripcion,
          url: urlAbsoluta(`/herramientas/${h.slug}`),
          applicationCategory: "UtilitiesApplication",
          operatingSystem: "Cualquiera (navegador)",
          inLanguage: "es-MX",
          isAccessibleForFree: true,
          offers: { "@type": "Offer", price: "0", priceCurrency: "MXN" },
          publisher: { "@type": "Organization", name: NOMBRE_SITIO, url: urlAbsoluta("/") },
        }}
      />
      <p className="-mt-2 px-1 text-[16px] leading-relaxed text-ios-secundario print:hidden">{intro}</p>
      {children}
      <Llamado {...llamado} />
      {/* Al imprimir (el escrito) no sale nada de esto */}
      <div className="space-y-6 print:hidden">
        <Preguntas preguntas={preguntas} />
        {relacionadas.length > 0 && (
          <Bloque titulo="Guías relacionadas" sinRelleno>
            <div className="grupo">
              {relacionadas.map((g) => (
                <TarjetaEnlace key={g.slug} href={`/guias/${g.slug}`} emoji={g.emoji} titulo={g.titulo} texto={g.descripcion} />
              ))}
            </div>
          </Bloque>
        )}
      </div>
      <PieContenido />
    </Pagina>
  );
}
