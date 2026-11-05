"use client";

import { useState } from "react";
import { eventoMeta } from "./MetaPixel";

// "Recibe gratis 5 vacantes remotas en dólares cada semana": solo correo.
// Guarda en la tabla suscriptores (POST /api/boletin) y manda "Lead" al píxel.

export function CapturaCorreo({ origen, compacto = false, titulo = "Recibe gratis 5 vacantes remotas en dólares cada semana" }: { origen: string; compacto?: boolean; titulo?: string }) {
  const [estado, setEstado] = useState<"" | "enviando" | "listo" | "error">("");

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const correo = String(new FormData(e.currentTarget).get("correo") ?? "").trim();
    if (!correo) return;
    setEstado("enviando");
    try {
      const r = await fetch("/api/boletin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ correo, origen }) });
      if (!r.ok) throw new Error(String(r.status));
      setEstado("listo");
      eventoMeta("Lead", { content_name: origen });
    } catch {
      setEstado("error");
    }
  }

  if (estado === "listo") {
    return (
      <p className={`rounded-xl bg-radar-claro px-4 py-3 text-sm text-radar-oscuro ${compacto ? "" : "sm:text-base"}`}>
        <strong>Listo.</strong> Cada semana te llegan 5 vacantes remotas en dólares que aceptan gente de México. Revisa tu correo (y la carpeta de promociones).
      </p>
    );
  }

  return (
    <form onSubmit={enviar} className={compacto ? "space-y-2" : "space-y-3 rounded-2xl border border-borde bg-white p-4 sm:p-5"}>
      <p className={compacto ? "text-sm font-semibold" : "text-base font-bold leading-snug sm:text-lg"}>
        {compacto ? "" : "📬 "}
        {titulo}
      </p>
      {!compacto && <p className="text-sm text-gris">Sin plan y sin crear cuenta. Solo tu correo; te das de baja con un clic.</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input type="email" name="correo" required autoComplete="email" inputMode="email" placeholder="tu@correo.com" className="campo py-2.5 text-base" aria-label="Tu correo" />
        <button className="boton shrink-0 py-2.5" disabled={estado === "enviando"}>
          {estado === "enviando" ? "Guardando…" : "Quiero las 5 gratis"}
        </button>
      </div>
      {estado === "error" && <p className="text-xs text-red-700">No pudimos guardar tu correo. Inténtalo otra vez en un momento.</p>}
    </form>
  );
}
