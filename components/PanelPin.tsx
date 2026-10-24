"use client";

import { useState } from "react";
import { esLinea, tituloReporte } from "@/lib/constantes";
import { enviar, type Pin } from "@/lib/datos";
import { urlFoto } from "@/lib/supabase/navegador";
import { haceCuanto, horaLocal } from "@/lib/tiempo";
import { folio } from "@/lib/urgencia";
import { BadgeDias } from "./BadgeDias";
import { BotonDenunciar } from "./BotonDenunciar";
import { HojaInferior } from "./HojaInferior";
import { NotasEquipo } from "./NotasEquipo";
import { ERROR_TURNSTILE_NAVEGADOR, useTurnstile } from "./Turnstile";

type Conteos = Pick<Pin, "confirmaciones" | "votos_arreglado" | "estado">;

export function PanelPin({
  pin,
  equipo,
  onCerrar,
  onAviso,
  onCambio,
}: {
  pin: Pin;
  /** Modo equipo: días sin resolver, folio y notas privadas */
  equipo: boolean;
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

  const titulo = tituloReporte(pin);

  return (
    <HojaInferior titulo={titulo} onCerrar={onCerrar}>
      <div className="space-y-3">
        {/* Equipo: una sola línea de contexto, porque la etiqueta ya dice cuántos días lleva */}
        {equipo ? (
        <div className="space-y-1">
          <BadgeDias
            pin={{ ...pin, estado: conteos.estado, arreglado_en: pin.arreglado_en ?? (arreglado ? new Date().toISOString() : null) }}
          />
          <p className="text-[15px] text-ios-secundario">
            {[pin.colonia, horaLocal(pin.creado_en), conteos.confirmaciones > 0 ? `+${conteos.confirmaciones} lo confirman` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        ) : (
          <>
            <p className="text-[15px] text-ios-secundario">
              {pin.colonia ? `${pin.colonia} · ` : ""}Reportado {haceCuanto(pin.creado_en)} ({horaLocal(pin.creado_en)})
            </p>
            {arreglado && (
              <p className="rounded-xl bg-ios-verde/12 px-3 py-2.5 text-[15px] font-medium text-[#248a3d]">
                ✔ Vecinos confirmaron: {textoArreglo.toLowerCase()}
                {pin.arreglado_en ? ` (${haceCuanto(pin.arreglado_en)})` : ""}.
              </p>
            )}
          </>
        )}

        {pin.foto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={urlFoto(pin.foto)} alt={`Foto del reporte: ${titulo}`} loading="lazy" className="max-h-72 w-full rounded-2xl bg-ios-relleno object-cover" />
        )}
        {pin.foto && (
          <div className="-mt-2 text-right">
            <BotonDenunciar tipo="foto" id={pin.id} onAviso={onAviso} />
          </div>
        )}

        {pin.comentario && (
          <div className="rounded-2xl bg-ios-fondo px-4 py-3 text-[15px]">
            <p className="break-words">“{pin.comentario}”</p>
            <div className="mt-1 text-right">
              <BotonDenunciar tipo="pin" id={pin.id} onAviso={onAviso} />
            </div>
          </div>
        )}

        {!equipo && (
          <p className="text-[15px] text-ios-secundario">
            <strong className="font-semibold text-ios-etiqueta">{conteos.confirmaciones}</strong>{" "}
            {conteos.confirmaciones === 1 ? "vecino más lo confirmó" : "vecinos más lo confirmaron"}
          </p>
        )}

        {!arreglado && (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => votar("confirmo")}
              disabled={enviando !== null}
              className="boton boton-principal px-3 text-[16px]"
            >
              {enviando === "confirmo" ? "Enviando…" : "Yo también lo vi"}
            </button>
            <button
              onClick={() => votar("arreglado")}
              disabled={enviando !== null}
              className="boton bg-ios-verde/15 px-3 text-[16px] text-[#248a3d]"
            >
              {enviando === "arreglado" ? "Enviando…" : `${textoArreglo} (${conteos.votos_arreglado}/3)`}
            </button>
          </div>
        )}
        {equipo && <NotasEquipo pinId={pin.id} />}
        {equipo && <p className="text-center font-mono text-xs text-ios-terciario">Folio {folio(pin.id)}</p>}
      </div>
    </HojaInferior>
  );
}
