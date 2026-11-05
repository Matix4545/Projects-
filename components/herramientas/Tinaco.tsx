"use client";

import Link from "next/link";
import { useState } from "react";
import { CAPACIDADES, CONSUMOS, NIVELES, diasDeAgua, textoDias, type Consumo } from "@/lib/herramientas/tinaco";

/** Calculadora del tinaco: todo se calcula aquí, nada se envía */
export function Tinaco() {
  const [capacidad, setCapacidad] = useState(1100);
  const [nivel, setNivel] = useState(1);
  const [personas, setPersonas] = useState(4);
  const [consumo, setConsumo] = useState<Consumo>("cuidando");

  const litros = capacidad * nivel;
  const elegido = CONSUMOS.find((c) => c.id === consumo) ?? CONSUMOS[1];
  const dias = diasDeAgua(litros, personas, elegido.litros);

  return (
    <div className="space-y-6">
      <section>
        <h2 className="titulo-grupo">Tu tinaco o cisterna</h2>
        <div className="space-y-4 rounded-2xl bg-white px-4 py-4">
          <div>
            <label htmlFor="capacidad" className="text-[15px] font-medium">
              Capacidad (litros)
            </label>
            <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Tamaños comunes">
              {CAPACIDADES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={capacidad === c ? "chip" : "chip bg-ios-relleno"}
                  aria-pressed={capacidad === c}
                  onClick={() => setCapacidad(c)}
                >
                  {c.toLocaleString("es-MX")} L
                </button>
              ))}
            </div>
            <input
              id="capacidad"
              type="number"
              inputMode="numeric"
              min={1}
              max={100000}
              value={capacidad || ""}
              onChange={(e) => setCapacidad(Math.max(0, Math.min(100000, Number(e.target.value) || 0)))}
              className="campo mt-2"
            />
          </div>
          <div>
            <p className="text-[15px] font-medium">¿Qué tan lleno está?</p>
            <div className="segmentado mt-2" role="group" aria-label="Nivel del tinaco">
              {NIVELES.map((n) => (
                <button key={n.nombre} type="button" aria-pressed={nivel === n.fraccion} onClick={() => setNivel(n.fraccion)}>
                  {n.nombre}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="personas" className="text-[15px] font-medium">
              Personas en tu casa
            </label>
            <div className="flex items-center gap-2">
              <button type="button" className="cerrar text-[20px] !text-ios-azul" aria-label="Una persona menos" onClick={() => setPersonas((p) => Math.max(1, p - 1))}>
                −
              </button>
              <input
                id="personas"
                type="number"
                inputMode="numeric"
                min={1}
                max={30}
                value={personas}
                onChange={(e) => setPersonas(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
                className="campo w-16 text-center"
              />
              <button type="button" className="cerrar text-[20px] !text-ios-azul" aria-label="Una persona más" onClick={() => setPersonas((p) => Math.min(30, p + 1))}>
                +
              </button>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="titulo-grupo">¿Cómo la van a usar?</h2>
        <div className="grupo">
          {CONSUMOS.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-start gap-3 px-4 py-3">
              <input type="radio" name="consumo" checked={consumo === c.id} onChange={() => setConsumo(c.id)} className="mt-1 h-5 w-5 accent-[#007aff]" />
              <span>
                <span className="block text-[16px] font-medium">
                  {c.nombre} <span className="font-normal text-ios-secundario">· {c.litros} L por persona al día</span>
                </span>
                <span className="block text-[14px] text-ios-secundario">{c.nota}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-3xl bg-white px-5 py-6 text-center" aria-live="polite">
        <p className="text-[15px] text-ios-secundario">Con {Math.round(litros).toLocaleString("es-MX")} litros te alcanza para</p>
        <p className="mt-1 text-[44px] font-bold leading-tight tracking-tight">{textoDias(dias)}</p>
        <p className="mt-1 text-[15px] text-ios-secundario">
          {personas} {personas === 1 ? "persona" : "personas"}, {elegido.nombre.toLowerCase()}
        </p>
        <ul className="mt-4 grid grid-cols-3 gap-2 text-[13px]">
          {CONSUMOS.map((c) => (
            <li key={c.id} className={`rounded-xl px-2 py-2 ${c.id === consumo ? "bg-ios-azul/10 text-ios-azul" : "bg-ios-fondo"}`}>
              <span className="block font-semibold">{textoDias(diasDeAgua(litros, personas, c.litros))}</span>
              <span className="block text-ios-secundario">{c.nombre}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="px-1 text-[14px] leading-relaxed text-ios-secundario">
        Es un estimado. El consumo real depende del calor, de si hay lavadora o jardín, y de las fugas. ¿Tu colonia está sin
        agua? <Link href="/colonias" className="text-ios-azul">Mira cómo está el agua por colonia</Link>.
      </div>
    </div>
  );
}
