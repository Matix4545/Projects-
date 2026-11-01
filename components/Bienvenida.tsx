"use client";

import type { ReactNode } from "react";

const PASOS: { icono: string; color: string; titulo: string; texto: ReactNode }[] = [
  {
    icono: "📍",
    color: "#007aff",
    titulo: "Reporta lo que ves",
    texto: "Baches, falta de agua, drenaje, alumbrado y más. Toca Reportar y marca el lugar en el mapa.",
  },
  {
    icono: "👥",
    color: "#34c759",
    titulo: "Confirma y da seguimiento",
    texto: "Si alguien ya lo reportó, toca “Yo también lo vi”. Cuando lo arreglen, márcalo como arreglado.",
  },
  {
    icono: "🔒",
    color: "#8e8e93",
    titulo: "Anónimo y ciudadano",
    texto: "No pedimos nombre ni teléfono. Somos vecinos: no es del gobierno ni de ningún partido.",
  },
];

/** Bienvenida estilo iOS ("Novedades"): sale solo la primera vez que alguien entra */
export function Bienvenida({ onCerrar }: { onCerrar: () => void }) {
  return (
    <div className="velo fixed inset-0 z-[3000] flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="titulo-bienvenida">
      <div className="hoja w-full max-w-md rounded-t-[28px] bg-white px-7 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-9 sm:rounded-[28px]">
        <h2 id="titulo-bienvenida" className="text-center text-[28px] font-bold leading-tight tracking-tight">
          Te damos la bienvenida a<br />
          Reporta <span className="text-ios-azul">Cajeme</span>
        </h2>
        <ul className="mt-8 space-y-6">
          {PASOS.map((p) => (
            <li key={p.titulo} className="flex gap-4">
              <span
                className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] text-[24px]"
                style={{ background: `${p.color}22` }}
                aria-hidden
              >
                {p.icono}
              </span>
              <span>
                <span className="block text-[16px] font-semibold">{p.titulo}</span>
                <span className="mt-0.5 block text-[15px] leading-snug text-ios-secundario">{p.texto}</span>
              </span>
            </li>
          ))}
        </ul>
        <button onClick={onCerrar} className="boton boton-principal mt-9 w-full">
          Comenzar
        </button>
      </div>
    </div>
  );
}
