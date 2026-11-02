import Link from "next/link";
import { Encabezado, Pie } from "@/components/Marco";
import { numero } from "@/lib/formato";
import { usuarioActual } from "@/lib/supabase/servidor";
import { resumen } from "@/lib/vacantes";

const PREGUNTAS = [
  {
    p: "¿De dónde salen las vacantes?",
    r: "De las páginas de empleo oficiales de cada empresa (las que usan sistemas como Greenhouse, Lever o Ashby). No copiamos portales de empleo: cada vacante te lleva a la página original de la empresa para que apliques directo.",
  },
  {
    p: "¿Por qué no aparecen en LinkedIn u OCC?",
    r: "Publicar en portales cuesta dinero y atrae cientos de solicitudes. Muchas empresas solo publican en su propio sitio, donde casi nadie busca. Ahí hay menos competencia.",
  },
  {
    p: "¿Qué es “remoto en dólares”?",
    r: "Vacantes de empresas de Estados Unidos y otros países que contratan desde México y LATAM, normalmente como contratista o a través de una empresa empleadora. Solo mostramos las que aceptan a personas de la región.",
  },
  {
    p: "¿Qué veo gratis?",
    r: "Todos los puestos, sueldos (cuando la empresa los publica), ubicación, modalidad y fecha. Con un plan de pago ves el nombre de la empresa, la descripción completa y el enlace para aplicar.",
  },
  {
    p: "¿Cómo pago? ¿Se renueva solo?",
    r: "Pagas una sola vez con tarjeta o en efectivo en OXXO. No es suscripción: cuando se acaba tu plan, simplemente vuelves a la vista previa. Nada de cargos sorpresa.",
  },
  {
    p: "¿Ustedes me contratan o cobran comisión a las empresas?",
    r: "No. No somos agencia de reclutamiento. Te ayudamos a encontrar las vacantes y tú aplicas directamente con la empresa.",
  },
];

