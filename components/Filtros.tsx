"use client";

import { useState } from "react";
import type { Pin } from "@/lib/datos";

export type FiltrosMapa = {
  vista: "pines" | "calor";
  estado: "normal" | "pendientes" | "resueltos";
  /** Solo reportes creados en los últimos N días (0 = todos) */
  dias: 0 | 7 | 30 | 90;
};

export const FILTROS_INICIALES: FiltrosMapa = { vista: "pines", estado: "normal", dias: 0 };

const DIA_MS = 86_400_000;

export function filtrarPins(pins: Pin[], f: FiltrosMapa, ahora = Date.now()) {
  return pins.filter((p) => {
    if (f.dias && ahora - new Date(p.creado_en).getTime() > f.dias * DIA_MS) return false;
    switch (f.estado) {
      case "pendientes":
        return p.estado === "activo";
      case "resueltos":
        return p.estado === "arreglado";
      default:
        // Pendientes y los arreglados de la última semana (como siempre ha sido el mapa)
        return p.estado === "activo" || (p.arreglado_en !== null && ahora - new Date(p.arreglado_en).getTime() < 7 * DIA_MS);
    }
  });
}

const OPCIONES_ESTADO: [FiltrosMapa["estado"], string][] = [
  ["normal", "Todos"],
  ["pendientes", "Pendientes"],
  ["resueltos", "Resueltos"],
];

const OPCIONES_DIAS: [FiltrosMapa["dias"], string][] = [
  [0, "Siempre"],
  [7, "7 d"],
  [30, "30 d"],
  [90, "90 d"],
];

/** Botones unidos (como el selector de 24 h / 72 h / 7 días): una sola opción activa. */
function Segmentos<T extends string | number>({
  etiqueta,
  opciones,
  valor,
  onCambio,
}: {
  etiqueta: string;
  opciones: [T, string][];
  valor: T;
  onCambio: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={etiqueta} className="flex rounded-full bg-gray-100 p-1">
      {opciones.map(([v, texto]) => (
        <button
          key={String(v)}
          aria-pressed={v === valor}
          onClick={() => onCambio(v)}
          className={`flex-1 whitespace-nowrap rounded-full px-2 py-1.5 text-sm font-semibold ${
            v === valor ? "bg-white text-gray-900 shadow" : "text-gray-500"
          }`}
        >
          {texto}
        </button>
      ))}
    </div>
  );
}

/** Botón "Filtros" del mapa: puntos o calor, estado y antigüedad de los reportes. */
export function Filtros({ filtros, onCambio, total }: { filtros: FiltrosMapa; onCambio: (f: FiltrosMapa) => void; total: number }) {
  const [abierto, setAbierto] = useState(false);
  const activos = (filtros.vista !== "pines" ? 1 : 0) + (filtros.estado !== "normal" ? 1 : 0) + (filtros.dias ? 1 : 0);
  const cambiar = (parcial: Partial<FiltrosMapa>) => onCambio({ ...filtros, ...parcial });

  return (
    <div className="fixed bottom-[7.5rem] right-3 z-[1001]">
      {abierto ? (
        <div className="w-[calc(100vw-1.5rem)] max-w-xs space-y-2.5 rounded-2xl bg-white p-3 text-sm shadow-xl">
          <div className="flex items-center justify-between">
            <strong>Filtros</strong>
            <button onClick={() => setAbierto(false)} aria-label="Cerrar filtros" className="-mr-1 px-2 text-xl leading-none text-gray-400">
              ×
            </button>
          </div>
          <Segmentos
            etiqueta="Ver como"
            opciones={[
              ["pines", "📍 Puntos"],
              ["calor", "🔥 Calor"],
            ]}
            valor={filtros.vista}
            onCambio={(vista) => cambiar({ vista })}
          />
          <Segmentos etiqueta="Estado" opciones={OPCIONES_ESTADO} valor={filtros.estado} onCambio={(estado) => cambiar({ estado })} />
          <Segmentos etiqueta="Reportados en los últimos" opciones={OPCIONES_DIAS} valor={filtros.dias} onCambio={(dias) => cambiar({ dias })} />
          <div className="flex items-center justify-between pt-0.5 text-xs text-gray-500">
            <span>
              {total.toLocaleString("es-MX")} {total === 1 ? "reporte" : "reportes"}
            </span>
            {activos > 0 && (
              <button onClick={() => onCambio(FILTROS_INICIALES)} className="font-semibold text-blue-700">
                Quitar filtros
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAbierto(true)}
          className={`rounded-full px-3 py-2 text-sm font-semibold shadow-lg ${activos ? "bg-blue-700 text-white" : "bg-white/95 text-gray-700"}`}
        >
          {filtros.vista === "calor" ? "🔥 " : ""}Filtros{activos ? ` · ${activos}` : ""}
        </button>
      )}
    </div>
  );
}
