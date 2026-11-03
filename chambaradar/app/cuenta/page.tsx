import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Encabezado, Pie } from "@/components/Marco";
import { borrarAlerta } from "@/app/alertas/acciones";
import { enviarEnlace } from "@/app/entrar/acciones";
import { describirFiltros, enlaceBusqueda, type FiltrosAlerta } from "@/lib/alertas";
import { supabaseSesion, usuarioActual } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Mi cuenta", robots: { index: false } };

type Props = { searchParams: Promise<Record<string, string | undefined>> };

/** Después de pagar sin haber entrado: el acceso quedó en el correo que puso en Stripe. */
function PagoRecibido() {
  return (
    <>
      <Encabezado usuario={null} />
      <main className="contenedor max-w-xl space-y-5 py-10">
        <div className="rounded-3xl border border-borde bg-white p-6 sm:p-8">
          <p className="text-4xl">🎉</p>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight">¡Pago recibido!</h1>
          <p className="mt-2 text-gris">
            Tu acceso quedó en el <strong className="text-tinta">correo que pusiste al pagar</strong>. Escríbelo aquí y te mandamos un enlace para entrar, sin
            contraseña. También te enviamos un correo con el enlace.
          </p>
          <form action={enviarEnlace} className="mt-5 space-y-3">
            <input type="hidden" name="siguiente" value="/vacantes" />
            <input type="email" name="email" required autoComplete="email" placeholder="el-correo-con-el-que-pagaste@gmail.com" className="campo py-3 text-base" aria-label="Correo electrónico" />
            <button className="boton w-full">Entrar y ver las vacantes</button>
          </form>
          <p className="mt-4 text-sm text-gris">
            ¿Pagaste con OXXO? Tu acceso se activa cuando pagues la ficha en tienda; puede tardar unas horas.
          </p>
        </div>
      </main>
      <Pie />
    </>
  );
}

export default async function Cuenta({ searchParams }: Props) {
  const { pago } = await searchParams;
  const usuario = await usuarioActual();
  if (!usuario && pago === "ok") return <PagoRecibido />;
  if (!usuario) redirect("/entrar?siguiente=/cuenta");

  // La política de la tabla solo devuelve las alertas propias
  const { data: alertas } = await (await supabaseSesion())
    .from("alertas")
    .select("id, filtros, activa, creada")
    .order("creada", { ascending: false });

  const fecha = usuario.accesoHasta?.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Mexico_City" });

  return (
    <>
      <Encabezado usuario={usuario} />
      <main className="contenedor max-w-xl space-y-4 py-10">
        <h1 className="text-2xl font-extrabold">Mi cuenta</h1>

        {pago === "ok" && !usuario.conAcceso && (
          <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            Recibimos tu orden. Si pagaste con tarjeta, tu acceso se activa en unos segundos (recarga la página). Si elegiste OXXO, se activa
            cuando pagues la ficha en tienda.
          </p>
        )}

        <div className="space-y-4 rounded-2xl border border-borde bg-white p-6">
          <div>
            <p className="text-sm text-gris">Correo</p>
            <p className="font-medium">{usuario.email}</p>
          </div>
          <div>
            <p className="text-sm text-gris">Acceso</p>
            {usuario.conAcceso ? (
              <p className="font-semibold text-radar-oscuro">Activo hasta el {fecha}</p>
            ) : (
              <p className="font-medium">{fecha ? `Vencido (terminó el ${fecha})` : "Vista previa gratuita"}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/vacantes" className="boton">
              Ver vacantes
            </Link>
            <Link href="/precios" className="boton-secundario">
              {usuario.conAcceso ? "Extender acceso" : "Desbloquear"}
            </Link>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-borde bg-white p-6">
          <div>
            <h2 className="text-lg font-bold">Alertas por correo</h2>
            <p className="text-sm text-gris">Te mandamos las vacantes nuevas de cada alerta, máximo un correo al día.</p>
          </div>
          {!alertas?.length ? (
            <p className="text-sm text-gris">
              Aún no tienes alertas. En{" "}
              <Link href="/vacantes" className="font-semibold text-radar-oscuro hover:underline">
                Vacantes
              </Link>{" "}
              elige tus filtros y toca “Crear alerta”.
            </p>
          ) : (
            <ul className="divide-y divide-borde">
              {alertas.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link href={enlaceBusqueda("", a.filtros as FiltrosAlerta)} className="font-medium hover:underline">
                      {describirFiltros(a.filtros as FiltrosAlerta)}
                    </Link>
                    {!a.activa && <p className="text-xs text-gris">Pausada (te diste de baja desde el correo)</p>}
                  </div>
                  <form action={borrarAlerta}>
                    <input type="hidden" name="id" value={a.id} />
                    <button className="text-sm text-red-700 hover:underline">Borrar</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form action="/salir" method="post">
          <button className="text-sm text-gris underline hover:text-tinta">Cerrar sesión</button>
        </form>
      </main>
      <Pie />
    </>
  );
}
