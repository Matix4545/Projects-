import { PERIODOS, type HorasPeriodo } from "@/lib/constantes";
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
    <div className="fixed inset-x-0 bottom-0 z-[1000] bg-gray-900/90 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 text-white backdrop-blur">
      <div className="mx-auto flex max-w-lg items-center gap-3">
        <div className="flex shrink-0 overflow-hidden rounded-full border border-white/30 text-xs font-semibold" role="group" aria-label="Periodo">
          {PERIODOS.map((p) => (
            <button
              key={p.horas}
              onClick={() => onHoras(p.horas)}
              aria-pressed={p.horas === horas}
              className={`px-2.5 py-1.5 ${p.horas === horas ? "bg-white text-gray-900" : "text-white/85"}`}
            >
              {p.corto}
            </button>
          ))}
        </div>
        <p className="min-w-0 flex-1 text-xs leading-tight sm:text-sm">
          {resumen ? (
            <>
              <strong>{resumen.reportes}</strong> {resumen.reportes === 1 ? "reporte" : "reportes"} ·{" "}
              <strong>{resumen.colonias_afectadas}</strong>{" "}
              {resumen.colonias_afectadas === 1 ? "colonia afectada" : "colonias afectadas"}
            </>
          ) : (
            "Cargando…"
          )}
        </p>
      </div>
    </div>
  );
}
