import Link from "next/link";
import { PLANES } from "@/lib/planes";
import { Candado, Flecha, Palomita } from "./Iconos";

// Bloques de venta para quien llega sin plan (por ejemplo, desde un anuncio).
// El botón principal manda directo al pago de 1 semana ($49): un clic menos
// que pasar por /precios. El pago y su lógica no cambian (POST /api/pago).

const SEMANA = PLANES.find((p) => p.id === "semana")!;
const MES = PLANES.find((p) => p.id === "mes")!;

/** Botón que abre el pago de Stripe del plan de 1 semana. */
export function BotonPagarSemana({ className = "boton w-full sm:w-auto", texto }: { className?: string; texto?: string }) {
  return (
    <form action="/api/pago" method="post" className="contents">
      <input type="hidden" name="plan" value={SEMANA.id} />
      <button className={className} data-meta="InitiateCheckout" data-meta-valor={SEMANA.precio}>
        <Candado className="size-4" /> {texto ?? `Desbloquear todo por $${SEMANA.precio}`}
      </button>
    </form>
  );
}

/** Arriba del listado: qué es, qué ves gratis y qué obtienes por $49. */
export function BloqueDesbloquear({ titular, conSesion }: { titular: string; conSesion: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-radar/30 bg-white shadow-sm">
      <div className="space-y-3 p-4 sm:p-6">
        <p className="text-base font-extrabold leading-snug tracking-tight sm:text-xl">{titular}</p>
        <ul className="hidden space-y-1.5 text-sm text-slate-700 sm:block">
          {[
            "Directo de las páginas de empleo de las empresas, no de LinkedIn ni OCC",
            "Menos competencia: casi nadie busca ahí",
            "Revisadas todos los días: las cerradas desaparecen",
          ].map((t) => (
            <li key={t} className="flex gap-2">
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-radar-claro text-radar-oscuro">
                <Palomita className="size-2.5" />
              </span>
              {t}
            </li>
          ))}
        </ul>
        <p className="text-sm text-slate-700 sm:rounded-xl sm:bg-fondo sm:px-3 sm:py-2.5">
          <span className="sm:hidden">Directo de las páginas de las empresas, no de LinkedIn ni OCC. </span><strong>Gratis</strong> ves puesto y sueldo; <strong>por ${SEMANA.precio} MXN</strong> ves
          la empresa y el enlace para aplicar, en todas.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <BotonPagarSemana />
          <Link href="/precios" className="text-center text-sm font-semibold text-radar-oscuro hover:underline sm:text-left">
            O 1 mes por ${MES.precio} <Flecha className="inline size-3.5" />
          </Link>
        </div>
        <p className="hidden text-xs text-gris sm:block">
          Pago único, no se renueva solo · Tarjeta u OXXO · No necesitas crear cuenta: tu acceso queda en el correo con el que pagas.
          {!conSesion && (
            <>
              {" "}
              ¿Ya pagaste?{" "}
              <Link href="/entrar?siguiente=/vacantes" className="font-semibold text-radar-oscuro hover:underline">
                Entra con tu correo
              </Link>
              .
            </>
          )}
        </p>
      </div>
    </div>
  );
}

/** Barra fija abajo en el celular: el botón de pago siempre a la mano mientras ven vacantes. */
export function BarraDesbloquear() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-borde bg-white/95 px-4 py-2.5 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-xl items-center gap-3">
        <p className="min-w-0 flex-1 text-xs leading-snug text-slate-600">
          <span className="font-semibold text-tinta">Empresa y enlace ocultos.</span> Pago único, tarjeta u OXXO.
        </p>
        <BotonPagarSemana className="boton shrink-0 px-4 py-2.5 text-sm" texto={`Ver todo $${SEMANA.precio}`} />
      </div>
    </div>
  );
}
