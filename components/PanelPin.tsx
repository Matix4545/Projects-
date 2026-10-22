"use client";

import { useState } from "react";
import { ETIQUETAS, INFO_PIN, esLinea } from "@/lib/constantes";
import { enviar, type Pin } from "@/lib/datos";
import { urlFoto } from "@/lib/supabase/navegador";
import { haceCuanto, horaLocal } from "@/lib/tiempo";
import { BotonDenunciar } from "./BotonDenunciar";
import { HojaInferior } from "./HojaInferior";
import { ERROR_TURNSTILE_NAVEGADOR, useTurnstile } from "./Turnstile";

type Conteos = Pick<Pin, "confirmaciones" | "votos_arreglado" | "estado">;

export function PanelPin({
  pin,
  onCerrar,
  onAviso,
  onCambio,
}: {
  pin: Pin;
  onCerrar: () => void;
  onAviso: (m: string) => void;
  onCambio: () => void;
}) {
  const obtenerToken = useTurnstile();
  const [conteos, setConteos] = useState<Conteos>(pin);
  const [enviando, setEnviando] = useState<null | "confirmo" | "arreglado">(null);
  const arreglado = conteos.estado === "arreglado";
  // Calle cerrada: "ya la abrieron"; calle con baches: "ya la arreglaron"
  const textoArreglo = pin.tipo === "calle_cerrada" ? "Ya la abrieron" : esLinea(pin.tipo) ? "Ya la arreglaron" : "Ya lo arreglaron";

  async function votar(tipo: "confirmo" | "arreglado") {
    setEnviando(tipo);
    try {
      const token = await obtenerToken();
      const r = await enviar<{ pin: Conteos }>(`/api/pins/${pin.id}/voto`, { tipo, token });
      if (r.ok) {
        setConteos(r.pin);
        onAviso(
          tipo === "confirmo"
            ? "¡Gracias por confirmar!"
            : r.pin.estado === "arreglado"
              ? `¡Listo! 3 vecinos confirmaron: ${textoArreglo.toLowerCase()}.`
              : "Gracias. Se marcará cuando lo confirmen 3 vecinos.",
        );
        onCambio();
      } else {
        onAviso(r.error);
      }
    } catch {
      onAviso(ERROR_TURNSTILE_NAVEGADOR);
    } finally {
      setEnviando(null);
    }
  }

  const titulo =
    pin.tipo === "bache"
      ? `Bache ${ETIQUETAS[pin.subtipo]?.toLowerCase()}`
      : pin.tipo === "drenaje" || pin.tipo === "baldio"
        ? (ETIQUETAS[pin.subtipo] ?? pin.subtipo)
        : `${INFO_PIN[pin.tipo]?.nombre ?? pin.tipo}: ${(ETIQUETAS[pin.subtipo] ?? pin.subtipo).toLowerCase()}`;

  return (
    <HojaInferior titulo={titulo} onCerrar={onCerrar}>
      <div className="space-y-3">
        <p className="text-sm text-gray-600">
          {pin.colonia ? `${pin.colonia} · ` : ""}Reportado {haceCuanto(pin.creado_en)} ({horaLocal(pin.creado_en)})
        </p>

        {arreglado && (
          <p className="rounded-lg bg-green-50 p-2 text-sm font-semibold text-green-800">
            ✔ Vecinos confirmaron: {textoArreglo.toLowerCase()}{pin.arreglado_en ? ` (${haceCuanto(pin.arreglado_en)})` : ""}.
          </p>
        )}

        {pin.foto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={urlFoto(pin.foto)} alt={`Foto del reporte: ${titulo}`} loading="lazy" className="max-h-72 w-full rounded-lg bg-gray-100 object-cover" />
        )}
        {pin.foto && (
          <div className="-mt-2 text-right">
            <BotonDenunciar tipo="foto" id={pin.id} onAviso={onAviso} />
          </div>
        )}

        {pin.comentario && (
          <div className="rounded-lg bg-gray-50 p-2 text-sm">
            <p className="break-words">“{pin.comentario}”</p>
            <div className="mt-1 text-right">
              <BotonDenunciar tipo="pin" id={pin.id} onAviso={onAviso} />
            </div>
          </div>
        )}

        <p className="text-sm">
          <strong>{conteos.confirmaciones}</strong> {conteos.confirmaciones === 1 ? "vecino más lo confirmó" : "vecinos más lo confirmaron"}
        </p>

        {!arreglado && (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => votar("confirmo")}
              disabled={enviando !== null}
              className="rounded-xl bg-blue-600 px-3 py-3 font-semibold text-white disabled:opacity-60"
            >
              {enviando === "confirmo" ? "Enviando…" : "+1 Yo también lo vi"}
            </button>
            <button
              onClick={() => votar("arreglado")}
              disabled={enviando !== null}
              className="rounded-xl bg-green-600 px-3 py-3 font-semibold text-white disabled:opacity-60"
            >
              {enviando === "arreglado" ? "Enviando…" : `${textoArreglo} (${conteos.votos_arreglado}/3)`}
            </button>
          </div>
        )}
      </div>
    </HojaInferior>
  );
}
