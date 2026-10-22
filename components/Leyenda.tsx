"use client";

import { useState } from "react";
import { COLOR_ARREGLADO, COLOR_ESTADO, INFO_PIN, TIPOS_PIN, esLinea, textoPeriodo } from "@/lib/constantes";

const FILAS: [string, string, "zona" | "pin" | "linea"][] = [
  [COLOR_ESTADO.sin_agua, "Sin agua", "zona"],
  [COLOR_ESTADO.baja_presion, "Baja presión", "zona"],
  [COLOR_ESTADO.sucia, "Agua sucia", "zona"],
  [COLOR_ESTADO.con_agua, "Con agua", "zona"],
  [COLOR_ESTADO.ninguno, "Sin reportes en el periodo", "zona"],
  ...TIPOS_PIN.map((t): [string, string, "pin" | "linea"] => [
    INFO_PIN[t].color,
    `${INFO_PIN[t].emoji} ${INFO_PIN[t].nombre}`,
    esLinea(t) ? "linea" : "pin",
  ]),
  [COLOR_ARREGLADO, "Ya lo arreglaron", "pin"],
];

export function Leyenda({ horas }: { horas: number }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <div className="fixed bottom-[7.5rem] left-3 z-[1001]">
      {abierta ? (
        <div className="w-56 rounded-xl bg-white/95 p-3 text-sm shadow-lg">
          <div className="mb-1 flex items-center justify-between">
            <strong>¿Qué significan los colores?</strong>
            <button onClick={() => setAbierta(false)} aria-label="Cerrar leyenda" className="px-2 text-lg text-gray-500">
              ×
            </button>
          </div>
          <ul className="space-y-1">
            {FILAS.map(([color, texto, forma]) => (
              <li key={texto} className="flex items-center gap-2">
                <span
                  className={`inline-block shrink-0 ${
                    forma === "linea" ? "h-1.5 w-4 rounded-full ring-1 ring-gray-900/60" : forma === "pin" ? "h-4 w-4 rounded-full border border-gray-700/40" : "h-4 w-4 rounded-sm"
                  }`}
                  style={
                    forma !== "zona"
                      ? { background: color }
                      : color === COLOR_ESTADO.ninguno
                        ? { background: `${color}14`, border: "1px solid #6b728073" } // igual que en el mapa: gris muy tenue
                        : { background: `${color}80`, border: `1.5px solid ${color}` }
                  }
                />
                {forma === "zona" && color === COLOR_ESTADO.ninguno ? `Sin reportes en ${textoPeriodo(horas)}` : texto}
              </li>
            ))}
            <li className="pt-1 text-xs text-gray-500">
              Colonias: lo más reportado en {textoPeriodo(horas)}. Un reporte de “con agua” la pone en verde.
            </li>
            <li className="text-xs text-gray-500">Borde rojo: peligro (bache peligroso, alcantarilla sin tapa, cables expuestos o quema).</li>
          </ul>
        </div>
      ) : (
        <button
          onClick={() => setAbierta(true)}
          className="rounded-full bg-white/95 px-3 py-2 text-sm font-semibold text-gray-700 shadow-lg"
        >
          Colores
        </button>
      )}
    </div>
  );
}
