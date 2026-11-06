"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

// Contador de visitas propio (sin cookies). Avisa al servidor de cada página
// vista y de cada clic en un elemento con data-evento ("aplicar", "aplicar_bloqueada").

let primera = true;

function enviar(datos: Record<string, string | undefined>) {
  try {
    const cuerpo = JSON.stringify(datos);
    if (!navigator.sendBeacon?.("/api/evento", new Blob([cuerpo], { type: "application/json" }))) {
      void fetch("/api/evento", { method: "POST", body: cuerpo, keepalive: true, headers: { "content-type": "application/json" } });
    }
  } catch {
    /* el contador nunca debe romper la página */
  }
}

export function Contador() {
  const ruta = usePathname();
  const params = useSearchParams();
  const consulta = params.toString();

  useEffect(() => {
    // La primera vista guarda de dónde llegó la persona; las siguientes son navegación interna
    // La campaña del anuncio (utm_source/utm_campaign) solo cuenta en la primera vista
    const utm = primera ? [params.get("utm_source"), params.get("utm_campaign")].filter(Boolean).join("/") : "";
    enviar({ tipo: "vista", ruta: `${ruta}${consulta ? `?${consulta}` : ""}`, ref: primera ? document.referrer : location.origin, campana: utm || undefined });
    primera = false;
  }, [ruta, consulta]);

  useEffect(() => {
    const alClic = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-evento]");
      if (!el) return;
      enviar({ tipo: el.dataset.evento, ruta: `${location.pathname}${location.search}`, vacante: el.dataset.vacante, empresa: el.dataset.empresa });
    };
    document.addEventListener("click", alClic, true);
    return () => document.removeEventListener("click", alClic, true);
  }, []);

  return null;
}
