import type { Metadata } from "next";
import { Encabezado, Pie } from "@/components/Marco";
import { PLANES, pagosActivos } from "@/lib/planes";
import { usuarioActual } from "@/lib/supabase/servidor";
import { VerificarUbicacion } from "@/components/VerificarUbicacion";
import { visitanteLocal } from "@/lib/ubicacion";

export const metadata: Metadata = { title: "Precios", description: "Desbloquea empresas y enlaces de todas las vacantes. Pago único con tarjeta u OXXO." };

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function Precios({ searchParams }: Props) {
  const { error, plan: elegido } = await searchParams;
  const usuario = await usuarioActual();
  const activos = pagosActivos();
  const local = await visitanteLocal();

  return (
    <>
      <Encabezado usuario={usuario} />
      <main className="contenedor py-10 sm:py-14">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Desbloquea todas las vacantes</h1>
          <p className="mt-3 text-gris">
            Ve qué empresa es, la descripción completa y el enlace para aplicar directo. Pago único con tarjeta o en efectivo en OXXO: no se
            renueva solo.
          </p>
          <p className="mt-3 rounded-xl bg-radar-claro p-3 text-sm text-radar-oscuro">
            ¿Estás en Sonora? Tienes <strong>acceso completo gratis</strong>, sin plan. Las vacantes que publican los negocios también son siempre gratis.
          </p>
          {!local && (
            <div className="mt-3 text-left">
              <VerificarUbicacion />
            </div>
          )}
        </div>

        {!activos && (
          <p className="mx-auto mt-6 max-w-xl rounded-xl bg-radar-claro p-4 text-center text-sm text-radar-oscuro">
            <strong>Muy pronto.</strong> Estamos por activar los pagos. Mientras tanto, todo el catálogo es gratis para todos.
          </p>
        )}

        {activos && error === "pagos" && (
          <p className="mx-auto mt-6 max-w-xl rounded-xl bg-amber-50 p-4 text-center text-sm text-amber-900">
            Los pagos todavía no están activados en este sitio. Inténtalo más tarde.
          </p>
        )}

        <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-3">
          {PLANES.map((p) => (
            <form
              key={p.id}
              action="/api/pago"
              method="post"
              className={`flex flex-col rounded-2xl bg-white p-6 shadow-sm ${
                p.destacado || elegido === p.id ? "border-2 border-radar" : "border border-borde"
              }`}
            >
              <input type="hidden" name="plan" value={p.id} />
              <p className="text-sm font-semibold text-radar-oscuro">{p.nota}</p>
              <h2 className="mt-1 text-xl font-bold">{p.nombre}</h2>
              <p className="mt-4">
                <span className="text-4xl font-extrabold">${p.precio}</span> <span className="text-gris">MXN</span>
              </p>
              <p className="text-sm text-gris">${(p.precio / p.dias).toFixed(2)} por día</p>
              <ul className="mt-5 flex-1 space-y-2 text-sm">
                <li>✓ Nombre de la empresa</li>
                <li>✓ Enlace directo para aplicar</li>
                <li>✓ Descripción completa</li>
                <li>✓ Buscar por empresa</li>
              </ul>
              <button className={`mt-6 w-full ${p.destacado ? "boton" : "boton-secundario"} disabled:opacity-50`} disabled={!activos}>
                {!activos ? "Próximamente" : usuario ? "Pagar" : "Crear cuenta y pagar"}
              </button>
            </form>
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-xl text-center text-sm text-gris">
          Pagos procesados por Stripe. Con OXXO recibes una ficha y tu acceso se activa en cuanto pagas en tienda (puede tardar unas horas).
        </p>
      </main>
      <Pie />
    </>
  );
}
