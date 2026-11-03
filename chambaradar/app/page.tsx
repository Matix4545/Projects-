import Link from "next/link";
import { Candado, Dinero, Flecha, Lupa, Palomita, Reloj, Tache, Ubicacion } from "@/components/Iconos";
import { Encabezado, Pie } from "@/components/Marco";
import { formatoSueldo, haceCuanto, numero } from "@/lib/formato";
import type { VacanteVista } from "@/lib/muro";
import { accesoLocal, usuarioActual } from "@/lib/supabase/servidor";
import { visitanteLocal } from "@/lib/ubicacion";
import { buscarVacantes, leerFiltros, resumen } from "@/lib/vacantes";

const PREGUNTAS = [
  {
    p: "¿De dónde salen las vacantes?",
    r: "De las páginas de empleo oficiales de cada empresa (las que usan sistemas como Greenhouse, Lever, Ashby o BambooHR). No copiamos portales de empleo: cada vacante te lleva a la página original de la empresa para que apliques directo.",
  },
  {
    p: "¿Por qué no aparecen en LinkedIn u OCC?",
    r: "Publicar en portales cuesta dinero y atrae cientos de solicitudes. Muchas empresas solo publican en su propio sitio, donde casi nadie busca. Ahí hay menos competencia.",
  },
  {
    p: "¿Qué vacantes muestran?",
    r: "Dos tipos: las de empresas con oficina, planta o sucursal en México y LATAM, y los trabajos 100 % remotos (home office) que aceptan gente de la región, de empresas mexicanas y extranjeras (muchas pagan en dólares). Si un trabajo remoto es solo para Estados Unidos u otro país, no lo mostramos.",
  },
  {
    p: "¿Por qué no veo la vacante que vi en Facebook?",
    r: "Juntamos las vacantes que las empresas publican en sus propias páginas de empleo, más las que los negocios publican aquí gratis. Si tienes un negocio, publica tu vacante en “Publica tu vacante”.",
  },
  {
    p: "¿Qué veo gratis?",
    r: "Todos los puestos, sueldos (cuando la empresa los publica), ubicación, modalidad y fecha. Con un plan de pago ves el nombre de la empresa, la descripción completa y el enlace para aplicar. Las vacantes que publican los negocios aquí siempre se ven completas.",
  },
  {
    p: "¿Cómo pago? ¿Se renueva solo?",
    r: "Pagas una sola vez con tarjeta o en efectivo en OXXO. No es suscripción: cuando se acaba tu plan, simplemente vuelves a la vista previa. Nada de cargos sorpresa.",
  },
  {
    p: "¿Ustedes me contratan o cobran comisión?",
    r: "No. No somos agencia de reclutamiento. Te ayudamos a encontrar las vacantes y tú aplicas directamente con la empresa.",
  },
];

/** Tarjeta de muestra para la vista del producto en la portada (sin botones activos). */
function Muestra({ v, i }: { v: VacanteVista; i: number }) {
  const sueldo = formatoSueldo(v.sueldo_min, v.sueldo_max, v.moneda, v.periodo);
  return (
    <div className={`rounded-2xl border border-borde bg-white p-4 text-left shadow-sm sm:p-5 ${i > 0 ? "hidden sm:block" : ""}`}>
      <p className="font-semibold leading-snug text-tinta sm:text-lg">{v.titulo}</p>
      <p className={`text-sm ${v.bloqueada ? "borroso select-none text-slate-600" : "font-medium text-slate-700"}`}>{v.empresa_nombre}</p>
      <div className="mt-2 space-y-0.5 text-sm">
        {sueldo && (
          <p className="flex items-center gap-1.5 font-medium text-amber-600">
            <Dinero className="size-4" /> {sueldo}
          </p>
        )}
        <p className="flex items-center gap-1.5 text-slate-600">
          <Ubicacion className="size-4" /> <span className="truncate">{v.ubicacion}</span>
        </p>
        <p className="flex items-center gap-1.5 text-slate-500" suppressHydrationWarning>
          <Reloj className="size-4" /> {haceCuanto(v.publicada)}
        </p>
      </div>
      <div className="mt-3 flex gap-2">
        <span className="boton-oscuro px-3 py-1.5 text-xs">
          {v.bloqueada && <Candado className="size-3" />} Aplicar
        </span>
        <span className="boton-contorno px-3 py-1.5 text-xs">Más</span>
      </div>
    </div>
  );
}

