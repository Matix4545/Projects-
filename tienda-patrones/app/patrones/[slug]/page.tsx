import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CATEGORIAS, PATRONES, buscarPatron, rangoTallas } from "@/lib/catalogo";
import { FORMATOS, TIENDA, urlSitio } from "@/lib/config";
import { ComprarPatron } from "@/components/ComprarPatron";
import { DibujoPlano } from "@/components/DibujoPlano";
import { TablaMedidas } from "@/components/TablaMedidas";
import { Nivel, TarjetaPatron } from "@/components/TarjetaPatron";

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return PATRONES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const p = buscarPatron((await params).slug);
  if (!p) return {};
  const titulo = `Patrón ${p.tipo.toLowerCase()} ${p.nombre}`;
  return {
    title: titulo,
    description: `${p.resumen} Tallas ${rangoTallas(p.tallas)}. PDF Carta, A4, plotter y DXF con instructivo en español.`,
    openGraph: { title: titulo, description: p.resumen },
  };
}

function horas(minutos: number) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
}

export default async function PaginaPatron({ params }: Params) {
  const patron = buscarPatron((await params).slug);
  if (!patron) notFound();

  const relacionados = PATRONES.filter((p) => p.slug !== patron.slug && (p.categoria === patron.categoria || p.nivel === patron.nivel)).slice(0, 4);

  // Datos estructurados para que Google muestre precio y disponibilidad
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `Patrón ${patron.tipo} ${patron.nombre}`,
    description: patron.resumen,
    category: "Patrones de costura",
    brand: { "@type": "Brand", name: TIENDA.nombre },
    image: patron.fotos?.map((f) => urlSitio() + f),
    offers: {
      "@type": "Offer",
      price: patron.precio,
      priceCurrency: TIENDA.monedaCobro,
      availability: "https://schema.org/InStock",
      url: `${urlSitio()}/patrones/${patron.slug}`,
    },
  };

  const detalles: [string, string][] = [
    ["Tallas", rangoTallas(patron.tallas)],
    ["Piezas", `${patron.piezas} piezas`],
    ["Tiempo aproximado", horas(patron.minutos)],
    ["Telas recomendadas", patron.telas],
    ["Consumo de tela", patron.consumo],
    ["Mercería", patron.merceria.join(" · ")],
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav className="text-sm text-suave" aria-label="Ruta">
        <Link href="/patrones" className="hover:text-tinta">Patrones</Link>
        <span className="mx-2">/</span>
        <Link href={`/patrones?categoria=${patron.categoria}`} className="hover:text-tinta">{CATEGORIAS[patron.categoria]}</Link>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-4">
          <div className="papel-patron relative overflow-hidden rounded-3xl" style={{ backgroundColor: patron.color }}>
            <div className="absolute inset-0" style={{ backgroundColor: patron.color, opacity: 0.75 }} />
            {patron.fotos?.[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={patron.fotos[0]} alt={`${patron.tipo} ${patron.nombre}`} className="relative aspect-[4/5] w-full object-cover" />
            ) : (
              <DibujoPlano dibujo={patron.dibujo} titulo={`Dibujo plano del ${patron.tipo.toLowerCase()}`} className="relative mx-auto aspect-[5/6] w-[85%] py-6" />
            )}
          </div>
          {patron.fotos && patron.fotos.length > 1 ? (
            <div className="grid grid-cols-4 gap-3">
              {patron.fotos.slice(1).map((f) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={f} src={f} alt="" className="aspect-square rounded-xl object-cover" />
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-acento">{patron.tipo}</p>
          <h1 className="mt-1 font-titulo text-5xl font-semibold tracking-tight">{patron.nombre}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            <Nivel nivel={patron.nivel} />
            <span className="text-xs text-suave">Tallas {rangoTallas(patron.tallas)}</span>
          </div>
          <p className="mt-5 text-lg">{patron.resumen}</p>

          <div className="mt-7">
            <ComprarPatron slug={patron.slug} precio={patron.precio} precioAntes={patron.precioAntes} formatos={patron.formatos} />
          </div>

          <div className="mt-8 rounded-2xl border border-borde bg-tarjeta p-5">
            <h2 className="font-semibold">Qué incluye</h2>
            <ul className="mt-3 space-y-2.5">
              {patron.formatos.map((f) => (
                <li key={f} className="flex gap-3 text-sm">
                  <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-salvia" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                    <path d="M4 10.5l4 4 8-9" />
                  </svg>
                  <span>
                    <strong>{FORMATOS[f].nombre}.</strong> <span className="text-suave">{FORMATOS[f].detalle}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-14 grid gap-10 lg:grid-cols-[1.1fr_1fr]">
        <section>
          <h2 className="font-titulo text-2xl font-semibold">Sobre este patrón</h2>
          <div className="prosa mt-3 text-suave">
            {patron.descripcion.map((d) => (
              <p key={d}>{d}</p>
            ))}
          </div>
        </section>
        <section>
          <h2 className="font-titulo text-2xl font-semibold">Detalles</h2>
          <dl className="mt-3 divide-y divide-borde rounded-2xl border border-borde bg-tarjeta">
            {detalles.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[9rem_1fr] gap-3 p-3.5 text-sm">
                <dt className="font-medium">{k}</dt>
                <dd className="text-suave">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <section className="mt-14">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-titulo text-2xl font-semibold">Tabla de medidas</h2>
          <Link href="/medidas" className="text-sm font-semibold text-acento-oscuro hover:underline">Cómo tomar tus medidas →</Link>
        </div>
        <p className="mt-1 text-sm text-suave">Medidas del cuerpo en centímetros. Si estás entre dos tallas, elige por tu medida más grande.</p>
        <div className="mt-4">
          <TablaMedidas grupo={patron.tallas} />
        </div>
      </section>

      {relacionados.length ? (
        <section className="mt-16">
          <h2 className="font-titulo text-2xl font-semibold">También te puede gustar</h2>
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">
            {relacionados.map((p) => (
              <TarjetaPatron key={p.slug} patron={p} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
