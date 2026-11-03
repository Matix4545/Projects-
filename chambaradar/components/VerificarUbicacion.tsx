"use client";

import { useState } from "react";

type Estado = "" | "buscando" | "fuera" | "negado" | "error";

const MENSAJE: Record<Exclude<Estado, "" | "buscando">, string> = {
  fuera: "Tu ubicación no está en Sonora. El acceso gratis es solo para Sonora.",
  negado: "No diste permiso de ubicación. Actívalo en tu navegador y vuelve a intentar.",
  error: "No pudimos leer tu ubicación. Intenta de nuevo con el GPS encendido.",
};

/**
 * Botón "¿Vives en Sonora?": pide la ubicación del GPS y, si está en Sonora,
 * el servidor da acceso gratis por 30 días. No se guardan las coordenadas.
 */
export function VerificarUbicacion({ compacto = false }: { compacto?: boolean }) {
  const [estado, setEstado] = useState<Estado>("");

  const verificar = () => {
    if (!navigator.geolocation) return setEstado("error");
    setEstado("buscando");
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        try {
          const r = await fetch("/api/ubicacion", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ lat: p.coords.latitude, lon: p.coords.longitude, precision: p.coords.accuracy }),
          });
          const d = (await r.json()) as { ok: boolean; motivo?: string };
          if (d.ok) location.reload();
          else setEstado(d.motivo === "fuera" ? "fuera" : "error");
        } catch {
          setEstado("error");
        }
      },
      (e) => setEstado(e.code === e.PERMISSION_DENIED ? "negado" : "error"),
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 600_000 },
    );
  };

  return (
    <div className={compacto ? "space-y-2" : "space-y-2 rounded-2xl border border-radar/30 bg-radar-claro/60 px-4 py-3 sm:px-5"}>
      {!compacto && (
        <p className="text-sm text-radar-oscuro">
          <strong>¿Vives en Sonora?</strong> Para ti todo es gratis. Si tu internet de casa aparece como de otro estado, verifica tu ubicación una vez.
        </p>
      )}
      <button type="button" onClick={verificar} disabled={estado === "buscando"} className="boton-secundario w-full px-4 py-2 text-sm sm:w-auto">
        {estado === "buscando" ? "Verificando…" : "📍 Verificar que estoy en Sonora"}
      </button>
      {estado && estado !== "buscando" && <p className="text-xs text-gris">{MENSAJE[estado]}</p>}
      <p className="text-xs text-gris">Usamos tu ubicación solo para esto y no la guardamos.</p>
    </div>
  );
}
