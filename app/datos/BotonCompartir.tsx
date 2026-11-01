"use client";

import { useState } from "react";

/** Compartir la página (menú del celular) o copiar el enlace en computadora */
export function BotonCompartir({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  async function compartir() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Reporta Cajeme · Datos", text: texto, url });
        return;
      }
      await navigator.clipboard.writeText(`${texto} ${url}`);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      /* canceló o sin permiso */
    }
  }
  return (
    <button onClick={compartir} className="boton boton-tenue w-full">
      <svg width="16" height="20" viewBox="0 0 16 20" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 13V1.5M4 5l4-3.5L12 5" />
        <path d="M4.5 8H3a1.5 1.5 0 0 0-1.5 1.5v7A1.5 1.5 0 0 0 3 18h10a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 13 8h-1.5" />
      </svg>
      {copiado ? "Enlace copiado" : "Compartir estos datos"}
    </button>
  );
}
