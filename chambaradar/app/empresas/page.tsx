import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado, Pie } from "@/components/Marco";
import { numero } from "@/lib/formato";
import { PAISES } from "@/lib/tipos";
import { usuarioActual } from "@/lib/supabase/servidor";
import { empresasConVacantes } from "@/lib/vacantes";

export const metadata: Metadata = {
  title: "Empresas que contratan en México, LATAM y remoto",
  description: "Empresas con vacantes en México y LATAM, y empresas que contratan home office desde la región.",
};

export default async function Empresas() {
  const [usuario, empresas] = await Promise.all([usuarioActual(), empresasConVacantes()]);
  const grupos = [
    { titulo: "Empresas mexicanas y de LATAM", lista: empresas.filter((e) => e.tipo === "local") },
    { titulo: "Empresas extranjeras", lista: empresas.filter((e) => e.tipo === "remoto") },
  ];

  return (
    <>
      <Encabezado usuario={usuario} />
      <main className="contenedor space-y-10 py-10">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-extrabold tracking-tight">Empresas que están contratando</h1>
          <p className="mt-2 text-gris">
            {numero(empresas.length)} empresas con vacantes hoy en México, LATAM o home office. Para ver qué vacante es de cuál empresa y aplicar,{" "}
            <Link href="/precios" className="font-semibold text-radar-oscuro hover:underline">
              desbloquea tu acceso
            </Link>
            .
          </p>
        </div>
        {grupos.map(
          (g) =>
            g.lista.length > 0 && (
              <section key={g.titulo} className="space-y-3">
                <h2 className="text-xl font-bold">{g.titulo}</h2>
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {g.lista.map((e) => (
                    <li key={e.slug} className="rounded-2xl border border-borde bg-white p-4">
                      <p className="font-semibold">{e.nombre}</p>
                      <p className="text-sm text-gris">
                        {numero(e.total)} {e.total === 1 ? "vacante" : "vacantes"}
                        {e.remotas > 0 && ` · ${numero(e.remotas)} remotas`}
                      </p>
                      {e.paises.length > 0 && (
                        <p className="mt-1 text-xs text-gris">{e.paises.slice(0, 5).map((p) => PAISES[p] ?? p).join(", ")}{e.paises.length > 5 ? "…" : ""}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ),
        )}
      </main>
      <Pie />
    </>
  );
}
