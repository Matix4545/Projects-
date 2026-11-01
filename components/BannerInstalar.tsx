"use client";

import { useEffect, useState } from "react";
import { Equis, HojaInferior } from "./HojaInferior";

type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const CERRADO = "rc_instalar_cerrado";
const VISITAS = "rc_visitas";
const TREINTA_DIAS = 30 * 86_400_000;

/**
 * Invita a instalar la página como app. Android/Chrome: botón "Instalar" (aviso nativo).
 * iPhone (Safari no lo permite automático): instrucciones de 2 pasos.
 * Solo desde la segunda visita, nunca si ya está instalada, y si la cierran no vuelve en 30 días.
 */
export function BannerInstalar({ oculto }: { oculto: boolean }) {
  const [tipo, setTipo] = useState<null | "android" | "ios">(null);
  const [evento, setEvento] = useState<EventoInstalar | null>(null);
  const [instrucciones, setInstrucciones] = useState(false);

  useEffect(() => {
    const instalada =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (instalada) return;
    let visitas = 0;
    try {
      if (Date.now() - Number(localStorage.getItem(CERRADO) ?? 0) < TREINTA_DIAS) return;
      visitas = Number(localStorage.getItem(VISITAS) ?? 0) + 1;
      localStorage.setItem(VISITAS, String(visitas));
    } catch {
      return;
    }
    if (visitas < 2) return;

    const alPoderInstalar = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoInstalar);
      setTipo("android");
    };
    window.addEventListener("beforeinstallprompt", alPoderInstalar);
    const ua = navigator.userAgent;
    const iosSafari = /iphone|ipad|ipod/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
    const reloj = iosSafari ? setTimeout(() => setTipo("ios"), 4000) : undefined;
    return () => {
      window.removeEventListener("beforeinstallprompt", alPoderInstalar);
      clearTimeout(reloj);
    };
  }, []);

  function cerrar() {
    setTipo(null);
    setInstrucciones(false);
    try {
      localStorage.setItem(CERRADO, String(Date.now()));
    } catch {
      /* sin almacenamiento */
    }
  }

  async function instalar() {
    if (tipo === "ios") return setInstrucciones(true);
    if (!evento) return;
    await evento.prompt();
    const { outcome } = await evento.userChoice;
    if (outcome === "accepted") setTipo(null);
  }

  if (!tipo || oculto) return null;
  return (
    <>
      {!instrucciones && (
      <div className="material velo fixed inset-x-3 bottom-[calc(8.5rem+env(safe-area-inset-bottom))] z-[1001] mx-auto flex max-w-lg items-center gap-3 rounded-[18px] py-2.5 pl-2.5 pr-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icono-192.png" alt="" className="h-11 w-11 shrink-0 rounded-[11px]" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-[15px] font-semibold">Instala Reporta Cajeme</p>
          <p className="text-[13px] text-ios-secundario">Gratis, sin tienda de apps</p>
        </div>
        <button onClick={instalar} className="h-8 shrink-0 rounded-full bg-ios-azul px-4 text-[15px] font-semibold text-white">
          {tipo === "ios" ? "Cómo" : "Instalar"}
        </button>
        <button onClick={cerrar} aria-label="Ahora no" className="cerrar">
          <Equis />
        </button>
      </div>
      )}
      {instrucciones && (
        <HojaInferior titulo="Agrégala a tu inicio" onCerrar={cerrar} compacta>
          <ol className="space-y-4 pb-2 text-[16px]">
            <li className="flex items-center gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ios-azul text-[14px] font-semibold text-white">1</span>
              <span>
                Toca{" "}
                <span className="inline-flex translate-y-[3px] text-ios-azul" aria-label="Compartir">
                  <svg width="18" height="22" viewBox="0 0 16 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 13V1.5M4 5l4-3.5L12 5" />
                    <path d="M4.5 8H3a1.5 1.5 0 0 0-1.5 1.5v7A1.5 1.5 0 0 0 3 18h10a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 13 8h-1.5" />
                  </svg>
                </span>{" "}
                <strong className="font-semibold">Compartir</strong> en la barra de Safari.
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ios-azul text-[14px] font-semibold text-white">2</span>
              <span>
                Elige <strong className="font-semibold">Agregar a inicio</strong> y luego <strong className="font-semibold">Agregar</strong>.
              </span>
            </li>
          </ol>
          <p className="text-[13px] text-ios-secundario">Aparecerá el ícono de Reporta Cajeme junto a tus apps.</p>
        </HojaInferior>
      )}
    </>
  );
}
