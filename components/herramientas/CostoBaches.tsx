"use client";

import { useState } from "react";
import { ESTADOS_CALLE, PORCENTAJES, costoAnual, pesos, type EstadoCalle } from "@/lib/herramientas/costo";

/** Calculadora del costo de los baches para un auto: todo se calcula aquí, nada se envía */
export function CostoBaches() {
  const [kmSemana, setKmSemana] = useState(120);
  const [pct, setPct] = useState(50);
  const [estado, setEstado] = useState<EstadoCalle>("malas");
  const r = costoAnual(kmSemana, pct, estado);
  const { bajo, medio, alto } = r.porEscenario;

  return (
    <div className="space-y-6">
      <section>
        <h2 className="titulo-grupo">Cómo manejas</h2>
        <div className="space-y-5 rounded-2xl bg-white px-4 py-4">
          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="km" className="text-[15px] font-medium">
                Kilómetros por semana
              </label>
              <span className="text-[17px] font-semibold tabular-nums">{kmSemana} km</span>
            </div>
            <input
              id="km"
              type="range"
              min={10}
              max={1000}
              step={10}
              value={kmSemana}
              onChange={(e) => setKmSemana(Number(e.target.value))}
              className="mt-2 w-full accent-[#007aff]"
            />
            <p className="mt-1 text-[13px] text-ios-secundario">Ir y volver del trabajo 10 km, 5 días: unos 100 km por semana.</p>
          </div>
          <div>
            <p className="text-[15px] font-medium">¿Qué parte de tu recorrido es por calles en mal estado?</p>
            <div className="segmentado mt-2" role="group" aria-label="Parte del recorrido en mal estado">
              {PORCENTAJES.map((p) => (
                <button key={p} type="button" aria-pressed={pct === p} onClick={() => setPct(p)}>
                  {p === 100 ? "Todo" : `${p}%`}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="titulo-grupo">¿Cómo están esas calles?</h2>
        <div className="grupo">
          {ESTADOS_CALLE.map((e) => (
            <label key={e.id} className="flex cursor-pointer items-center gap-3 px-4 py-3">
              <input type="radio" name="estado" checked={estado === e.id} onChange={() => setEstado(e.id)} className="h-5 w-5 accent-[#007aff]" />
              <span className="text-[16px]">{e.nombre}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-3xl bg-white px-5 py-6 text-center" aria-live="polite">
        <p className="text-[15px] text-ios-secundario">Pagas de más, al año, más o menos</p>
        <p className="mt-1 text-[48px] font-bold leading-tight tracking-tight tabular-nums">{pesos(medio.total)}</p>
        <p className="mt-1 text-[15px] text-ios-secundario">
          Rango: {pesos(bajo.total)} a {pesos(alto.total)} · {Math.round(r.kmMalosAnio).toLocaleString("es-MX")} km al año en calles malas
        </p>
        <ul className="mt-5 space-y-2 text-left text-[15px]">
          {(
            [
              ["Reparaciones y suspensión", medio.reparaciones],
              ["Gasolina", medio.gasolina],
              ["Llantas", medio.llantas],
            ] as const
          ).map(([nombre, valor]) => (
            <li key={nombre} className="flex justify-between border-t-[0.5px] border-ios-separador pt-2">
              <span>{nombre}</span>
              <span className="font-semibold tabular-nums">{pesos(valor)}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="px-1 text-[13px] leading-relaxed text-ios-secundario">
        Estimación preliminar con un método simplificado del modelo HDM-4 del Banco Mundial: el costo extra de manejar crece con
        la rugosidad de la calle (IRI). No incluye ponchaduras ni golpes fuertes, que pueden costar mucho más de una sola vez.
        Los supuestos están publicados en el código del proyecto (lib/economia.ts).
      </p>
    </div>
  );
}
