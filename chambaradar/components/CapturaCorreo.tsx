"use client";

import { useState } from "react";
import { registrarEvento } from "./Contador";
import { eventoMeta } from "./MetaPixel";

// "Recibe gratis 5 vacantes remotas en dólares cada semana": solo correo.
// Guarda en la tabla suscriptores (POST /api/boletin) y manda "Lead" al píxel.

export function CapturaCorreo({
  origen,
  compacto = false,
  destacado = false,
  id,
  titulo = "Recibe gratis 5 vacantes remotas en dólares cada semana",
}: {
  origen: string;
  compacto?: boolean;
  /** Versión grande para arriba de la landing: es el botón principal para quien llega de un anuncio */
  destacado?: boolean;
  id?: string;
  titulo?: string;
}) {
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
      registrarEvento("correo");
    } catch {
      setEstado("error");
    }
  }

  if (estado === "listo") {
    return (
      <p id={id} className={`rounded-xl bg-radar-claro px-4 py-3 text-sm text-radar-oscuro ${compacto ? "" : "sm:text-base"}`}>
        <strong>Listo.</strong> Cada martes te llegan 5 vacantes remotas en dólares que aceptan gente de México, con empresa y enlace. Revisa tu correo (y la carpeta de
        promociones). Mientras, aquí abajo están las de hoy.
      </p>
    );
  }

  const caja = compacto
    ? "space-y-2"
    : destacado
      ? "space-y-3 rounded-2xl border-2 border-radar bg-white p-4 shadow-[0_8px_30px_rgba(37,99,235,0.12)] sm:p-6"
      : "space-y-3 rounded-2xl border border-borde bg-white p-4 sm:p-5";
  return (
    <form id={id} onSubmit={enviar} className={caja}>
      <p className={compacto ? "text-sm font-semibold" : destacado ? "text-xl font-extrabold leading-snug tracking-tight sm:text-2xl" : "text-base font-bold leading-snug sm:text-lg"}>
        {compacto ? "" : "📬 "}
        {titulo}
      </p>
      {!compacto && (
        <p className="text-sm text-gris">
          {destacado ? "Con empresa y enlace para aplicar, completas. Gratis, sin plan y sin crear cuenta: solo tu correo. Te das de baja con un clic." : "Sin plan y sin crear cuenta. Solo tu correo; te das de baja con un clic."}
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input type="email" name="correo" required autoComplete="email" inputMode="email" placeholder="tu@correo.com" className={`campo text-base ${destacado ? "py-3" : "py-2.5"}`} aria-label="Tu correo" />
        <button className={`boton shrink-0 ${destacado ? "py-3" : "py-2.5"}`} disabled={estado === "enviando"}>
          {estado === "enviando" ? "Guardando…" : "Quiero las 5 gratis"}
        </button>
      </div>
      {estado === "error" && <p className="text-xs text-red-700">No pudimos guardar tu correo. Inténtalo otra vez en un momento.</p>}
    </form>
  );
}
