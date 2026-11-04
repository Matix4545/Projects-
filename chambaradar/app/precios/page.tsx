import type { Metadata } from "next";
import { Encabezado, Pie } from "@/components/Marco";
import { PLANES, pagosActivos } from "@/lib/planes";
import { usuarioActual } from "@/lib/supabase/servidor";
import { aproximadoLocal, nombreMoneda } from "@/lib/monedas";
import { paisVisitante } from "@/lib/ubicacion";

export const metadata: Metadata = { title: "Precios", description: "Desbloquea empresas y enlaces de todas las vacantes. Pago único con tarjeta u OXXO." };

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function Precios({ searchParams }: Props) {
  const { error, plan: elegido } = await searchParams;
  const usuario = await usuarioActual();
  const activos = pagosActivos();
  // Fuera de México: precio aproximado en su moneda y sin OXXO (solo existe en México)
  const pais = await paisVisitante();
  const enMexico = !pais || pais === "MX";
  const locales = await Promise.all(PLANES.map((p) => aproximadoLocal(pais, p.precio)));
  const moneda = nombreMoneda(pais);

  return (
    <>
      <Encabezado usuario={usuario} />
      <main className="contenedor py-10 sm:py-14">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Desbloquea todas las vacantes</h1>
          <p className="mt-3 text-gris">
            Ve qué empresa es, la descripción completa y el enlace para aplicar directo. Pago único {enMexico ? "con tarjeta o en efectivo en OXXO" : "con tarjeta"}: no se
            renueva solo.
          </p>
          <p className="mt-3 rounded-xl bg-radar-claro p-3 text-sm text-radar-oscuro">
            Las vacantes que publican los negocios en ChambaRadar siempre se ven completas, sin plan.
          </p>
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
          {PLANES.map((p, i) => (
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
              {locales[i] ? (
                <p className="text-sm font-medium text-slate-700">{locales[i]} en {moneda}, aprox.</p>
              ) : (
                <p className="text-sm text-gris">${(p.precio / p.dias).toFixed(2)} por día</p>
              )}
              <ul className="mt-5 flex-1 space-y-2 text-sm">
                <li>✓ Nombre de la empresa</li>
                <li>✓ Enlace directo para aplicar</li>
                <li>✓ Descripción completa</li>
                <li>✓ Buscar por empresa</li>
              </ul>
              <button className={`mt-6 w-full ${p.destacado ? "boton" : "boton-secundario"} disabled:opacity-50`} disabled={!activos} data-meta="InitiateCheckout" data-meta-valor={p.precio}>
                {!activos ? "Próximamente" : "Pagar"}
              </button>
            </form>
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-xl text-center text-sm text-gris">
          {enMexico
            ? "Pagos procesados por Stripe. Con OXXO recibes una ficha y tu acceso se activa en cuanto pagas en tienda (puede tardar unas horas)."
            : `Pagos procesados por Stripe. El plan es en pesos mexicanos; ${moneda ? `el precio en ${moneda} es aproximado y` : ""} el monto final lo ves antes de pagar.`}
        </p>
      </main>
      <Pie />
    </>
  );
}
