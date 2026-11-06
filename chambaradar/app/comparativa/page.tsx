import type { Metadata } from "next";
import Link from "next/link";
import { Flecha } from "@/components/Iconos";
import { Encabezado, Pie } from "@/components/Marco";
import { numero } from "@/lib/formato";
import { usuarioActual } from "@/lib/supabase/servidor";
import { resumen } from "@/lib/vacantes";

export const metadata: Metadata = {
  title: "ChambaRadar vs OCC, Computrabajo y LinkedIn: diferencias honestas",
  description:
    "En qué se diferencia ChambaRadar de OCC, Computrabajo, Indeed y LinkedIn, y cuándo conviene usar cada uno. Sin exagerar: también te decimos en qué ellos son mejores.",
  alternates: { canonical: "/comparativa" },
};

const SI = <span className="font-semibold text-emerald-700">✓</span>;
const NO = <span className="font-semibold text-red-600">✕</span>;

export default async function Comparativa() {
  const [usuario, r] = await Promise.all([usuarioActual(), resumen().catch(() => null)]);
  const filas: [string, React.ReactNode, React.ReactNode, React.ReactNode][] = [
    ["De dónde salen las vacantes", "La empresa paga por publicar", "La empresa o un reclutador publica", "Directo de la página de empleo de cada empresa"],
    ["Competencia por vacante", "Cientos de solicitudes en horas", "Cientos en días", "Poca: casi nadie busca ahí"],
    ["Vacantes de empresas grandes (bancos, manufactura, farmacéuticas, tech)", "Algunas", "Muchas, con reclutadores", "Las que publican en su propio sitio"],
    ["Vacantes de PyMEs y negocios locales", "Muchas", "Pocas", "Pocas (las que publican gratis aquí)"],
    ["Home office que acepta gente de México", "Mezclado con empleos de otros países", "Mezclado", <>Filtrado: solo las que aceptan México</>],
    ["Aplicas", "Dentro del portal", "Dentro de LinkedIn o en la empresa", "Directo con la empresa, en su página"],
    ["Vacantes cerradas", "Pueden quedarse semanas", "Pueden quedarse semanas", "Se revisan todos los días y desaparecen"],
    ["Precio para buscar", "Gratis", "Gratis (Premium opcional)", "Vista previa gratis · $49 por semana para ver empresa y enlace"],
    ["Suscripción que se renueva sola", NO, "Sí, en Premium", NO],
  ];

  return (
    <>
      <Encabezado usuario={usuario} />
      <main className="contenedor max-w-4xl space-y-8 py-8">
        <div className="space-y-3">
          <p className="text-sm font-semibold text-radar-oscuro">Comparativa honesta</p>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">ChambaRadar vs OCC, Computrabajo y LinkedIn</h1>
          <p className="text-gris">
            No somos un reemplazo de los portales grandes: somos otra fuente. Aquí está en qué somos distintos y en qué ellos son mejores, para que uses cada uno para lo
            que sirve.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-borde bg-white">
          <table className="w-full text-sm">
            <thead className="bg-fondo text-left text-gris">
              <tr>
                <th className="p-3 font-medium"></th>
                <th className="p-3 font-semibold text-radar-oscuro">ChambaRadar</th>
                <th className="p-3 font-medium">OCC / Computrabajo / Indeed</th>
                <th className="p-3 font-medium">LinkedIn</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(([k, a, b, c]) => (
                <tr key={k} className="border-t border-slate-100 align-top">
                  <td className="p-3 font-medium">{k}</td>
                  <td className="p-3 font-medium">{c}</td>
                  <td className="p-3 text-slate-600">{a}</td>
                  <td className="p-3 text-slate-600">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-borde bg-white p-5">
            <h2 className="font-bold">Usa OCC, Computrabajo o Indeed si…</h2>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
              <li>{SI} Buscas en una PyME, tienda o negocio de tu colonia.</li>
              <li>{SI} Quieres mandar muchas solicitudes rápido desde un solo lugar.</li>
              <li>{SI} Buscas puestos operativos con contratación inmediata.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-borde bg-white p-5">
            <h2 className="font-bold">Usa LinkedIn si…</h2>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
              <li>{SI} Quieres que los reclutadores te encuentren a ti.</li>
              <li>{SI} Tu red de contactos pesa en tu industria.</li>
              <li>{SI} Buscas puestos de dirección o muy especializados.</li>
            </ul>
          </div>
          <div className="rounded-2xl border-2 border-radar bg-white p-5 sm:col-span-2">
            <h2 className="font-bold">Usa ChambaRadar si…</h2>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
              <li>{SI} Buscas en empresas medianas y grandes: bancos, manufactura, farmacéuticas, tecnología, aseguradoras.</li>
              <li>{SI} Quieres aplicar donde hay menos competencia, directo con la empresa.</li>
              <li>{SI} Buscas home office y estás cansado de que “remoto” resulte ser solo para Estados Unidos.</li>
              <li>{SI} Prefieres pagar una vez y sin suscripción, en lugar de un Premium que se renueva solo.</li>
              <li>{NO} No te servimos si buscas en negocios pequeños de tu colonia: ahí los portales tienen más.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-borde bg-white p-5 sm:col-span-2">
            <h2 className="font-bold">Y no olvides el Portal del Empleo del gobierno (gratis y oficial)</h2>
            <p className="mt-2 text-sm text-slate-700">
              El Servicio Nacional de Empleo tiene su propia bolsa de trabajo en{" "}
              <a href="https://www.empleo.gob.mx/" target="_blank" rel="noopener noreferrer" className="font-semibold text-radar-oscuro hover:underline">
                empleo.gob.mx
              </a>
              , con decenas de miles de vacantes operativas en todo México (producción, ventas en piso, choferes, oficios) y ferias de empleo por estado. Es gratis, nadie te
              cobra por aplicar y es del gobierno federal. Para ese tipo de puesto cerca de ti, empieza ahí; ChambaRadar sirve para empresas medianas y grandes y para home
              office.
            </p>
          </div>
        </section>

        <section className="space-y-3 text-sm text-slate-700">
          <h2 className="text-lg font-bold">¿De verdad hay vacantes que no están en los portales?</h2>
          <p>
            Sí. Publicar en un portal cuesta dinero y atrae cientos de solicitudes, así que muchas empresas publican primero, o solo, en su propia página de empleo
            (sistemas como Greenhouse, Lever, Workday o SuccessFactors). ChambaRadar revisa esas páginas todos los días
            {r ? ` y hoy junta ${numero(r.total)} vacantes de ${numero(r.empresas)} empresas` : ""}. Una parte sí aparece también en portales; otra parte nunca llega.
          </p>
          <p>
            Lo que cobramos ($49 por semana o $129 por mes, pago único) es por ver qué empresa es y el enlace para aplicar. El puesto, el sueldo y la ubicación son
            gratis para todos, y las vacantes que los negocios publican aquí se ven completas sin pagar.
          </p>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link href="/vacantes" className="boton">
            Ver vacantes que no están en OCC <Flecha className="size-4" />
          </Link>
          <Link href="/vacantes?donde=remoto" className="boton-secundario">
            Home office que acepta México
          </Link>
        </div>
      </main>
      <Pie />
    </>
  );
}
