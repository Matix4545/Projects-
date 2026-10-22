import type { Pin } from "@/lib/datos";
import { urgencia, type NivelUrgencia } from "@/lib/urgencia";

const CLASES: Record<NivelUrgencia, string> = {
  reciente: "bg-amber-400 text-gray-900",
  rezago: "bg-orange-600 text-white",
  critico: "bg-red-600 text-white",
  resuelto: "bg-green-600 text-white",
};

const ICONO: Partial<Record<NivelUrgencia, string>> = { reciente: "⏳", rezago: "⚠️", resuelto: "✅" };

/** Semáforo de días sin resolver (o cuánto tardaron en arreglarlo). */
export function BadgeDias({ pin }: { pin: Pick<Pin, "estado" | "creado_en" | "arreglado_en"> }) {
  const u = urgencia(pin);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${CLASES[u.nivel]}`}>
      {u.nivel === "critico" ? (
        // Punto que late: llama la atención sin hacer ilegible el texto
        <span className="relative flex h-2.5 w-2.5" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75 motion-reduce:hidden" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
        </span>
      ) : (
        <span aria-hidden>{ICONO[u.nivel]}</span>
      )}
      {u.texto}
    </span>
  );
}