export default async function Inicio() {
  const usuario = await usuarioActual();
  const [acceso, local] = await Promise.all([accesoLocal(usuario), visitanteLocal()]);
  // Muestra: home office con sueldo (quien está en Sonora ve primero lo de Cd. Obregón)
  const [r, cerca] = await Promise.all([resumen(), local ? buscarVacantes(leerFiltros({ zona: "cajeme" }, true), acceso) : null]);
  const conCerca = (cerca?.vacantes.length ?? 0) >= 3;
  const tarjetas = (conCerca ? cerca! : await buscarVacantes(leerFiltros({ sueldo: "1", modalidad: "remoto" }), acceso)).vacantes.slice(0, 3);
  const busquedaMuestra = conCerca ? "Cerca de ti" : "Home office con sueldo publicado";

  return (
    <>
      <Encabezado usuario={usuario} oscuro />

      {/* Portada */}
      <section className="relative overflow-hidden bg-noche pb-40 pt-14 text-white sm:pb-48 sm:pt-20">
        {/* Brillo de radar de fondo */}
        <div className="pointer-events-none absolute -top-40 left-1/2 size-[46rem] -translate-x-1/2 rounded-full bg-radar/20 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute top-24 left-1/2 size-[30rem] -translate-x-1/2 rounded-full border border-white/5" aria-hidden />
        <div className="pointer-events-none absolute top-8 left-1/2 size-[44rem] -translate-x-1/2 rounded-full border border-white/5" aria-hidden />

        <div className="contenedor relative text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-radar sm:text-sm">
            <span className="size-2 animate-pulse rounded-full bg-radar" /> México y LATAM · actualizado hoy
          </p>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl">
            Encuentra chamba que <span className="text-radar">no está</span> en LinkedIn ni en OCC
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-slate-300">
            Buscamos todos los días en las páginas de empleo de empresas en México, LATAM y del mundo que contratan remoto. Aplicas directo, con menos competencia.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <Link href="/empezar" className="boton px-8 py-4 text-lg shadow-lg shadow-radar/30">
              Ver vacantes <Flecha className="size-5" />
            </Link>
            <span className="text-sm text-slate-400">
              Gratis · sin registrarte
              {local && <span className="text-radar"> · Acceso completo gratis por estar en Sonora</span>}
            </span>
          </div>
          <dl className="mx-auto mt-10 flex max-w-xl flex-wrap justify-center gap-x-8 gap-y-3 text-sm">
            {[
              [numero(r.total), "vacantes"],
              [numero(r.empresas), "empresas"],
              [numero(r.remotas), "home office"],
            ].map(([n, t]) => (
              <div key={t} className="flex items-baseline gap-1.5">
                <dt className="sr-only">{t}</dt>
                <dd className="text-2xl font-extrabold text-white">{n}</dd>
                <dd className="text-slate-400">{t}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Vista del producto con vacantes reales */}
      {tarjetas.length > 0 && (
        <section className="contenedor relative -mt-28 sm:-mt-36">
          <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-slate-200/60 p-2 shadow-2xl backdrop-blur sm:p-3">
            <div className="rounded-2xl bg-fondo p-3 sm:p-5">
              <div className="flex items-center gap-3 rounded-full border border-borde bg-white px-4 py-2.5 text-sm text-slate-400">
                <Lupa className="size-4" /> {busquedaMuestra}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {tarjetas.map((v, i) => (
                  <Muestra key={v.id} v={v} i={i} />
                ))}
              </div>
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-gris">Vacantes reales de hoy, de {numero(r.empresas)} empresas.</p>
        </section>
      )}

      {/* Comparativa */}
      <section className="contenedor mt-24">
        <h2 className="text-center text-3xl font-extrabold tracking-tight sm:text-4xl">¿Cansado de que no te contesten?</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-gris">
          En los portales grandes cada vacante recibe cientos de solicitudes en horas. En la página de la empresa, casi nadie busca.
        </p>
        <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-borde bg-white p-7">
            <p className="font-bold text-slate-500">LinkedIn, OCC, Indeed</p>
            <ul className="mt-5 space-y-3.5 text-slate-600">
              {[
                "“Hace 2 horas · más de 200 solicitudes”",
                "Te rechazan solos y casi nunca contestan",
                "Vacantes viejas, repetidas o falsas",
                "“Home office” que al final es solo para Estados Unidos",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                    <Tache className="size-3" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border-2 border-radar bg-white p-7 shadow-lg shadow-radar/10">
            <p className="font-bold text-radar-oscuro">ChambaRadar</p>
            <ul className="mt-5 space-y-3.5">
              {[
                "Menos competencia: casi nadie busca ahí",
                "Aplicas directo con el equipo que contrata",
                "Revisadas todos los días: las cerradas desaparecen",
                "Solo home office que acepta gente en México",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-radar-claro text-radar-oscuro">
                    <Palomita className="size-3" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Banda de vista previa gratis */}
      <section className="mt-24 bg-radar py-16 text-center text-white">
        <div className="contenedor">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{local ? "Para ti es gratis" : "Vista previa gratis"}</h2>
          <p className="mx-auto mt-3 max-w-xl text-lg text-emerald-50">
            {local
              ? "Como estás en Sonora, ves todas las vacantes completas, con empresa y enlace para aplicar, sin pagar nada."
              : "Mira todas las vacantes, sueldos y ubicaciones sin registrarte. Elige tu área y en un segundo ves lo que hay."}
          </p>
          <Link href="/empezar" className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-lg font-semibold text-radar-oscuro shadow-lg transition hover:bg-emerald-50">
            Ver vacantes <Flecha className="size-5" />
          </Link>
        </div>
      </section>

      {/* Dos caminos */}
      <section className="contenedor mt-24 grid gap-4 md:grid-cols-2">
        <Link href="/vacantes?donde=mx" className="group rounded-3xl border border-borde bg-white p-7 transition hover:border-radar hover:shadow-lg">
          <p className="text-4xl">🌎</p>
          <h2 className="mt-4 text-xl font-bold">Empresas de México y LATAM</h2>
          <p className="mt-2 text-gris">
            Plantas, bancos, tecnología, comercio y oficinas en CDMX, Monterrey, Guadalajara, Querétaro, Sonora, Bogotá y más.
          </p>
          <p className="mt-5 inline-flex items-center gap-1.5 font-semibold text-radar-oscuro">
            Ver vacantes en México <Flecha className="size-4 transition group-hover:translate-x-1" />
          </p>
        </Link>
        <Link href="/vacantes?donde=remoto" className="group rounded-3xl border border-borde bg-white p-7 transition hover:border-radar hover:shadow-lg">
          <p className="text-4xl">🏠</p>
          <h2 className="mt-4 text-xl font-bold">Home office, en pesos o dólares</h2>
          <p className="mt-2 text-gris">
            Trabajos 100 % remotos que aceptan gente en México, de empresas mexicanas y extranjeras (muchas pagan en dólares). Los que dicen “solo US” no aparecen.
          </p>
          <p className="mt-5 inline-flex items-center gap-1.5 font-semibold text-radar-oscuro">
            Ver home office <Flecha className="size-4 transition group-hover:translate-x-1" />
          </p>
        </Link>
      </section>

      {/* Cómo funciona */}
      <section className="contenedor mt-24">
        <h2 className="text-center text-3xl font-extrabold tracking-tight sm:text-4xl">Así de fácil</h2>
        <ol className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-3">
          {[
            ["1", "Elige tu área", "Ventas, producción, salud, oficina, tecnología… y si buscas en tu ciudad o home office."],
            ["2", "Mira lo que hay", "Puestos, sueldos y ubicaciones gratis. Crea una alerta y te llegan las nuevas al correo."],
            ["3", "Aplica directo", "Desbloquea la empresa y te mandamos a su página oficial. Sin intermediarios."],
          ].map(([n, titulo, texto]) => (
            <li key={n} className="rounded-3xl border border-borde bg-white p-7">
              <span className="flex size-11 items-center justify-center rounded-full bg-noche text-lg font-bold text-radar">{n}</span>
              <h3 className="mt-5 text-lg font-bold">{titulo}</h3>
              <p className="mt-1.5 text-gris">{texto}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Preguntas */}
      <section className="contenedor mt-24 max-w-3xl">
        <h2 className="text-center text-3xl font-extrabold tracking-tight sm:text-4xl">Preguntas frecuentes</h2>
        <div className="mt-10 space-y-3">
          {PREGUNTAS.map(({ p, r: resp }) => (
            <details key={p} className="group rounded-2xl border border-borde bg-white px-5 py-4 open:shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                {p}
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-gris transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-gris">{resp}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Llamado final */}
      <section className="contenedor mt-24">
        <div className="relative overflow-hidden rounded-3xl bg-noche px-6 py-14 text-center text-white">
          <div className="pointer-events-none absolute -bottom-40 left-1/2 size-[32rem] -translate-x-1/2 rounded-full bg-radar/25 blur-3xl" aria-hidden />
          <h2 className="relative text-3xl font-extrabold tracking-tight sm:text-4xl">Tu siguiente chamba ya está publicada</h2>
          <p className="relative mx-auto mt-3 max-w-xl text-slate-300">Solo que no en donde todos buscan.</p>
          <Link href="/empezar" className="boton relative mt-7 px-8 py-4 text-lg">
            Empezar a buscar <Flecha className="size-5" />
          </Link>
        </div>
      </section>

      <Pie />
    </>
  );
}
