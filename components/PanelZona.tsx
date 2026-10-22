"use client";

import { useEffect, useState } from "react";
import { PERIODOS, textoPeriodo } from "@/lib/constantes";
import { COLOR_ESTADO, ESTADOS_AGUA, ETIQUETAS } from "@/lib/constantes";
import { cargarDetalleZona, type DetalleZona } from "@/lib/datos";
import { haceCuanto, horaLocal } from "@/lib/tiempo";
import { BotonDenunciar } from "./BotonDenunciar";
import { HojaInferior } from "./HojaInferior";

export function PanelZona({
  zonaId,
  horas,
  version,
  onCerrar,
  onAviso,
}: {
  zonaId: number;
  horas: number;
  version: number;
  onCerrar: () => void;
  onAviso: (m: string) => void;
}) {
  const [detalle, setDetalle] = useState<DetalleZona | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let vigente = true;
    setError(false);
    cargarDetalleZona(zonaId, horas)
      .then((d) => vigente && setDetalle(d))
      .catch(() => vigente && setError(true));
    return () => {
      vigente = false;
    };
  }, [zonaId, horas, version]);

  const actual = detalle?.id === zonaId ? detalle : null;
  // Si la base de datos aún no tiene el SQL nuevo, los datos vienen solo de 24 h
  const horasDatos = actual?.conteo_periodo ? (actual.horas ?? horas) : 24;
  const conteoPeriodo = actual?.conteo_periodo ?? actual?.conteo_24h ?? {};
  const detallesSucia = actual?.detalles_sucia ?? actual?.detalles_sucia_24h ?? {};
  const etiquetaPeriodo = PERIODOS.find((p) => p.horas === horasDatos)?.corto ?? `${horasDatos} h`;
  const mostrar7d = horasDatos !== 168;
  const color = actual?.estado ? COLOR_ESTADO[actual.estado] : COLOR_ESTADO.ninguno;

  return (
    <HojaInferior titulo={actual?.nombre ?? "Cargando…"} onCerrar={onCerrar}>
      {error && <p className="text-red-600">No se pudo cargar la información. Revisa tu conexión.</p>}
      {actual && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="h-5 w-5 rounded-full" style={{ background: color }} />
            <div>
              <div className="font-semibold">{actual.estado ? `Estado: ${ETIQUETAS[actual.estado]}` : `Sin reportes en ${textoPeriodo(horasDatos)}`}</div>
              <div className="text-sm text-gray-500">
                Último reporte: {actual.ultimo_reporte ? `${haceCuanto(actual.ultimo_reporte)} (${horaLocal(actual.ultimo_reporte)})` : "nunca"}
              </div>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-1 font-normal">Reportes</th>
                <th className="py-1 text-right font-normal">{etiquetaPeriodo}</th>
                {mostrar7d && <th className="py-1 text-right font-normal">7 días</th>}
              </tr>
            </thead>
            <tbody>
              {ESTADOS_AGUA.map((e) => (
                <tr key={e} className="border-t border-gray-100">
                  <td className="py-1.5">
                    <span className="mr-2 inline-block h-3 w-3 rounded-full align-middle" style={{ background: COLOR_ESTADO[e] }} />
                    {ETIQUETAS[e]}
                  </td>
                  <td className="py-1.5 text-right font-semibold">{conteoPeriodo[e] ?? 0}</td>
                  {mostrar7d && <td className="py-1.5 text-right">{actual.conteo_7d[e] ?? 0}</td>}
                </tr>
              ))}
            </tbody>
          </table>

          {Object.keys(detallesSucia).length > 0 && (
            <p className="text-sm text-gray-600">
              Agua sucia ({etiquetaPeriodo}):{" "}
              {Object.entries(detallesSucia)
                .map(([d, n]) => `${ETIQUETAS[d] ?? d} (${n})`)
                .join(", ")}
            </p>
          )}

          <div>
            <h3 className="mb-2 font-semibold">Comentarios recientes</h3>
            {actual.comentarios.length === 0 ? (
              <p className="text-sm text-gray-500">No hay comentarios en los últimos 7 días.</p>
            ) : (
              <ul className="space-y-2">
                {actual.comentarios.map((c) => (
                  <li key={c.id} className="rounded-lg bg-gray-50 p-2 text-sm">
                    <p className="break-words">“{c.texto}”</p>
                    <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                      <span>
                        {ETIQUETAS[c.estado]} · {haceCuanto(c.creado_en)}
                      </span>
                      <BotonDenunciar tipo="agua" id={c.id} onAviso={onAviso} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="text-xs text-gray-400">Percepción de vecinos; no es un análisis oficial ni de laboratorio.</p>
        </div>
      )}
    </HojaInferior>
  );
}
