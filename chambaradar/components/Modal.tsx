"use client";

import { useEffect, useRef } from "react";
import { Cerrar } from "./Iconos";

/** Ventana centrada (en celular sube desde abajo). Se cierra con Esc, con la ✕ o tocando afuera. */
export function Modal({
  abierto,
  alCerrar,
  titulo,
  children,
  ancho = "sm:max-w-2xl",
}: {
  abierto: boolean;
  alCerrar: () => void;
  titulo: string;
  children: React.ReactNode;
  ancho?: string;
}) {
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && alCerrar();
    document.addEventListener("keydown", tecla);
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    caja.current?.focus();
    return () => {
      document.removeEventListener("keydown", tecla);
      document.body.style.overflow = antes;
    };
  }, [abierto, alCerrar]);

  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-noche/60 backdrop-blur-[2px] sm:items-center sm:p-6" onClick={alCerrar}>
      <div
        ref={caja}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
        className={`relative max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl outline-none sm:rounded-3xl sm:p-7 ${ancho}`}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-bold leading-snug">{titulo}</h2>
          <button onClick={alCerrar} className="-m-1 rounded-full p-1.5 text-gris hover:bg-slate-100 hover:text-tinta" aria-label="Cerrar">
            <Cerrar className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
