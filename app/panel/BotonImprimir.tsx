"use client";

export function BotonImprimir() {
  return (
    <button onClick={() => window.print()} className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white">
      Guardar PDF
    </button>
  );
}
