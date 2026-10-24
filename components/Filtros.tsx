"use client";

import { useState } from "react";
import type { Pin } from "@/lib/datos";
import type { PropsSeccion } from "@/lib/secciones";
import { Equis } from "./HojaInferior";
import { Interruptor } from "./Interruptor";

/** Capa de secciones electorales dentro del panel de filtros */
/** Capa de rugosidad medida con celulares */
export type ControlRugosidad = {
  activa: boolean;
  onCambio: (activa: boolean) => void;
  resumen: { km: number; sesiones: number } | null;
  error: string | null;
};

export type ControlSecciones = {
  activas: boolean;
  onCambio: (activas: boolean) => void;
  top: PropsSeccion[];
  error: string | null;
};

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
    <div role="group" aria-label={etiqueta} className="segmentado">
      {opciones.map(([v, texto]) => (
        <button key={String(v)} aria-pressed={v === valor} onClick={() => onCambio(v)}>
          {texto}
        </button>
      ))}
    </div>
  );
}

/** Botón "Filtros" del mapa: puntos o calor, estado y antigüedad de los reportes. */
export function Filtros({
  filtros,
  onCambio,
  total,
  secciones,
  rugosidad,
}: {
  filtros: FiltrosMapa;
  onCambio: (f: FiltrosMapa) => void;
  total: number;
  secciones: ControlSecciones;
  rugosidad: ControlRugosidad;
}) {
  const [abierto, setAbierto] = useState(false);
  const activos = (filtros.vista !== "pines" ? 1 : 0) + (filtros.estado !== "normal" ? 1 : 0) + (filtros.dias ? 1 : 0);
  const cambiar = (parcial: Partial<FiltrosMapa>) => onCambio({ ...filtros, ...parcial });

  return (
    <div className="fixed bottom-[calc(4.875rem+env(safe-area-inset-bottom))] right-3 z-[1001]">
      {abierto ? (
        <div className="material w-[calc(100vw-1.5rem)] max-w-xs space-y-3 rounded-[20px] bg-ios-fondo/95 p-4 text-sm">
          <div className="flex items-center justify-between">
            <strong className="text-[17px] font-semibold">Filtros</strong>
            <button onClick={() => setAbierto(false)} aria-label="Cerrar filtros" className="cerrar">
              <Equis />
            </button>
          </div>
          <Segmentos
            etiqueta="Ver como"
            opciones={[
              ["pines", "Puntos"],
              ["calor", "Calor"],
            ]}
            valor={filtros.vista}
            onCambio={(vista) => cambiar({ vista })}
          />
          <Segmentos etiqueta="Estado" opciones={OPCIONES_ESTADO} valor={filtros.estado} onCambio={(estado) => cambiar({ estado })} />
          <Segmentos etiqueta="Reportados en los últimos" opciones={OPCIONES_DIAS} valor={filtros.dias} onCambio={(dias) => cambiar({ dias })} />
          <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-[15px]">
            🚗 Rugosidad medida
            <Interruptor etiqueta="Rugosidad medida" activo={rugosidad.activa} onCambio={rugosidad.onCambio} />
          </div>
          {rugosidad.activa && (
            <div className="text-xs text-ios-secundario">
              {rugosidad.error ? (
                <p className="text-ios-rojo">{rugosidad.error}</p>
              ) : (
                <>
                  <p className="flex flex-wrap gap-x-3 gap-y-1">
                    <span><i className="mr-1 inline-block h-1.5 w-4 rounded-full align-middle" style={{ background: "#1a9850" }} />Buena</span>
                    <span><i className="mr-1 inline-block h-1.5 w-4 rounded-full align-middle" style={{ background: "#f2b705" }} />Regular</span>
                    <span><i className="mr-1 inline-block h-1.5 w-4 rounded-full align-middle" style={{ background: "#d73027" }} />Mala</span>
                    <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-gray-900 align-middle" />Golpe</span>
                  </p>
                  {rugosidad.resumen && (
                    <p className="mt-1 text-ios-secundario">
                      {rugosidad.resumen.km.toLocaleString("es-MX")} km medidos en {rugosidad.resumen.sesiones}{" "}
                      {rugosidad.resumen.sesiones === 1 ? "recorrido" : "recorridos"}
                      {filtros.dias ? ` (últimos ${filtros.dias} días)` : " (siempre)"}.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
          <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-[15px]">
            🗳️ Secciones electorales
            <Interruptor etiqueta="Secciones electorales" activo={secciones.activas} onCambio={secciones.onCambio} />
          </div>
          {secciones.activas && (
            <div className="text-xs text-ios-secundario">
              {secciones.error ? (
                <p className="text-ios-rojo">{secciones.error}</p>
              ) : secciones.top.length === 0 ? (
                <p>Sin reportes en secciones en este periodo.</p>
              ) : (
                <>
                  <p className="mb-1 font-semibold text-ios-secundario">
                    Más reportes{filtros.dias ? ` (últimos ${filtros.dias} días)` : " (siempre)"}:
                  </p>
                  <ol className="space-y-0.5">
                    {secciones.top.map((s, i) => (
                      <li key={s.seccion} className="flex justify-between tabular-nums">
                        <span>
                          {i + 1}. Sección <strong>{s.seccion}</strong>
                          {s.distrito_local ? <span className="text-ios-terciario"> · DL {s.distrito_local}</span> : null}
                        </span>
                        <strong>{s.total.toLocaleString("es-MX")}</strong>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-1 text-ios-terciario">Toca el mapa para ver la sección de cualquier punto.</p>
                </>
              )}
            </div>
          )}
          <div className="flex items-center justify-between pt-0.5 text-xs text-ios-secundario">
            <span>
              {total.toLocaleString("es-MX")} {total === 1 ? "reporte" : "reportes"}
            </span>
            {activos > 0 && (
              <button onClick={() => onCambio(FILTROS_INICIALES)} className="text-[15px] text-ios-azul">
                Quitar filtros
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAbierto(true)}
          className={`h-9 rounded-full px-3.5 text-[15px] font-medium ${activos ? "bg-ios-etiqueta text-white shadow-lg" : "material text-ios-azul"}`}
        >
          {filtros.vista === "calor" ? "🔥 " : ""}Filtros{activos ? ` · ${activos}` : ""}
        </button>
      )}
    </div>
  );
}
