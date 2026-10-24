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
      className={`hoja fixed inset-x-0 bottom-0 z-[1100] mx-auto flex w-full max-w-lg flex-col rounded-t-[22px] bg-white shadow-[0_-2px_30px_rgba(0,0,0,0.18)] ${
        compacta ? "max-h-[58dvh]" : "max-h-[80dvh]"
      }`}
    >
      <div aria-hidden className="mx-auto mt-2 h-[5px] w-9 shrink-0 rounded-full bg-ios-terciario" />
      <header className="flex items-start gap-3 px-5 pb-2 pt-2">
        <div className="min-w-0 flex-1 text-[22px] font-bold leading-tight tracking-tight">{titulo}</div>
        <button onClick={onCerrar} aria-label="Cerrar" className="cerrar mt-0.5">
          <Equis />
        </button>
      </header>
      <div className="overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-1">{children}</div>
    </section>
  );
}

/** Ícono de cerrar (xmark) */
export function Equis({ tamano = 12 }: { tamano?: number }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 12 12" aria-hidden>
      <path d="M1.5 1.5l9 9m0-9l-9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
