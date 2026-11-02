import Link from "next/link";
import type { VacanteVista } from "@/lib/muro";
import { formatoSueldo, haceCuanto } from "@/lib/formato";
import { NOMBRE_CATEGORIA, NOMBRE_NIVEL, PAISES } from "@/lib/tipos";

const MODALIDAD = { remoto: "Remoto", hibrido: "Híbrido", presencial: "Presencial" } as const;
const IDIOMA = { es: "Español", pt: "Portugués", en: "Inglés" } as const;

export function TarjetaVacante({ v }: { v: VacanteVista }) {
  const sueldo = formatoSueldo(v.sueldo_min, v.sueldo_max, v.moneda, v.periodo);
  const paises = v.paises.map((p) => PAISES[p] ?? p);

  return (
    <article className="rounded-2xl border border-borde bg-white p-4 shadow-sm transition hover:border-radar/40 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h3 className="text-base font-semibold leading-snug text-tinta sm:text-lg">{v.titulo}</h3>
          <p className="text-sm text-gris">
            {v.bloqueada ? (
              <span className="borroso font-medium text-tinta" aria-label="Empresa oculta">
                {v.empresa_nombre}
              </span>
            ) : (
              <span className="font-medium text-tinta">{v.empresa_nombre}</span>
            )}
            <span className="mx-1.5">·</span>
            {v.ubicacion}
          </p>
          {sueldo && <p className="text-sm font-semibold text-radar-oscuro">{sueldo}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
          {v.bloqueada ? (
            <Link href="/precios" className="boton px-4 py-2 text-sm">
              🔒 Aplicar
            </Link>
          ) : (
            <a href={v.url!} target="_blank" rel="noopener noreferrer nofollow" className="boton px-4 py-2 text-sm">
              Aplicar ↗
            </a>
          )}
          <span className="text-xs text-gris">{haceCuanto(v.publicada)}</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className={`chip ${v.modalidad === "remoto" ? "bg-radar-claro text-radar-oscuro" : ""}`}>{MODALIDAD[v.modalidad]}</span>
        {v.empresa_tipo === "remoto" && <span className="chip bg-amber-100 text-amber-800">Empresa extranjera</span>}
        <span className="chip">{NOMBRE_CATEGORIA[v.categoria]}</span>
        <span className="chip">{NOMBRE_NIVEL[v.nivel]}</span>
        {v.idioma !== "es" && <span className="chip">En {IDIOMA[v.idioma].toLowerCase()}</span>}
        {paises.length > 0 && paises.length <= 4 && paises.map((p) => <span key={p} className="chip">{p}</span>)}
        {paises.length > 4 && <span className="chip">{paises.length} países</span>}
      </div>

      {v.descripcion && (
        <details className="group mt-3">
          <summary className="cursor-pointer text-sm font-medium text-gris hover:text-tinta">Ver descripción</summary>
          <p className={`mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600 ${v.bloqueada ? "borroso" : ""}`}>
            {v.bloqueada ? v.descripcion : `${v.descripcion.slice(0, 900)}${v.descripcion.length > 900 ? "…" : ""}`}
          </p>
          {v.bloqueada && (
            <p className="mt-2 text-sm">
              <Link href="/precios" className="font-semibold text-radar-oscuro hover:underline">
                Desbloquea la empresa y la descripción completa →
              </Link>
            </p>
          )}
        </details>
      )}
    </article>
  );
}
