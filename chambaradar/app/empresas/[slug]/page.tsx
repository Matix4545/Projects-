import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IMAGEN_OG, IMAGEN_X } from "@/lib/compartir";
import { BloqueDesbloquear } from "@/components/Desbloquear";
import { Flecha } from "@/components/Iconos";
import { Encabezado, Pie } from "@/components/Marco";
import { TarjetaVacante, type ContextoTarjeta } from "@/components/TarjetaVacante";
import { haceCuanto, numero } from "@/lib/formato";
import { preciosPara } from "@/lib/monedas";
import { pagosActivos, PLANES } from "@/lib/planes";
import { accesoLocal, usuarioActual } from "@/lib/supabase/servidor";
import { NOMBRE_CATEGORIA, NOMBRE_ZONA, PAISES, type Categoria, type Zona } from "@/lib/tipos";
import { paisVisitante } from "@/lib/ubicacion";
import { empresasConVacantes, vacantesDeEmpresa } from "@/lib/vacantes";

type Props = { params: Promise<{ slug: string }> };

const MODALIDAD: Record<string, string> = { remoto: "Home office", hibrido: "Híbrido", presencial: "Presencial" };
const limpiarSlug = (s: string) => (/^[a-z0-9-]{1,80}$/.test(s) ? s : null);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = limpiarSlug((await params).slug);
  const e = slug ? await vacantesDeEmpresa(slug) : null;
  if (!e) return { title: "Empresa no encontrada", robots: { index: false } };
  const titulo = `Trabajar en ${e.nombre}: ${numero(e.total)} vacantes y sueldos`;
  const lugares = e.paises.slice(0, 3).map((p) => PAISES[p.clave] ?? p.clave).join(", ");
  const descripcion = `${e.nombre} tiene ${numero(e.total)} vacantes abiertas hoy${e.remotas ? `, ${numero(e.remotas)} home office` : ""}${lugares ? ` (${lugares})` : ""}: áreas, sueldos publicados y cómo aplicar directo en su página de empleo.`;
  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: `/empresas/${slug}` },
    openGraph: { title: `${titulo} · ChambaRadar`, description: descripcion, url: `/empresas/${slug}`, type: "website", siteName: "ChambaRadar", locale: "es_MX", images: IMAGEN_OG },
    twitter: { card: "summary_large_image", title: `${titulo} · ChambaRadar`, description: descripcion, images: IMAGEN_X },
  };
}

function Dato({ n, t }: { n: number; t: string }) {
  return (
    <div className="rounded-2xl border border-borde bg-white px-4 py-3">
      <p className="text-2xl font-extrabold tabular-nums">{numero(n)}</p>
      <p className="text-xs text-gris">{t}</p>
    </div>
  );
}

