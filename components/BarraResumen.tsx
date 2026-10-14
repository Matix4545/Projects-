import type { Resumen } from "@/lib/datos";

export function BarraResumen({ resumen }: { resumen: Resumen | null }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-[1000] bg-gray-900/90 px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 text-center text-sm text-white backdrop-blur">
      {resumen ? (
        <>
          <strong>{resumen.reportes}</strong> {resumen.reportes === 1 ? "reporte" : "reportes"} en las últimas 24 h ·{" "}
          <strong>{resumen.colonias_afectadas}</strong> {resumen.colonias_afectadas === 1 ? "colonia afectada" : "colonias afectadas"}
        </>
      ) : (
        "Cargando…"
      )}
    </div>
  );
}
