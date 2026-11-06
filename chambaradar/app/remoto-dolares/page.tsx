import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { IMAGEN_OG, IMAGEN_X } from "@/lib/compartir";
import { CapturaCorreo } from "@/components/CapturaCorreo";
import { Confianza } from "@/components/Confianza";
import { BarraDesbloquear, BloqueDesbloquear } from "@/components/Desbloquear";
import { Flecha } from "@/components/Iconos";
import { Encabezado, Pie } from "@/components/Marco";
import { TarjetaVacante, type ContextoTarjeta } from "@/components/TarjetaVacante";
import { numero } from "@/lib/formato";
import { pesosPor, preciosPara } from "@/lib/monedas";
import { pagosActivos, PLANES } from "@/lib/planes";
import { accesoLocal, usuarioActual } from "@/lib/supabase/servidor";
import { PAISES } from "@/lib/tipos";
import { paisVisitante } from "@/lib/ubicacion";
import { paisHomeOffice, POR_PAGINA, remotoDolares, resumen, vacanteEjemplo } from "@/lib/vacantes";

// Landing para quien llega de anuncios buscando "trabajo remoto en dólares":
// primero las vacantes con sueldo publicado (grande, en USD y pesos), áreas
// masivas y puestos de entrada antes que lo senior técnico, confianza arriba,
// una vacante completa de ejemplo y captura de correo.

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const p = await searchParams;
  const pais = paisHomeOffice(uno(p.pais), await paisVisitante());
  const nombre = PAISES[pais] ?? "México";
  const titulo = `Trabajo remoto en dólares para ${nombre}: vacantes con sueldo publicado`;
  const descripcion = `Vacantes 100 % home office que aceptan gente de ${nombre}, con el sueldo en dólares a la vista, tomadas directo de las páginas de empleo de las empresas. Aplicas gratis en la página oficial; nadie te cobra por contratarte.`;
  const pagina = Number(uno(p.pagina)) > 1 ? `?pagina=${Number(uno(p.pagina))}` : "";
  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: `/remoto-dolares${pagina}` },
    openGraph: { title: `${titulo} · ChambaRadar`, description: descripcion, url: `/remoto-dolares`, type: "website", siteName: "ChambaRadar", locale: "es_MX", images: IMAGEN_OG },
    twitter: { card: "summary_large_image", title: `${titulo} · ChambaRadar`, description: descripcion, images: IMAGEN_X },
    robots: pagina ? { index: false, follow: true } : undefined,
  };
}

