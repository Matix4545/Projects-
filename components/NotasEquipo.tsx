"use client";

import { useEffect, useState } from "react";
import { horaLocal } from "@/lib/tiempo";

type Nota = { id: number; texto: string; autor: string | null; creado_en: string };

const MAX_NOTA = 500;

/** Notas privadas del equipo sobre un reporte. El público nunca las ve (las rutas exigen la contraseña). */
export function NotasEquipo({ pinId }: { pinId: number }) {
  const [notas, setNotas] = useState<Nota[] | null>(null);
  const [texto, setTexto] = useState("");
  const [autor, setAutor] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setAutor(localStorage.getItem("rc_autor") ?? "");
    } catch {
      /* sin almacenamiento */
    }
    let vigente = true;
    fetch(`/api/equipo/notas?pin=${pinId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => vigente && (d.ok ? setNotas(d.notas) : setError(d.error)))
      .catch(() => vigente && setError("No se pudieron cargar las notas."));
    return () => {
      vigente = false;
    };
  }, [pinId]);

  async function guardar() {
    if (!texto.trim() || guardando) return;
    setGuardando(true);
    setError(null);
    try {
      localStorage.setItem("rc_autor", autor.trim());
    } catch {
      /* no pasa nada */
    }
    try {
      const r = await fetch("/api/equipo/notas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin_id: pinId, texto: texto.trim(), autor: autor.trim() || undefined }),
      }).then((res) => res.json());
      if (r.ok) {
        setNotas((n) => [...(n ?? []), r.nota]);
        setTexto("");
      } else setError(r.error);
    } catch {
      setError("Sin conexión. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(id: number) {
    if (!window.confirm("¿Borrar esta nota?")) return;
    const r = await fetch(`/api/equipo/notas?id=${id}`, { method: "DELETE" })
      .then((res) => res.json())
      .catch(() => ({ ok: false, error: "Sin conexión." }));
    if (r.ok) setNotas((n) => (n ?? []).filter((x) => x.id !== id));
    else setError(r.error);
  }

  return (
    <section className="rounded-xl border border-dashed border-gray-300 p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">🔒 Notas del equipo</h3>
      {notas === null && !error && <p className="mt-2 text-sm text-gray-400">Cargando…</p>}
      {notas?.length === 0 && <p className="mt-2 text-sm text-gray-400">Sin notas todavía.</p>}
      {notas && notas.length > 0 && (
        <ul className="mt-2 space-y-2">
          {notas.map((n) => (
            <li key={n.id} className="text-sm">
              <p className="whitespace-pre-line break-words">{n.texto}</p>
              <p className="flex justify-between text-xs text-gray-400">
                <span>
                  {n.autor ? `${n.autor} · ` : ""}
                  {horaLocal(n.creado_en)}
                </span>
                <button onClick={() => borrar(n.id)} className="underline">
                  Borrar
                </button>
              </p>
            </li>
          ))}
        </ul>
      )}
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value.slice(0, MAX_NOTA))}
        rows={2}
        maxLength={MAX_NOTA}
        placeholder="Ej.: Se reportó a OOMAPASC el 20 oct, folio 1234"
        className="mt-2 w-full rounded-lg border border-gray-300 p-2 text-base"
      />
      <div className="mt-1 flex gap-2">
        <input
          value={autor}
          onChange={(e) => setAutor(e.target.value.slice(0, 40))}
          placeholder="Tu nombre (opcional)"
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
        />
        <button
          onClick={guardar}
          disabled={!texto.trim() || guardando}
          className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {guardando ? "Guardando…" : "Guardar nota"}
        </button>
      </div>
      {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
    </section>
  );
}