export default async function Inicio() {
  const [usuario, r] = await Promise.all([usuarioActual(), resumen()]);

  return (
    <>
      <Encabezado usuario={usuario} oscuro />

      {/* Portada */}
      <section className="bg-noche pb-16 pt-10 text-white sm:pb-24 sm:pt-16">
        <div className="contenedor grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-6">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-radar sm:text-sm">
              <span className="size-2 animate-pulse rounded-full bg-radar" /> Actualizado todos los días
            </p>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              Las chambas que <span className="text-radar">no ves</span> en LinkedIn ni en OCC
            </h1>
            <p className="max-w-xl text-lg text-slate-300">
              Revisamos a diario las páginas de empleo de empresas en México y LATAM, y de empresas extranjeras que contratan remoto en
              dólares. Tú aplicas directo, con menos competencia.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/vacantes" className="boton text-base">
                Ver vacantes gratis
              </Link>
              <Link href="/vacantes?tipo=remoto&modalidad=remoto" className="boton-secundario border-white/20 bg-white/5 text-base text-white hover:border-white/40">
                Remoto en dólares 💵
              </Link>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3">
            {[
              [numero(r.total), "vacantes activas"],
              [numero(r.empresas), "empresas contratando"],
              [numero(r.enMexico), "en México"],
              [numero(r.remotas), "100 % remotas"],
            ].map(([n, texto]) => (
              <div key={texto} className="rounded-2xl border border-white/10 bg-noche-2 p-5">
                <dt className="sr-only">{texto}</dt>
                <dd className="text-3xl font-extrabold text-white">{n}</dd>
                <dd className="text-sm text-slate-400">{texto}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Dos caminos */}
      <section className="contenedor -mt-8 grid gap-4 sm:-mt-12 md:grid-cols-2">
        <Link href="/vacantes?tipo=local" className="group rounded-2xl border border-borde bg-white p-6 shadow-sm transition hover:border-radar">
          <p className="text-3xl">🌎</p>
          <h2 className="mt-3 text-xl font-bold">Empresas de México y LATAM</h2>
          <p className="mt-2 text-gris">
            Fintechs, startups y tecnológicas de la región: presencial, híbrido o remoto en CDMX, Guadalajara, Monterrey, Bogotá, São Paulo y más.
          </p>
          <p className="mt-4 font-semibold text-radar-oscuro group-hover:underline">Ver vacantes en LATAM →</p>
        </Link>
        <Link href="/vacantes?tipo=remoto" className="group rounded-2xl border border-borde bg-white p-6 shadow-sm transition hover:border-radar">
          <p className="text-3xl">💵</p>
          <h2 className="mt-3 text-xl font-bold">Remoto para empresas extranjeras</h2>
          <p className="mt-2 text-gris">
            Empresas de EE.UU. y otros países con puestos abiertos a LATAM. Filtramos las que dicen “solo US” para que no pierdas tiempo.
          </p>
          <p className="mt-4 font-semibold text-radar-oscuro group-hover:underline">Ver remoto en dólares →</p>
        </Link>
      </section>

      {/* Comparativa */}
      <section className="contenedor mt-20">
        <h2 className="text-center text-3xl font-extrabold tracking-tight">¿Cansado de que no te contesten?</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-gris">
          En los portales grandes cada vacante recibe cientos de solicitudes en horas. En la página de la empresa, casi nadie busca.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-borde bg-white p-6">
            <p className="font-bold text-slate-500">Portales de empleo</p>
            <ul className="mt-4 space-y-3 text-slate-600">
              {[
                "“Publicada hace 2 horas · más de 200 solicitudes”",
                "Vacantes repetidas, viejas o que ya se llenaron",
                "Intermediarios y agencias que cobran a la empresa",
                "Remotos que al final son “solo Estados Unidos”",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span className="text-red-500">✕</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border-2 border-radar bg-white p-6 shadow-sm">
            <p className="font-bold text-radar-oscuro">ChambaRadar</p>
            <ul className="mt-4 space-y-3">
              {[
                "Vacantes sacadas directo del sitio de cada empresa",
                "Se revisan todos los días: las cerradas desaparecen",
                "Aplicas directo con el equipo que contrata",
                "Solo remotos que aceptan gente de LATAM",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span className="text-radar">✓</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="contenedor mt-20">
        <h2 className="text-center text-3xl font-extrabold tracking-tight">Cómo funciona</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            ["1", "Busca gratis", "Filtra por país, área, nivel, modalidad y sueldo. Ves todos los puestos sin registrarte."],
            ["2", "Desbloquea", "Desde $49 MXN ves qué empresa es y el enlace para aplicar. Paga con tarjeta u OXXO."],
            ["3", "Aplica directo", "Te mandamos a la página oficial de la empresa. Sin intermediarios."],
          ].map(([n, titulo, texto]) => (
            <li key={n} className="rounded-2xl border border-borde bg-white p-6">
              <span className="flex size-10 items-center justify-center rounded-full bg-radar-claro font-bold text-radar-oscuro">{n}</span>
              <h3 className="mt-4 text-lg font-bold">{titulo}</h3>
              <p className="mt-1 text-gris">{texto}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Preguntas */}
      <section className="contenedor mt-20 max-w-3xl">
        <h2 className="text-center text-3xl font-extrabold tracking-tight">Preguntas frecuentes</h2>
        <div className="mt-8 divide-y divide-borde rounded-2xl border border-borde bg-white">
          {PREGUNTAS.map(({ p, r }) => (
            <details key={p} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                {p}
                <span className="text-gris transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-gris">{r}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Llamado final */}
      <section className="contenedor mt-20">
        <div className="rounded-3xl bg-noche px-6 py-12 text-center text-white">
          <h2 className="text-3xl font-extrabold tracking-tight">Tu siguiente chamba ya está publicada</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-300">Solo que no en donde todos buscan.</p>
          <Link href="/vacantes" className="boton mt-6 text-base">
            Empezar a buscar
          </Link>
        </div>
      </section>

      <Pie />
    </>
  );
}
