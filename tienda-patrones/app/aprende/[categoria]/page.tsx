import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CATEGORIAS_PATRONAJE, MODELOS, type Categoria } from "@/patronaje/modelos/index.ts";
import { Diagrama } from "@/components/Diagrama";

type Params = { params: Promise<{ categoria: string }> };

const valida = (c: string): c is Categoria => c in CATEGORIAS_PATRONAJE && MODELOS.some((m) => m.categoria === c);

export function generateStaticParams() {
  return (Object.keys(CATEGORIAS_PATRONAJE) as Categoria[]).filter(valida).map((categoria) => ({ categoria }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { categoria } = await params;
  if (!valida(categoria)) return {};
  const info = CATEGORIAS_PATRONAJE[categoria];
  const nombres = MODELOS.filter((m) => m.categoria === categoria).map((m) => m.nombre.toLowerCase());
  return {
    title: `${info.nombre}: cómo se trazan`,
    description: `${info.intro} Incluye: ${nombres.slice(0, 8).join(", ")}.`,
  };
}

export default async function CategoriaAprende({ params }: Params) {
  const { categoria } = await params;
  if (!valida(categoria)) notFound();
  const info = CATEGORIAS_PATRONAJE[categoria];
  const lista = MODELOS.filter((m) => m.categoria === categoria);
  const otras = (Object.keys(CATEGORIAS_PATRONAJE) as Categoria[]).filter((c) => c !== categoria && valida(c));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <nav className="text-sm text-suave" aria-label="Ruta">
        <Link href="/aprende" className="hover:text-tinta">Aprende</Link>
        <span className="mx-2">/</span>
        <span>{info.nombre}</span>
      </nav>
      <h1 className="mt-3 font-titulo text-4xl font-semibold sm:text-5xl">{info.nombre}</h1>
      <p className="mt-3 max-w-2xl text-lg text-suave">{info.intro}</p>

      <div className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-2">
        {lista.map((m) => (
          <a key={m.id} href={`#${m.id}`} className="whitespace-nowrap rounded-full border border-borde bg-tarjeta px-4 py-2 text-sm font-medium hover:border-tinta">
            {m.nombre}
          </a>
        ))}
      </div>

      <div className="mt-8 space-y-8">
        {lista.map((m) => (
          <article key={m.id} id={m.id} className="scroll-mt-28 overflow-hidden rounded-3xl border border-borde bg-tarjeta lg:grid lg:grid-cols-[1.1fr_1fr]">
            <div className="papel-patron flex min-h-64 items-center justify-center p-6">
              <Diagrama modelo={m} className="w-full" />
            </div>
            <div className="p-6 sm:p-8">
              <h2 className="font-titulo text-3xl font-semibold">{m.nombre}</h2>
              <p className="mt-2 text-suave">{m.descripcion}</p>
              {m.telas ? (
                <p className="mt-3 text-sm">
                  <strong>Telas:</strong> <span className="text-suave">{m.telas}</span>
                </p>
              ) : null}
              <h3 className="mt-5 font-semibold">Cómo se traza</h3>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-suave">
                {m.pasos.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ol>
            </div>
          </article>
        ))}
      </div>

      <section className="mt-14">
        <h2 className="font-titulo text-2xl font-semibold">Sigue aprendiendo</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {otras.map((c) => (
            <Link key={c} href={`/aprende/${c}`} className="rounded-full border border-borde bg-tarjeta px-5 py-2.5 font-medium hover:border-tinta">
              {CATEGORIAS_PATRONAJE[c].nombre}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
