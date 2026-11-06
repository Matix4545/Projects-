import type { Metadata } from "next";
import { IMAGEN_OG, IMAGEN_X } from "@/lib/compartir";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Dinero, Flecha, Reloj, Ubicacion } from "@/components/Iconos";
import { Encabezado, Pie } from "@/components/Marco";
import { formatoSueldo, haceCuanto } from "@/lib/formato";
import { jobPosting, jsonLd } from "@/lib/jobposting";
import { idDeRuta, rutaVacante, vacantesPublicas } from "@/lib/publicas";
import { usuarioActual } from "@/lib/supabase/servidor";
import { NOMBRE_CATEGORIA } from "@/lib/tipos";

type Props = { params: Promise<{ id: string }> };

const MODALIDAD = { remoto: "Home office", hibrido: "Híbrido", presencial: "Presencial" } as const;

async function leer(params: Props["params"]) {
  const id = idDeRuta((await params).id);
  if (!id) return null;
  return (await vacantesPublicas(id))[0] ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const v = await leer(params);
  if (!v) return { title: "Vacante no encontrada", robots: { index: false } };
  const titulo = `${v.titulo} en ${v.ubicacion}`;
  const descripcion = `${v.empresa_nombre} busca ${v.titulo.toLowerCase()} en ${v.ubicacion}. ${v.descripcion.replace(/\s+/g, " ").slice(0, 120)}…`;
  const ruta = rutaVacante(v.id);
  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: ruta },
    openGraph: { title: `${titulo} · ChambaRadar`, description: descripcion, url: ruta, type: "website", siteName: "ChambaRadar", locale: "es_MX", images: IMAGEN_OG },
    twitter: { card: "summary_large_image", title: `${titulo} · ChambaRadar`, description: descripcion, images: IMAGEN_X },
  };
}

export default async function Vacante({ params }: Props) {
  const [v, usuario] = await Promise.all([leer(params), usuarioActual()]);
  if (!v) notFound();
  const sueldo = formatoSueldo(v.sueldo_min, v.sueldo_max, v.moneda, v.periodo);
  const contacto = v.url.startsWith("https://wa.me/") ? "Escribir por WhatsApp" : v.url.startsWith("mailto:") ? "Mandar correo" : "Aplicar";

  return (
    <>
      <Encabezado usuario={usuario} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(jobPosting(v, `https://chambaradar.com${rutaVacante(v.id)}`)) }} />
      <main className="contenedor max-w-3xl space-y-6 py-8">
        <Link href="/vacantes?donde=sonora" className="text-sm font-medium text-radar-oscuro hover:underline">
          ← Vacantes en Sonora
        </Link>
        <article className="space-y-5 rounded-3xl border border-borde bg-white p-6 sm:p-8">
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">{v.titulo}</h1>
            <p className="text-lg font-medium text-slate-700">{v.empresa_nombre}</p>
          </div>
          <div className="space-y-1.5 text-[15px]">
            {sueldo && (
              <p className="flex items-center gap-1.5 font-medium text-amber-600">
                <Dinero className="size-4" /> {sueldo}
              </p>
            )}
            <p className="flex items-center gap-1.5 text-slate-600">
              <Ubicacion className="size-4" /> {v.ubicacion}
            </p>
            <p className="flex items-center gap-1.5 text-slate-500" suppressHydrationWarning>
              <Reloj className="size-4" /> Publicada {haceCuanto(v.publicada)}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="chip">{MODALIDAD[v.modalidad]}</span>
            <span className="chip">{NOMBRE_CATEGORIA[v.categoria]}</span>
            <span className="chip bg-radar-claro text-radar-oscuro">Publicada por el negocio en ChambaRadar</span>
          </div>
          {v.descripcion && <p className="whitespace-pre-line leading-relaxed text-slate-700">{v.descripcion}</p>}
          <a href={v.url} target="_blank" rel="noopener noreferrer nofollow" className="boton" data-evento="aplicar" data-vacante={v.id} data-empresa={v.empresa_nombre}>
            {contacto} <Flecha className="size-4" />
          </a>
        </article>
        <p className="text-sm text-gris">
          ¿Tienes un negocio?{" "}
          <Link href="/publicar" className="font-semibold text-radar-oscuro hover:underline">
            Publica tu vacante gratis
          </Link>
          .
        </p>
      </main>
      <Pie />
    </>
  );
}
