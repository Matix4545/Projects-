import { PERIODOS, type HorasPeriodo } from "@/lib/constantes";

const num = (n: number) => n.toLocaleString("es-MX");
import type { Resumen } from "@/lib/datos";

export function BarraResumen({
  resumen,
  horas,
  onHoras,
}: {
  resumen: Resumen | null;
  horas: HorasPeriodo;
  onHoras: (h: HorasPeriodo) => void;
}) {
  return (
    <div className="material fixed inset-x-0 bottom-0 z-[1000] px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
      <div className="mx-auto flex max-w-lg items-center gap-3">
        <div className="segmentado w-[150px] shrink-0" role="group" aria-label="Periodo">
          {PERIODOS.map((p) => (
            <button key={p.horas} onClick={() => onHoras(p.horas)} aria-pressed={p.horas === horas}>
              {p.corto}
            </button>
          ))}
        </div>
        <p className="min-w-0 flex-1 text-right text-[13px] leading-tight text-ios-secundario">
          {resumen ? (
            <>
              <span className="block">
                <strong className="font-semibold text-ios-etiqueta">{num(resumen.reportes)}</strong> en {PERIODOS.find((p) => p.horas === horas)?.corto} ·{" "}
                <strong className="font-semibold text-ios-etiqueta">{num(resumen.colonias_afectadas)}</strong>{" "}
                {resumen.colonias_afectadas === 1 ? "colonia" : "colonias"}
              </span>
              {resumen.total != null && (
                <span className="block">
                  <strong className="font-semibold text-ios-etiqueta">{num(resumen.total)}</strong> reportes en total
                </span>
              )}
            </>
          ) : (
            "Cargando…"
          )}
        </p>
      </div>
    </div>
  );
}
