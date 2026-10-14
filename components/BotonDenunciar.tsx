"use client";

import { useState } from "react";
import { enviar } from "@/lib/datos";
import { ERROR_TURNSTILE_NAVEGADOR, useTurnstile } from "./Turnstile";

export function BotonDenunciar({ tipo, id, onAviso }: { tipo: "agua" | "pin"; id: number; onAviso: (m: string) => void }) {
  const obtenerToken = useTurnstile();
  const [estado, setEstado] = useState<"listo" | "enviando" | "hecho">("listo");

  async function denunciar() {
    if (!window.confirm("¿Denunciar este comentario por ofensivo, falso o con datos personales?")) return;
    setEstado("enviando");
    let token = "";
    try {
      token = await obtenerToken();
    } catch {
      setEstado("listo");
      return onAviso(ERROR_TURNSTILE_NAVEGADOR);
    }
    const r = await enviar("/api/denuncias", { tipo, id, token });
    setEstado(r.ok ? "hecho" : "listo");
    onAviso(r.ok ? "Gracias. Con 3 denuncias el comentario se oculta." : r.error);
  }

  if (estado === "hecho") return <span className="text-xs text-gray-400">Denunciado</span>;
  return (
    <button onClick={denunciar} disabled={estado === "enviando"} className="text-xs text-gray-500 underline disabled:opacity-50">
      Denunciar
    </button>
  );
}
