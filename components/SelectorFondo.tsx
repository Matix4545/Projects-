"use client";

import { useState } from "react";
import { FONDOS, miniatura, type Fondo } from "@/lib/fondos";
import { Equis } from "./HojaInferior";

/** Botón de capas (como en Apple Maps): elige entre mapa, claro y satélite. */
export function SelectorFondo({ fondo, onCambio }: { fondo: Fondo; onCambio: (f: Fondo) => void }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setAbierto((a) => !a)}
        aria-label="Tipo de mapa"
        aria-expanded={abierto}
        className="material grid h-10 w-10 place-items-center rounded-full text-ios-azul"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
          <path d="M10 2.5l7.5 4-7.5 4-7.5-4 7.5-4z" />
          <path d="M2.5 10l7.5 4 7.5-4" />
          <path d="M2.5 13.5l7.5 4 7.5-4" />
        </svg>
      </button>
      {abierto && (
        <div className="material absolute right-0 top-12 z-20 w-[272px] rounded-[20px] bg-white/95 p-4">
          <div className="mb-3 flex items-center justify-between">
            <strong className="text-[17px] font-semibold">Tipo de mapa</strong>
            <button onClick={() => setAbierto(false)} aria-label="Cerrar" className="cerrar">
              <Equis />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2.5" role="group" aria-label="Tipo de mapa">
            {(Object.keys(FONDOS) as Fondo[]).map((f) => (
              <button
                key={f}
                aria-pressed={fondo === f}
                onClick={() => {
                  onCambio(f);
                  setAbierto(false);
                }}
                className="flex flex-col items-center gap-1.5 text-[13px]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={miniatura(f)}
                  alt=""
                  className={`h-[60px] w-full rounded-xl bg-ios-relleno object-cover ${fondo === f ? "ring-[3px] ring-ios-azul" : ""}`}
                />
                <span className={fondo === f ? "font-semibold text-ios-azul" : ""}>{FONDOS[f].nombre}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
