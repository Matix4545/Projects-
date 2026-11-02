import type { Metadata } from "next";
import Link from "next/link";
import { BotonAlerta } from "@/components/BotonAlerta";
import { Buscador, FiltrosLaterales, FiltrosMovil } from "@/components/Filtros";
import { Candado } from "@/components/Iconos";
import { Encabezado, Pie } from "@/components/Marco";
import { TarjetaVacante, type ContextoTarjeta } from "@/components/TarjetaVacante";
import { filtrosParaAlerta } from "@/lib/alertas";
import { correoConfigurado } from "@/lib/correo";
import { numero } from "@/lib/formato";
import { pagosActivos } from "@/lib/planes";
import { accesoLocal, usuarioActual } from "@/lib/supabase/servidor";
import { NOMBRE_CATEGORIA, NOMBRE_ZONA, PAISES } from "@/lib/tipos";
import { buscarVacantes, leerFiltros, POR_PAGINA, resumen } from "@/lib/vacantes";

export const metadata: Metadata = {
  title: "Vacantes",
  description: "Vacantes en Ciudad Obregón y Sonora, y trabajos remotos (home office) para todo México, sacadas directo de las páginas de empleo de las empresas.",
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Vacantes({ searchParams }: Props) {
  const params = await searchParams;
  const f = leerFiltros(params);
  const usuario = await usuarioActual();
  const [{ vacantes, total, acceso }, r] = await Promise.all([buscarVacantes(f, accesoLocal(usuario)), resumen()]);
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  const enlacePagina = (pagina: number) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (typeof v === "string" && v && k !== "pagina" && k !== "alerta") u.set(k, v);
    if (pagina > 1) u.set("pagina", String(pagina));
    const s = u.toString();
    return s ? `/vacantes?${s}` : "/vacantes";
  };

  const ctx: ContextoTarjeta = {
    conSesion: Boolean(usuario),
    pagosActivos: pagosActivos(),
    resumen: `${numero(r.total)} vacantes de ${numero(r.empresas)} empresas`,
  };

  // Título según lo que se está viendo: "Software e ingeniería en México"
  const lugar = f.zona ? `en ${NOMBRE_ZONA[f.zona]}` : f.modalidad === "remoto" ? "home office" : f.pais ? `en ${PAISES[f.pais]}` : "";
  const titulo = f.categoria
    ? `${NOMBRE_CATEGORIA[f.categoria]}${lugar ? (lugar === "home office" ? " · home office" : ` ${lugar}`) : ""}`
    : lugar === "home office"
      ? "Home office / remoto"
      : lugar
        ? `Vacantes ${lugar}`
        : "Obregón, Sonora y home office";

  return (
    <>
      <Encabezado usuario={usuario} buscador={<Buscador f={f} />} />
      <main className="contenedor grid gap-6 py-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:py-8">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <FiltrosLaterales f={f} />
          </div>
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg leading-snug font-bold tracking-tight sm:text-2xl">{titulo}</h1>
              <p className="text-sm text-gris">
                {numero(total)} {total === 1 ? "vacante" : "vacantes"}
                {f.q ? ` para «${f.q}»` : ""} · actualizado hoy
              </p>
            </div>
            <FiltrosMovil f={f} total={numero(total)} />
          </div>

          {!acceso && (
            <Link href="/precios" className="flex items-center gap-3 rounded-2xl bg-noche px-4 py-3 text-sm text-white transition hover:bg-noche-2 sm:px-5">
              <Candado className="size-4 shrink-0 text-radar" />
              <span className="flex-1">
                <strong>Vista previa.</strong> Ves puestos y sueldos; la empresa y el enlace para aplicar están ocultos.
              </span>
              <span className="hidden shrink-0 font-semibold text-radar sm:inline">{ctx.pagosActivos ? "Desbloquear →" : "Ver planes →"}</span>
            </Link>
          )}

          <BotonAlerta
            filtros={filtrosParaAlerta(f)}
            vuelta={enlacePagina(1)}
            estado={typeof params.alerta === "string" ? params.alerta : undefined}
            correoActivo={correoConfigurado()}
          />

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
            <div className="space-y-4">
              {vacantes.map((v) => (
                <TarjetaVacante key={v.id} v={v} ctx={ctx} />
              ))}
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
        </section>
      </main>
      <Pie />
    </>
  );
}
