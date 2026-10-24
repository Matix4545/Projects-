import type { Pin } from "@/lib/datos";
import { urgencia, type NivelUrgencia } from "@/lib/urgencia";

const CLASES: Record<NivelUrgencia, string> = {
  reciente: "bg-ios-amarillo/25 text-[#8a6100]",
  rezago: "bg-ios-naranja/15 text-[#c93400]",
  critico: "bg-ios-rojo text-white",
  resuelto: "bg-ios-verde/15 text-[#248a3d]",
};

const ICONO: Partial<Record<NivelUrgencia, string>> = { reciente: "⏳", rezago: "⚠️", resuelto: "✅" };

/** Semáforo de días sin resolver (o cuánto tardaron en arreglarlo). */
export function BadgeDias({ pin }: { pin: Pick<Pin, "estado" | "creado_en" | "arreglado_en"> }) {
  const u = urgencia(pin);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold ${CLASES[u.nivel]}`}>
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
