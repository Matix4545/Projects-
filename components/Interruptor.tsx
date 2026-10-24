"use client";

/** Interruptor estilo iOS (switch) */
export function Interruptor({
  activo,
  onCambio,
  etiqueta,
}: {
  activo: boolean;
  onCambio: (activo: boolean) => void;
  etiqueta: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      onClick={() => onCambio(!activo)}
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 ${activo ? "bg-ios-verde" : "bg-ios-relleno"}`}
    >
      <span
        className={`absolute left-[2px] top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.16)] transition-transform duration-200 ${
          activo ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}
