"use client";

import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";

type Turnstile = {
  render: (el: HTMLElement, opciones: Record<string, unknown>) => string;
  execute: (id: string) => void;
  reset: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const ContextoTurnstile = createContext<() => Promise<string>>(() => Promise.reject(new Error("Sin Turnstile")));

/** Pide un token nuevo de Turnstile antes de cada envío. */
export function useTurnstile() {
  return useContext(ContextoTurnstile);
}

/**
 * Carga Cloudflare Turnstile una sola vez. El widget es invisible y solo
 * aparece si Cloudflare necesita que la persona toque la casilla.
 */
export function ProveedorTurnstile({ children }: { children: ReactNode }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const pendiente = useRef<{ resolver: (t: string) => void; rechazar: (e: Error) => void } | null>(null);
  const listo = useRef<Promise<void> | null>(null);

  useEffect(() => {
    const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!sitekey) {
      console.error("Falta NEXT_PUBLIC_TURNSTILE_SITE_KEY");
      return;
    }
    listo.current = new Promise<void>((resolver, rechazar) => {
      const montar = () => {
        if (!window.turnstile || !contenedor.current || widgetId.current) return resolver();
        widgetId.current = window.turnstile.render(contenedor.current, {
          sitekey,
          execution: "execute",
          appearance: "interaction-only",
          language: "es",
          callback: (token: string) => {
            pendiente.current?.resolver(token);
            pendiente.current = null;
          },
          "error-callback": () => {
            pendiente.current?.rechazar(new Error("Turnstile falló"));
            pendiente.current = null;
          },
        });
        resolver();
      };
      if (window.turnstile) return montar();
      const existente = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`);
      const script = existente ?? document.createElement("script");
      script.addEventListener("load", montar);
      script.addEventListener("error", () => rechazar(new Error("No cargó Turnstile")));
      if (!existente) {
        script.src = SCRIPT;
        script.async = true;
        document.head.appendChild(script);
      }
    });
    listo.current.catch(() => {});
  }, []);

  const obtenerToken = useCallback(async () => {
    if (!listo.current) throw new Error("Turnstile no está configurado");
    await listo.current;
    const id = widgetId.current;
    if (!id || !window.turnstile) throw new Error("Turnstile no está listo");
    pendiente.current?.rechazar(new Error("Reemplazado"));
    return new Promise<string>((resolver, rechazar) => {
      const limite = setTimeout(() => {
        pendiente.current = null;
        rechazar(new Error("Turnstile tardó demasiado"));
      }, 45_000);
      pendiente.current = {
        resolver: (t) => {
          clearTimeout(limite);
          resolver(t);
        },
        rechazar: (e) => {
          clearTimeout(limite);
          rechazar(e);
        },
      };
      window.turnstile!.reset(id);
      window.turnstile!.execute(id);
    });
  }, []);

  return (
    <ContextoTurnstile.Provider value={obtenerToken}>
      {children}
      <div ref={contenedor} className="fixed left-1/2 top-1/3 z-[3000] -translate-x-1/2" />
    </ContextoTurnstile.Provider>
  );
}