export default async function PaginaEmpresa({ params }: Props) {
  const slug = limpiarSlug((await params).slug);
  if (!slug) notFound();
  const [usuario, pais] = await Promise.all([usuarioActual(), paisVisitante()]);
  const acceso = await accesoLocal(usuario);
  const e = await vacantesDeEmpresa(slug);
  if (!e) notFound();
  const [precios, todas] = await Promise.all([
    preciosPara(pais, PLANES.find((p) => p.id === "semana")!.precio, PLANES.find((p) => p.id === "mes")!.precio),
    empresasConVacantes().catch(() => []),
  ]);
  const ctx: ContextoTarjeta = { conSesion: Boolean(usuario), pagosActivos: pagosActivos(), precios, resumen: "" };
  const areaPrincipal = e.areas[0]?.clave as Categoria | undefined;
  const parecidas = todas.filter((x) => x.slug !== slug && x.tipo === e.tipo).sort((a, b) => Math.abs(a.total - e.total) - Math.abs(b.total - e.total)).slice(0, 6);
  const estados = e.estados.filter((z) => z.clave in NOMBRE_ZONA);

  return (
    <>
      <Encabezado usuario={usuario} />
      <main className="contenedor max-w-4xl space-y-8 py-8">
        <div className="space-y-3">
          <p className="text-sm text-gris">
            <Link href="/empresas" className="font-medium text-radar-oscuro hover:underline">
              Empresas
            </Link>{" "}
            › {e.nombre}
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Trabajar en {e.nombre}: vacantes y sueldos</h1>
          <p className="text-gris">
            {e.tipo === "remoto" ? "Empresa extranjera que contrata en México y LATAM." : "Empresa con operación en México o LATAM."} Vacantes tomadas directo de su página de
            empleo · última publicada {haceCuanto(e.ultima)}.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {e.paises.slice(0, 6).map((p) => (
              <span key={p.clave} className="chip">
                {PAISES[p.clave] ?? p.clave} · {numero(p.n)}
              </span>
            ))}
            {estados.slice(0, 6).map((z) => (
              <Link key={z.clave} href={`/vacantes?donde=${z.clave}`} className="chip hover:border-radar">
                {NOMBRE_ZONA[z.clave as Zona]} · {numero(z.n)}
              </Link>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Dato n={e.total} t="vacantes abiertas" />
          <Dato n={e.remotas} t="home office" />
          <Dato n={e.en_espanol} t="en español" />
          <Dato n={e.con_sueldo} t="con sueldo publicado" />
        </div>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-borde bg-white p-5">
            <h2 className="font-bold">Áreas que están contratando</h2>
            <ul className="mt-2 space-y-1.5 text-sm">
              {e.areas.slice(0, 8).map((a) => (
                <li key={a.clave} className="flex justify-between gap-3">
                  <Link href={`/vacantes?categoria=${a.clave}`} className="text-radar-oscuro hover:underline">
                    {NOMBRE_CATEGORIA[a.clave as Categoria] ?? a.clave}
                  </Link>
                  <span className="font-semibold tabular-nums">{numero(a.n)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-borde bg-white p-5">
            <h2 className="font-bold">Modalidad</h2>
            <ul className="mt-2 space-y-1.5 text-sm">
              {e.modalidades.map((m) => (
                <li key={m.clave} className="flex justify-between gap-3">
                  <span>{MODALIDAD[m.clave] ?? m.clave}</span>
                  <span className="font-semibold tabular-nums">{numero(m.n)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-gris">
              {acceso
                ? "Tienes acceso: cada vacante lleva el enlace para aplicar directo en la página de la empresa."
                : "Gratis ves puesto, sueldo y ubicación. El enlace para aplicar directo se desbloquea con un plan."}
            </p>
          </div>
        </section>

        {!acceso && ctx.pagosActivos && (
          <BloqueDesbloquear titular={`Aplica directo a las ${numero(e.total)} vacantes de ${e.nombre}`} conSesion={Boolean(usuario)} pais={pais ?? "MX"} precios={precios} empresas={todas.length} />
        )}

        <section className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight">Vacantes abiertas hoy</h2>
          {/* En su propia página la empresa es pública (es el título); el enlace y la descripción siguen bloqueados */}
          {e.vacantes.map((v) => (
            <TarjetaVacante key={v.id} v={{ ...v, empresa_nombre: e.nombre }} ctx={ctx} />
          ))}
          {e.total > e.vacantes.length && (
            <p className="text-sm text-gris">Mostramos las {numero(e.vacantes.length)} más recientes de {numero(e.total)}.</p>
          )}
        </section>

        {parecidas.length > 0 && (
          <section className="rounded-2xl border border-borde bg-white p-5">
            <h2 className="font-bold">Empresas parecidas que también contratan</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {parecidas.map((p) => (
                <Link key={p.slug} href={`/empresas/${p.slug}`} className="chip hover:border-radar">
                  {p.nombre} · {numero(p.total)}
                </Link>
              ))}
            </div>
          </section>
        )}

        {areaPrincipal && (
          <p className="text-sm text-gris">
            ¿Buscas en esa área en otras empresas?{" "}
            <Link href={`/vacantes?categoria=${areaPrincipal}`} className="inline-flex items-center gap-1 font-semibold text-radar-oscuro hover:underline">
              Ver todas las de {NOMBRE_CATEGORIA[areaPrincipal]} <Flecha className="size-3.5" />
            </Link>
          </p>
        )}
      </main>
      <Pie />
    </>
  );
}
