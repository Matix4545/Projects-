import type { Metadata } from "next";
import { IMAGEN_OG, IMAGEN_X } from "@/lib/compartir";
import Link from "next/link";
import { Fragment } from "react";
import { BotonAlerta } from "@/components/BotonAlerta";
import { BarraDesbloquear, BloqueDesbloquear } from "@/components/Desbloquear";
import { Buscador, FiltrosLaterales, FiltrosMovil } from "@/components/Filtros";
import { Candado } from "@/components/Iconos";
import { Encabezado, Pie } from "@/components/Marco";
import { TarjetaVacante, type ContextoTarjeta } from "@/components/TarjetaVacante";
import { filtrosParaAlerta } from "@/lib/alertas";
import { correoConfigurado } from "@/lib/correo";
import { numero } from "@/lib/formato";
import { pagosActivos } from "@/lib/planes";
import { accesoLocal, usuarioActual } from "@/lib/supabase/servidor";
import { paisVisitante, visitanteLocal } from "@/lib/ubicacion";
import { PAISES } from "@/lib/tipos";
import { descripcionDeFiltros, indexable, rutaCanonica, tituloDeFiltros } from "@/lib/seo";
import { buscarVacantes, leerFiltros, POR_PAGINA, resumen } from "@/lib/vacantes";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Título, descripción y canónica según los filtros (Google ve una página por área y lugar). */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const f = leerFiltros(params);
  const pagina = f.pagina > 1 ? ` · página ${f.pagina}` : "";
  const canonica = rutaCanonica(f);
  const compartir = await textoParaCompartir(f);
  return {
    title: `${tituloDeFiltros(f)}${pagina}`,
    description: descripcionDeFiltros(f),
    alternates: { canonical: canonica },
    openGraph: { title: compartir.titulo, description: compartir.descripcion, url: canonica, type: "website", siteName: "ChambaRadar", locale: "es_MX", images: IMAGEN_OG },
    twitter: { card: "summary_large_image", title: compartir.titulo, description: compartir.descripcion, images: IMAGEN_X },
    robots: indexable(f, params) ? undefined : { index: false, follow: true },
  };
}

/** Lo que sale al compartir el enlace en Facebook o WhatsApp: con el número de vacantes cuando aplica. */
async function textoParaCompartir(f: ReturnType<typeof leerFiltros>): Promise<{ titulo: string; descripcion: string }> {
  const sinMas = !f.categoria && !f.q;
  if (sinMas && (f.zona === "sonora" || f.zona === "cajeme" || (f.modalidad === "remoto" && !f.pais))) {
    const r = await resumen().catch(() => null);
    if (f.zona === "sonora" && r)
      return { titulo: `${numero(r.enSonora)} vacantes en Sonora · ChambaRadar`, descripcion: "Empleos en Hermosillo, Cd. Obregón, Navojoa, Guaymas y todo Sonora, directo de las páginas de las empresas. Actualizado todos los días." };
    if (f.zona === "cajeme" && r)
      return { titulo: `${numero(r.enCajeme)} vacantes en Cd. Obregón · ChambaRadar`, descripcion: "Empleos en Ciudad Obregón (Cajeme), directo de las páginas de las empresas. Actualizado todos los días." };
    if (f.aceptaPais && f.aceptaPais !== "MX") {
      const nombre = PAISES[f.aceptaPais];
      return { titulo: `Vacantes home office para ${nombre} · ChambaRadar`, descripcion: `Trabajos 100 % remotos que aceptan gente de ${nombre}, de empresas de LATAM y del mundo. Directo de las páginas de empleo de las empresas.` };
    }
    if (r)
      return { titulo: `${numero(r.remotas)} vacantes home office para México · ChambaRadar`, descripcion: "Trabajos 100 % remotos que aceptan gente en México y LATAM, de empresas mexicanas y extranjeras. Los que son solo para EE. UU. no aparecen." };
  }
  return { titulo: `${tituloDeFiltros(f)} · ChambaRadar`, descripcion: descripcionDeFiltros(f) };
}

/** "621 vacantes home office que aceptan gente de México", "71 vacantes en Sonora"… */
function titularVenta(f: ReturnType<typeof leerFiltros>, total: number, titulo: string): string {
  const n = numero(total);
  if (f.aceptaPais && !f.categoria) return `${n} vacantes home office que aceptan gente de ${PAISES[f.aceptaPais] ?? "México"}`;
  if (titulo.startsWith("Vacantes ")) return `${n} vacantes ${titulo.slice("Vacantes ".length)}`;
  return `${n} vacantes de ${titulo.charAt(0).toLowerCase()}${titulo.slice(1)}`;
}

export default async function Vacantes({ searchParams }: Props) {
  const params = await searchParams;
  const [local, pais] = await Promise.all([visitanteLocal(), paisVisitante()]);
  const f = leerFiltros(params, local, pais);
  // OXXO solo existe en México; afuera se paga con tarjeta (Stripe cobra en la moneda local)
  const enMexico = !pais || pais === "MX";
  const usuario = await usuarioActual();
  const [{ vacantes, total, acceso }, r] = await Promise.all([buscarVacantes(f, await accesoLocal(usuario)), resumen()]);
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
    oxxo: enMexico,
    resumen: `${numero(r.total)} vacantes de ${numero(r.empresas)} empresas`,
  };

  const titulo = tituloDeFiltros(f);
  const alerta = (
    <BotonAlerta
      filtros={filtrosParaAlerta(f)}
      vuelta={enlacePagina(1)}
      estado={typeof params.alerta === "string" ? params.alerta : undefined}
      correoActivo={correoConfigurado()}
    />
  );

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

          {acceso && local && !usuario?.conAcceso && (
            <p className="rounded-2xl bg-radar-claro px-4 py-3 text-sm text-radar-oscuro sm:px-5">
              <strong>Acceso completo gratis</strong> por estar en Sonora: ves la empresa y el enlace para aplicar en todas las vacantes.
            </p>
          )}

          {!acceso && ctx.pagosActivos && <BloqueDesbloquear titular={titularVenta(f, total, titulo)} conSesion={Boolean(usuario)} pais={f.aceptaPais || pais || "MX"} oxxo={enMexico} />}

          {!acceso && !ctx.pagosActivos && (
            <Link href="/precios" className="flex items-center gap-3 rounded-2xl bg-noche px-4 py-3 text-sm text-white transition hover:bg-noche-2 sm:px-5">
              <Candado className="size-4 shrink-0 text-radar" />
              <span className="flex-1">
                <strong>Vista previa.</strong> Ves puestos y sueldos; la empresa y el enlace para aplicar están ocultos.
              </span>
              <span className="hidden shrink-0 font-semibold text-radar sm:inline">{ctx.pagosActivos ? "Desbloquear →" : "Ver planes →"}</span>
            </Link>
          )}

          {(acceso || !ctx.pagosActivos) && alerta}

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
              {vacantes.map((v, i) => (
                <Fragment key={v.id}>
                  <TarjetaVacante v={v} ctx={ctx} />
                  {!acceso && ctx.pagosActivos && i === Math.min(2, vacantes.length - 1) && alerta}
                </Fragment>
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
      {!acceso && ctx.pagosActivos && (
        <>
          {/* Espacio para que la barra fija no tape el final del pie */}
          <div className="h-16 bg-noche lg:hidden" aria-hidden />
          <BarraDesbloquear oxxo={enMexico} />
        </>
      )}
    </>
  );
}
