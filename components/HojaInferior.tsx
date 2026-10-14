"use client";

import type { ReactNode } from "react";

/** Panel que sube desde abajo (estilo app de celular). */
export function HojaInferior({
  titulo,
  onCerrar,
  children,
  compacta = false,
}: {
  titulo: ReactNode;
  onCerrar: () => void;
  children: ReactNode;
  compacta?: boolean;
}) {
  return (
    <section
      role="dialog"
      aria-label={typeof titulo === "string" ? titulo : undefined}
      className={`hoja fixed inset-x-0 bottom-0 z-[1100] mx-auto flex w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.25)] ${
        compacta ? "max-h-[58dvh]" : "max-h-[75dvh]"
      }`}
    >
      <header className="flex items-center gap-2 border-b border-gray-100 px-4 pb-2 pt-3">
        <div className="min-w-0 flex-1 text-lg font-bold leading-tight text-gray-900">{titulo}</div>
        <button
          onClick={onCerrar}
          aria-label="Cerrar"
          className="-mr-1 grid h-10 w-10 shrink-0 place-items-center rounded-full text-2xl text-gray-500 hover:bg-gray-100"
        >
          ×
        </button>
      </header>
      <div className="overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">{children}</div>
    </section>
  );
}
