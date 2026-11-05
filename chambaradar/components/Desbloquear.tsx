import Link from "next/link";
import type { PreciosLocales } from "@/lib/monedas";
import { ahorroMes, PLANES } from "@/lib/planes";
import { Candado, Flecha, Palomita } from "./Iconos";

// Bloques de venta para quien llega sin plan (por ejemplo, desde un anuncio).
// El botón principal manda directo al pago de 1 semana: un clic menos que pasar
// por /precios. El pago y su lógica no cambian (POST /api/pago, plan en MXN);
// fuera de México solo se MUESTRA el precio aproximado en la moneda local.

const SEMANA = PLANES.find((p) => p.id === "semana")!;

/** Precios de México, para donde no se sabe el país. */
export const PRECIOS_MX: PreciosLocales = {
  semana: `$${SEMANA.precio}`,
  mes: `$${PLANES.find((p) => p.id === "mes")!.precio}`,
  nota: "",
  oxxo: true,
  ahorroMes: `ahorras $${ahorroMes().pesos}`,
};

/** Botón que abre el pago de Stripe del plan de 1 semana. */
export function BotonPagarSemana({ className = "boton w-full sm:w-auto", texto, precio = PRECIOS_MX.semana }: { className?: string; texto?: string; precio?: string }) {
  return (
    <form action="/api/pago" method="post" className="contents">
      <input type="hidden" name="plan" value={SEMANA.id} />
      <button className={className} data-evento="pagar" data-meta="InitiateCheckout" data-meta-valor={SEMANA.precio}>
        <Candado className="size-4" /> {texto ?? `Desbloquear todo por ${precio}`}
      </button>
    </form>
  );
}

/** El portal grande con el que se compara, según el país ("OCC" solo existe en México). */
const portal = (pais: string) => (pais === "MX" ? "LinkedIn ni OCC" : "LinkedIn ni Computrabajo");

/** Arriba del listado: qué es, qué ves gratis y qué obtienes por el plan de 1 semana. */
/** Empresas del catálogo que la gente reconoce (no dice qué vacante es de cuál). */
const EMPRESAS_CONOCIDAS = "Banorte, Cemex, Accenture, Salesforce";

export function BloqueDesbloquear({
  titular,
  conSesion,
  pais,
  precios,
  nuevasSemana = 0,
  empresas = 0,
}: {
  titular: string;
  conSesion: boolean;
  pais: string;
  precios: PreciosLocales;
  /** Vacantes publicadas en los últimos 7 días dentro de esta búsqueda */
  nuevasSemana?: number;
  /** Empresas con vacantes hoy en todo el sitio */
  empresas?: number;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-radar/30 bg-white shadow-sm">
      <div className="space-y-3 p-4 sm:p-6">
        <p className="text-base font-extrabold leading-snug tracking-tight sm:text-xl">{titular}</p>
        {(nuevasSemana > 0 || empresas > 0) && (
          <p className="text-xs font-medium text-slate-500">
            {nuevasSemana > 0 && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">+{nuevasSemana.toLocaleString("es-MX")} nuevas esta semana</span>}
            {empresas > 0 && (
              <>
                {nuevasSemana > 0 ? " · " : ""}
                {EMPRESAS_CONOCIDAS} y {Math.max(0, empresas - 4).toLocaleString("es-MX")} empresas más
              </>
            )}
          </p>
        )}
        <ul className="hidden space-y-1.5 text-sm text-slate-700 sm:block">
          {[
            `Directo de las páginas de empleo de las empresas, no de ${portal(pais)}`,
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
          <strong>Gratis</strong> ves puesto y sueldo; <strong>por {precios.semana}</strong>
          {precios.oxxo ? " MXN" : ""} ves la empresa y el enlace para aplicar, en todas.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <BotonPagarSemana precio={precios.semana} />
          <Link href="/precios" className="text-center text-sm font-semibold text-radar-oscuro hover:underline sm:text-left">
            O 1 mes por {precios.mes} <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">{precios.ahorroMes}</span>{" "}
            <Flecha className="inline size-3.5" />
          </Link>
        </div>
        {precios.nota && <p className="text-center text-xs text-gris sm:text-left">Precio aproximado: el plan es de {precios.nota}.</p>}
        {/* En celular la barra fija de abajo ya dice "pago único, tarjeta u OXXO": aquí solo en pantallas grandes */}
        <p className="hidden flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 sm:flex">
          <span>🔒 Pago seguro con Stripe</span>
          <span>⚡ Acceso inmediato</span>
          <span>🚫 Sin suscripción</span>
          {precios.oxxo && <span>🏪 Tarjeta u OXXO</span>}
        </p>
        <p className="hidden text-xs text-gris sm:block">
          Pago único, no se renueva solo · {precios.oxxo ? "Tarjeta u OXXO" : "Con tarjeta"} · No necesitas crear cuenta: tu acceso queda en el correo con el que pagas.
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
export function BarraDesbloquear({ precios }: { precios: PreciosLocales }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-borde bg-white/95 px-4 py-2.5 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-xl items-center gap-3">
        <p className="min-w-0 flex-1 text-xs leading-snug text-slate-600">
          <span className="font-semibold text-tinta">Empresa y enlace ocultos.</span> Pago único, {precios.oxxo ? "tarjeta u OXXO" : "con tarjeta"}.
        </p>
        <BotonPagarSemana className="boton shrink-0 px-4 py-2.5 text-sm" texto={`Ver todo ${precios.semana}`} />
      </div>
    </div>
  );
}
