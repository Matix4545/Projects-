import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado, Pie } from "@/components/Marco";
import { Filtros } from "@/components/Filtros";
import { TarjetaVacante } from "@/components/TarjetaVacante";
import { numero } from "@/lib/formato";
import { vistaDeVacante } from "@/lib/muro";
import { tieneAcceso, usuarioActual } from "@/lib/supabase/servidor";
import { buscarVacantes, leerFiltros, POR_PAGINA } from "@/lib/vacantes";

export const metadata: Metadata = {
  title: "Vacantes",
  description: "Vacantes en México y LATAM, y empleos remotos en dólares, sacadas directo de las páginas de empleo de las empresas.",
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Vacantes({ searchParams }: Props) {
  const params = await searchParams;
  const f = leerFiltros(params);
  const usuario = await usuarioActual();
  const acceso = await tieneAcceso(usuario);
  const { vacantes, total } = await buscarVacantes(f, acceso);
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  const enlacePagina = (pagina: number) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (typeof v === "string" && v && k !== "pagina") u.set(k, v);
    if (pagina > 1) u.set("pagina", String(pagina));
    const s = u.toString();
    return s ? `/vacantes?${s}` : "/vacantes";
  };

  return (
    <>
      <Encabezado usuario={usuario} />
      <main className="contenedor space-y-5 py-6 sm:py-8">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Vacantes</h1>
            <p className="text-sm text-gris">{numero(total)} vacantes encontradas · se actualizan todos los días</p>
          </div>
        </div>

        <Filtros f={f} />

        {!acceso && (
          <div className="flex flex-col gap-3 rounded-2xl bg-noche p-4 text-white sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <p className="text-sm sm:text-base">
              <strong>Vista previa:</strong> ves los puestos y sueldos, pero la empresa y el enlace para aplicar están ocultos.
            </p>
            <Link href="/precios" className="boton shrink-0 px-4 py-2 text-sm">
              Desbloquear desde $49 MXN
            </Link>
          </div>
        )}

        {vacantes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-borde bg-white p-10 text-center text-gris">
            <p className="font-medium text-tinta">No encontramos vacantes con esos filtros.</p>
            <p className="mt-1 text-sm">
              Prueba quitar alguno o{" "}
              <Link href="/vacantes" className="font-semibold text-radar-oscuro hover:underline">
                ver todas
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {vacantes.map((v) => {
              const vista = vistaDeVacante(v, acceso);
              return <TarjetaVacante key={vista.id} v={vista} />;
            })}
          </div>
        )}

        {paginas > 1 && (
          <nav className="flex items-center justify-center gap-3 pt-2 text-sm" aria-label="Páginas">
            {f.pagina > 1 ? (
              <Link href={enlacePagina(f.pagina - 1)} className="boton-secundario px-4 py-2">
                ← Anterior
              </Link>
            ) : (
              <span className="boton-secundario pointer-events-none px-4 py-2 opacity-40">← Anterior</span>
            )}
            <span className="text-gris">
              Página {f.pagina} de {numero(paginas)}
            </span>
            {f.pagina < paginas ? (
              <Link href={enlacePagina(f.pagina + 1)} className="boton-secundario px-4 py-2">
                Siguiente →
              </Link>
            ) : (
              <span className="boton-secundario pointer-events-none px-4 py-2 opacity-40">Siguiente →</span>
            )}
          </nav>
        )}
      </main>
      <Pie />
    </>
  );
}
