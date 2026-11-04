"use client";
import { PAISES } from "@/lib/config";
import { useTienda } from "./Tienda";

export function SelectorPais({ className = "" }: { className?: string }) {
  const { paisCodigo, cambiarPais } = useTienda();
  return (
    <label className={`items-center gap-1.5 text-sm ${className || "inline-flex"}`}>
      <span className="sr-only">País para ver precios aproximados</span>
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" />
      </svg>
      <select
        value={paisCodigo}
        onChange={(e) => cambiarPais(e.target.value)}
        className="cursor-pointer rounded-md bg-transparent py-1 pr-1 font-medium outline-none"
      >
        {PAISES.map((p) => (
          <option key={p.codigo} value={p.codigo}>
            {p.nombre} ({p.moneda})
          </option>
        ))}
      </select>
    </label>
  );
}
