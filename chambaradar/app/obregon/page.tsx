import type { Metadata } from "next";
import Link from "next/link";
import { Flecha } from "@/components/Iconos";
import { Encabezado, Pie } from "@/components/Marco";
import { TarjetaVacante, type ContextoTarjeta } from "@/components/TarjetaVacante";
import { numero } from "@/lib/formato";
import { pagosActivos } from "@/lib/planes";
import { accesoLocal, usuarioActual } from "@/lib/supabase/servidor";
import { buscarVacantes, leerFiltros, resumen } from "@/lib/vacantes";

export const metadata: Metadata = {
  title: "Empleos en Ciudad Obregón, Sonora",
  description:
    "Vacantes en Ciudad Obregón (Cajeme) y el resto de Sonora sacadas directo de las páginas de empleo de las empresas, y trabajo remoto que puedes hacer desde Obregón.",
};

function Seccion({ titulo, texto, enlace, total, children }: { titulo: string; texto: string; enlace: string; total: number; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{titulo}</h2>
          <p className="text-sm text-gris">{texto}</p>
        </div>
        {total > 0 && (
          <Link href={enlace} className="inline-flex items-center gap-1.5 text-sm font-semibold text-radar-oscuro hover:underline">
            Ver las {numero(total)} <Flecha className="size-4" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export default async function Obregon() {
  const usuario = await usuarioActual();
  const acceso = await accesoLocal(usuario);
  const [enCajeme, enSonora, remoto, r] = await Promise.all([
    buscarVacantes(leerFiltros({ zona: "cajeme" }), acceso),
    buscarVacantes(leerFiltros({ zona: "sonora" }), acceso),
    buscarVacantes(leerFiltros({ modalidad: "remoto", pais: "MX", sueldo: "1" }), acceso),
    resumen(),
  ]);
  const ctx: ContextoTarjeta = {
    conSesion: Boolean(usuario),
    pagosActivos: pagosActivos(),
    resumen: `${numero(r.total)} vacantes de ${numero(r.empresas)} empresas`,
  };
  // En "resto de Sonora" no repetimos las de Cajeme
  const idsCajeme = new Set(enCajeme.vacantes.map((v) => v.id));
  const restoSonora = enSonora.vacantes.filter((v) => !v.zonas?.includes("cajeme") && !idsCajeme.has(v.id)).slice(0, 6);

  return (
    <>
      <Encabezado usuario={usuario} />
      <section className="relative overflow-hidden border-b border-borde bg-white pb-14 pt-10 sm:pt-14">
        <div className="pointer-events-none absolute -top-32 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-radar/10 blur-3xl" aria-hidden />
        <div className="contenedor relative">
          <p className="text-sm font-semibold text-radar-oscuro">Cajeme, Sonora</p>
          <h1 className="mt-2 max-w-2xl text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">Empleos en Ciudad Obregón</h1>
          <p className="mt-4 max-w-xl text-lg text-slate-600">
            Vacantes de empresas con planta o sucursal en Obregón y el sur de Sonora, más trabajo remoto que puedes hacer desde tu casa en Cajeme.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/vacantes?zona=cajeme" className="boton">
              Vacantes en Obregón <Flecha className="size-4" />
            </Link>
            <Link href="/vacantes?modalidad=remoto&pais=MX" className="boton-secundario">
              Remoto desde Obregón
            </Link>
          </div>
        </div>
      </section>

      <main className="contenedor max-w-4xl space-y-14 py-10">
        <Seccion titulo="En Cd. Obregón" texto="Empresas con planta, sucursal o vacantes en Cajeme." enlace="/vacantes?zona=cajeme" total={enCajeme.total}>
          {enCajeme.vacantes.length ? (
            <div className="space-y-4">
              {enCajeme.vacantes.slice(0, 8).map((v) => (
                <TarjetaVacante key={v.id} v={v} ctx={ctx} />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-borde bg-white p-6 text-center text-gris">
              Hoy no hay vacantes publicadas en Obregón por las empresas que revisamos. Crea una alerta y te avisamos en cuanto salga una.
            </p>
          )}
        </Seccion>

        <Seccion titulo="En el resto de Sonora" texto="Hermosillo, Navojoa, Guaymas, Nogales y más." enlace="/vacantes?zona=sonora" total={enSonora.total}>
          <div className="space-y-4">
            {restoSonora.map((v) => (
              <TarjetaVacante key={v.id} v={v} ctx={ctx} />
            ))}
          </div>
        </Seccion>

        <Seccion
          titulo="Remoto, desde Obregón"
          texto="Trabajos 100 % remotos abiertos a México, con sueldo publicado."
          enlace="/vacantes?modalidad=remoto&pais=MX&sueldo=1"
          total={remoto.total}
        >
          <div className="space-y-4">
            {remoto.vacantes.slice(0, 6).map((v) => (
              <TarjetaVacante key={v.id} v={v} ctx={ctx} />
            ))}
          </div>
        </Seccion>

        <section className="rounded-3xl border-2 border-dashed border-radar/40 bg-white p-6 sm:p-8">
          <h2 className="text-xl font-bold">¿Tienes un negocio en Obregón y buscas personal?</h2>
          <p className="mt-2 text-gris">
            Publica tus vacantes gratis en ChambaRadar y recibe solicitudes directo por WhatsApp o correo.
          </p>
          <Link href="/publicar" className="boton mt-5">
            Publicar una vacante gratis
          </Link>
        </section>
      </main>
      <Pie />
    </>
  );
}
