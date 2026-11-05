import type { Metadata } from "next";
import Link from "next/link";
import { Flecha } from "@/components/Iconos";
import { Encabezado, Pie } from "@/components/Marco";
import { usuarioActual } from "@/lib/supabase/servidor";

export const metadata: Metadata = {
  title: "Herramientas gratis para buscar chamba",
  description: "Calculadora de sueldo neto con ISR e IMSS 2026, conversor de sueldos en dólares a pesos y creador de CV gratis. Sin registro.",
  alternates: { canonical: "/herramientas" },
};

const HERRAMIENTAS = [
  { ruta: "/herramientas/sueldo-neto", emoji: "🧮", nombre: "Calculadora de sueldo neto", texto: "Cuánto te queda después de ISR e IMSS (2026), y vacantes que pagan eso." },
  { ruta: "/herramientas/dolares-a-pesos", emoji: "💵", nombre: "Dólares a pesos al mes", texto: "Lo que ganarías en un home office en dólares, al tipo de cambio de hoy." },
  { ruta: "/cv", emoji: "📄", nombre: "Haz tu CV gratis", texto: "En español o en inglés, listo en PDF en 10 minutos." },
];

export default async function Herramientas() {
  const usuario = await usuarioActual();
  return (
    <>
      <Encabezado usuario={usuario} />
      <main className="contenedor max-w-3xl space-y-6 py-10">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Herramientas gratis</h1>
          <p className="mt-2 text-gris">Sin registro y sin trucos. Cada una termina en vacantes reales.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {HERRAMIENTAS.map((h) => (
            <Link key={h.ruta} href={h.ruta} className="group rounded-2xl border border-borde bg-white p-5 transition hover:border-radar hover:shadow-md">
              <p className="text-3xl">{h.emoji}</p>
              <h2 className="mt-3 font-bold">{h.nombre}</h2>
              <p className="mt-1 text-sm text-gris">{h.texto}</p>
              <p className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-radar-oscuro">
                Abrir <Flecha className="size-3.5 transition group-hover:translate-x-1" />
              </p>
            </Link>
          ))}
        </div>
      </main>
      <Pie />
    </>
  );
}
