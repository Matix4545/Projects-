"use client";

export function BotonImprimir() {
  return (
    <button onClick={() => window.print()} className="boton boton-tenue min-h-9 rounded-full px-4 text-[15px]">
      Guardar PDF
    </button>
  );
}