export default async function RemotoDolares({ searchParams }: Props) {
  const p = await searchParams;
  const pagina = Math.min(Math.max(1, Math.floor(Number(uno(p.pagina))) || 1), 100);
  const [usuario, visitante] = await Promise.all([usuarioActual(), paisVisitante()]);
  const pais = paisHomeOffice(uno(p.pais), visitante);
  const nombre = PAISES[pais] ?? "México";
  const accesoUsuario = await accesoLocal(usuario);
  const [precios, tasaUsd, r, ejemplo, { vacantes, total, conSueldo, acceso }] = await Promise.all([
    preciosPara(visitante, PLANES.find((x) => x.id === "semana")!.precio, PLANES.find((x) => x.id === "mes")!.precio),
    pesosPor("USD"),
    resumen().catch(() => null),
    pagina === 1 ? vacanteEjemplo(pais).catch(() => null) : null,
    remotoDolares(pais, pagina, accesoUsuario),
  ]);
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const enlacePagina = (n: number) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(p)) if (typeof v === "string" && v && k !== "pagina") u.set(k, v);
    if (n > 1) u.set("pagina", String(n));
    const s = u.toString();
    return s ? `/remoto-dolares?${s}` : "/remoto-dolares";
  };
  const ctx: ContextoTarjeta = {
    conSesion: Boolean(usuario),
    pagosActivos: pagosActivos(),
    precios,
    resumen: r ? `${numero(r.total)} vacantes de ${numero(r.empresas)} empresas` : "",
    sueldoGrande: { tasaUsd },
  };
  const vender = !acceso && ctx.pagosActivos;
  const captura = <CapturaCorreo origen="remoto-dolares" />;

  return (
    <>
      <Encabezado usuario={usuario} />
      <main className="contenedor max-w-3xl space-y-5 py-6 sm:py-8">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-radar-oscuro">Home office que acepta gente de {nombre}</p>
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            {numero(conSueldo)} vacantes remotas con el sueldo en dólares a la vista
            <span className="text-gris"> y {numero(Math.max(0, total - conSueldo))} más sin sueldo publicado</span>
          </h1>
          <p className="text-gris">
            Tomadas hoy de las páginas de empleo de las empresas, no de LinkedIn ni OCC. Primero las que dicen cuánto pagan; atención a clientes, ventas, asistentes y
            operaciones antes que lo técnico. Las que son solo para EE. UU. no aparecen.
          </p>
        </div>

        <Confianza />

        {ejemplo && (
          <section className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-emerald-800">Ejemplo real</span>
              Así se ve una vacante desbloqueada: empresa, descripción y enlace para aplicar
            </p>
            <div className="rounded-2xl border-2 border-emerald-300 p-0.5">
              <TarjetaVacante v={ejemplo} ctx={ctx} />
            </div>
            <p className="text-xs text-gris">Esta la ves completa sin pagar para que sepas exactamente qué recibes. Las demás muestran puesto, sueldo y ubicación; la empresa y el enlace se desbloquean con el plan.</p>
          </section>
        )}

        {vender && <BloqueDesbloquear titular={`Aplica directo a las ${numero(total)} vacantes remotas para ${nombre}`} conSesion={Boolean(usuario)} pais={pais} precios={precios} empresas={r?.empresas ?? 0} />}

        {vacantes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-borde bg-white p-10 text-center text-gris">
            <p className="font-medium text-tinta">Por ahora no hay vacantes remotas para {nombre}.</p>
            <p className="mt-1 text-sm">
              <Link href="/vacantes" className="font-semibold text-radar-oscuro hover:underline">
                Ver todas las vacantes
              </Link>
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pagina > 1 && <p className="text-sm text-gris">Página {pagina} de {numero(paginas)}</p>}
            {vacantes.map((v, i) => (
              <Fragment key={v.id}>
                <TarjetaVacante v={v} ctx={ctx} />
                {pagina === 1 && i === Math.min(2, vacantes.length - 1) && captura}
              </Fragment>
            ))}
          </div>
        )}

        {paginas > 1 && (
          <nav className="flex items-center justify-center gap-3 pt-2 text-sm" aria-label="Páginas">
            {pagina > 1 ? (
              <Link href={enlacePagina(pagina - 1)} className="boton-secundario px-4 py-2">
                ← Anterior
              </Link>
            ) : (
              <span className="boton-secundario pointer-events-none px-4 py-2 opacity-40">← Anterior</span>
            )}
            <span className="text-gris">
              Página {pagina} de {numero(paginas)}
            </span>
            {pagina < paginas ? (
              <Link href={enlacePagina(pagina + 1)} className="boton-secundario px-4 py-2">
                Siguiente →
              </Link>
            ) : (
              <span className="boton-secundario pointer-events-none px-4 py-2 opacity-40">Siguiente →</span>
            )}
          </nav>
        )}

        {pagina > 1 && captura}

        <section className="space-y-3 rounded-2xl border border-borde bg-white p-5 text-sm text-slate-700">
          <h2 className="text-lg font-bold">¿Cómo funciona?</h2>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>Revisamos todos los días las páginas de empleo de {r ? numero(r.empresas) : "cientos de"} empresas (Greenhouse, Lever, Workday y otras) y juntamos las remotas que aceptan gente de {nombre}.</li>
            <li>Gratis ves el puesto, el sueldo (cuando la empresa lo publica) y la ubicación.</li>
            <li>Con el plan ({precios.semana} por una semana, pago único) ves qué empresa es y el enlace para aplicar <strong>directo en su página</strong>. Nosotros no intervenimos en la contratación ni cobramos comisión.</li>
          </ol>
          <p className="text-gris">
            ¿Quieres filtrar por área o buscar por palabra?{" "}
            <Link href="/vacantes?donde=remoto" className="inline-flex items-center gap-1 font-semibold text-radar-oscuro hover:underline">
              Ir al buscador completo <Flecha className="size-3.5" />
            </Link>
          </p>
        </section>
      </main>
      <Pie />
      {vender && (
        <>
          <div className="h-16 bg-noche lg:hidden" aria-hidden />
          <BarraDesbloquear precios={precios} />
        </>
      )}
    </>
  );
}
