import type { Metadata } from "next";
import Link from "next/link";
import { CATEGORIAS_PATRONAJE, MODELOS, type Categoria } from "@/patronaje/modelos/index.ts";
import { Diagrama } from "@/components/Diagrama";

export const metadata: Metadata = {
  title: "Aprende patronaje: escotes, cuellos, mangas, pinzas, faldas y pantalones",
  description:
    "Guía de tipos de escote, cuello, manga, pinzas, cortes de vestido, faldas y pantalones, con el trazo paso a paso desde el patrón base.",
};

export default function Aprende() {
  const categorias = (Object.keys(CATEGORIAS_PATRONAJE) as Categoria[]).filter((c) => MODELOS.some((m) => m.categoria === c));
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-sm font-semibold uppercase tracking-widest text-acento">Aprende patronaje</p>
      <h1 className="mt-2 max-w-3xl font-titulo text-4xl font-semibold leading-tight sm:text-5xl">
        Transforma un patrón base en cualquier prenda
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-suave">
        Todos los tipos de escote, cuello, manga, pinza, vestido, falda y pantalón, con las piezas dibujadas y el trazo paso a paso.
        Los diagramas salen de nuestro propio sistema de patronaje, el mismo de los patrones de la tienda.
      </p>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {categorias.map((c) => {
          const lista = MODELOS.filter((m) => m.categoria === c);
          const ejemplo = lista[Math.min(1, lista.length - 1)];
          return (
            <Link key={c} href={`/aprende/${c}`} className="group flex flex-col overflow-hidden rounded-3xl border border-borde bg-tarjeta hover:shadow-lg">
              <div className="papel-patron flex h-56 items-center justify-center p-5">
                <Diagrama modelo={ejemplo} className="h-full w-full" />
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h2 className="font-titulo text-2xl font-semibold group-hover:text-acento-oscuro">{CATEGORIAS_PATRONAJE[c].nombre}</h2>
                <p className="mt-1 flex-1 text-sm text-suave">{CATEGORIAS_PATRONAJE[c].intro}</p>
                <p className="mt-3 text-sm font-semibold text-acento-oscuro">{lista.length} tipos →</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
