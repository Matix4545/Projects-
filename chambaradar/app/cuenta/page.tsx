import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Encabezado, Pie } from "@/components/Marco";
import { usuarioActual } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Mi cuenta", robots: { index: false } };

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function Cuenta({ searchParams }: Props) {
  const { pago } = await searchParams;
  const usuario = await usuarioActual();
  if (!usuario) redirect("/entrar?siguiente=/cuenta");

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

        <form action="/salir" method="post">
          <button className="text-sm text-gris underline hover:text-tinta">Cerrar sesión</button>
        </form>
      </main>
      <Pie />
    </>
  );
}
