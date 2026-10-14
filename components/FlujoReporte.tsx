"use client";

import { useEffect, useRef, useState } from "react";
import {
  COLOR_ESTADO,
  COLOR_PIN,
  DETALLES_SUCIA,
  ETIQUETAS,
  MAX_COMENTARIO,
  TAMANOS_BACHE,
  TIPOS_DRENAJE,
  type DetalleSucia,
  type EstadoAgua,
  type TipoPin,
} from "@/lib/constantes";
import { enviar, zonaDePunto } from "@/lib/datos";
import { HojaInferior } from "./HojaInferior";
import { ERROR_TURNSTILE_NAVEGADOR, useTurnstile } from "./Turnstile";

export type OrigenUbicacion = "buscando" | "gps" | "mapa" | "sin_gps" | "fuera" | "impreciso";
type Paso = "tipo" | "agua" | TipoPin;

type Props = {
  ubicacion: [number, number] | null;
  origen: OrigenUbicacion;
  onCerrar: () => void;
  onEnviado: (mensaje: string) => void;
};

const TITULOS: Record<Paso, string> = {
  tipo: "¿Qué quieres reportar?",
  agua: "¿Cómo está el agua?",
  bache: "¿De qué tamaño es el bache?",
  drenaje: "¿Qué problema de drenaje?",
};

export function FlujoReporte({ ubicacion, origen, onCerrar, onEnviado }: Props) {
  const obtenerToken = useTurnstile();
  const [paso, setPaso] = useState<Paso>("tipo");
  const [comentario, setComentario] = useState("");
  const [verComentario, setVerComentario] = useState(false);
  const [detalles, setDetalles] = useState<DetalleSucia[]>([]);
  const [eligiendoSucia, setEligiendoSucia] = useState(false);
  const [foto, setFoto] = useState<File | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
  const [comprimiendo, setComprimiendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [colonia, setColonia] = useState<{ id: number; nombre: string } | null | "buscando">(null);
  const entradaFoto = useRef<HTMLInputElement>(null);

  // Para agua: mostrar en qué colonia cae la ubicación
  useEffect(() => {
    if (paso !== "agua" || !ubicacion) return;
    let vigente = true;
    setColonia("buscando");
    zonaDePunto(ubicacion[0], ubicacion[1])
      .then((z) => vigente && setColonia(z))
      .catch(() => vigente && setColonia(null));
    return () => {
      vigente = false;
    };
  }, [paso, ubicacion]);

  useEffect(() => () => {
    if (vistaPrevia) URL.revokeObjectURL(vistaPrevia);
  }, [vistaPrevia]);

  async function elegirFoto(archivo: File | undefined) {
    if (!archivo) return;
    setError(null);
    setComprimiendo(true);
    try {
      const { default: comprimir } = await import("browser-image-compression");
      const comprimida = await comprimir(archivo, {
        maxSizeMB: 0.9,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
        fileType: "image/jpeg",
        initialQuality: 0.8,
        preserveExif: false,
      });
      setFoto(new File([comprimida], "foto.jpg", { type: "image/jpeg" }));
      setVistaPrevia(URL.createObjectURL(comprimida));
    } catch {
      setError("No se pudo procesar la foto. Intenta con otra.");
    } finally {
      setComprimiendo(false);
    }
  }

  function quitarFoto() {
    setFoto(null);
    setVistaPrevia(null);
    if (entradaFoto.current) entradaFoto.current.value = "";
  }

  const sinUbicacion = !ubicacion;
  const coloniaInvalida = paso === "agua" && (colonia === null || colonia === "buscando");
  const bloqueado = enviando || comprimiendo || sinUbicacion || coloniaInvalida;

  async function enviarReporte(subtipo: string) {
    if (!ubicacion || bloqueado) return;
    setError(null);
    setEnviando(true);
    try {
      let token: string;
      try {
        token = await obtenerToken();
      } catch {
        setError(ERROR_TURNSTILE_NAVEGADOR);
        return;
      }
      const [lat, lng] = ubicacion;
      const r =
        paso === "agua"
          ? await enviar<{ zona: { nombre: string } }>("/api/reportes/agua", {
              estado: subtipo,
              detalles: subtipo === "sucia" ? detalles : [],
              comentario: comentario.trim() || null,
              lat,
              lng,
              token,
            })
          : await enviar("/api/reportes/pin", armarFormulario(paso as TipoPin, subtipo, lat, lng, comentario, foto, token));
      if (r.ok) {
        onEnviado(paso === "agua" ? "¡Gracias! Tu reporte de agua se registró." : "¡Gracias! Tu reporte ya aparece en el mapa.");
      } else {
        setError(r.error);
      }
    } finally {
      setEnviando(false);
    }
  }

  const textoUbicacion = (() => {
    if (origen === "buscando" && !ubicacion) return "Buscando tu ubicación…";
    if (!ubicacion && origen === "fuera") return "Parece que no estás en Cajeme. Toca el mapa donde está el problema.";
    if (!ubicacion && origen === "impreciso") return "Tu ubicación es poco precisa. Toca el mapa justo donde está el problema.";
    if (!ubicacion) return "Toca el mapa donde está el problema.";
    const base = origen === "gps" ? "Usando tu ubicación actual" : "Ubicación elegida en el mapa";
    if (paso !== "agua") return `${base}. Toca o arrastra el marcador para ajustar.`;
    if (colonia === "buscando") return `${base} · buscando colonia…`;
    if (!colonia) return "Ese punto no está en una colonia registrada. Toca el mapa dentro de tu colonia.";
    return `${base}: ${colonia.nombre}. Toca el mapa para cambiarla.`;
  })();

  return (
    <HojaInferior
      compacta
      onCerrar={onCerrar}
      titulo={
        <span className="flex items-center gap-2">
          {paso !== "tipo" && (
            <button
              onClick={() => {
                setPaso("tipo");
                setError(null);
                setEligiendoSucia(false);
              }}
              aria-label="Regresar"
              className="-ml-2 grid h-9 w-9 place-items-center rounded-full text-xl hover:bg-gray-100"
            >
              ‹
            </button>
          )}
          {TITULOS[paso]}
        </span>
      }
    >
      {paso === "tipo" ? (
        <div className="grid grid-cols-3 gap-2">
          <BotonTipo emoji="💧" texto="Agua" color="#2563eb" onClick={() => setPaso("agua")} />
          <BotonTipo emoji="🕳️" texto="Bache" color={COLOR_PIN.bache} onClick={() => setPaso("bache")} />
          <BotonTipo emoji="🚧" texto="Drenaje" color={COLOR_PIN.drenaje} onClick={() => setPaso("drenaje")} />
        </div>
      ) : (
        <div className="space-y-3">
          <p
            className={`rounded-lg px-3 py-2 text-sm ${
              sinUbicacion || (paso === "agua" && colonia === null) ? "bg-amber-50 text-amber-900" : "bg-blue-50 text-blue-900"
            }`}
          >
            📍 {textoUbicacion}
          </p>

          {paso !== "agua" && (
            <div className="flex items-center gap-3">
              <input
                ref={entradaFoto}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => elegirFoto(e.target.files?.[0])}
              />
              {vistaPrevia ? (
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={vistaPrevia} alt="Vista previa" className="h-14 w-14 rounded-lg object-cover" />
                  <button onClick={quitarFoto} className="text-sm text-red-600 underline">
                    Quitar foto
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => entradaFoto.current?.click()}
                  disabled={comprimiendo}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  {comprimiendo ? "Procesando foto…" : "📷 Agregar foto (opcional)"}
                </button>
              )}
            </div>
          )}

          {verComentario ? (
            <div>
              <textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value.slice(0, MAX_COMENTARIO))}
                rows={2}
                maxLength={MAX_COMENTARIO}
                placeholder="Comentario opcional (sin nombres, teléfonos ni direcciones exactas)"
                className="w-full rounded-lg border border-gray-300 p-2 text-base"
              />
              <div className="text-right text-xs text-gray-400">
                {comentario.length}/{MAX_COMENTARIO}
              </div>
            </div>
          ) : (
            <button onClick={() => setVerComentario(true)} className="text-sm text-blue-700 underline">
              + Agregar comentario (opcional)
            </button>
          )}

          {paso === "agua" && !eligiendoSucia && (
            <>
              <p className="text-xs text-gray-500">Toca una opción para enviar:</p>
              <div className="grid grid-cols-2 gap-2">
                {(["sin_agua", "baja_presion", "sucia", "con_agua"] as EstadoAgua[]).map((e) => (
                  <BotonOpcion
                    key={e}
                    texto={ETIQUETAS[e]}
                    color={COLOR_ESTADO[e]}
                    disabled={bloqueado}
                    onClick={() => (e === "sucia" ? setEligiendoSucia(true) : enviarReporte(e))}
                  />
                ))}
              </div>
            </>
          )}

          {paso === "agua" && eligiendoSucia && (
            <>
              <p className="text-sm text-gray-700">¿Qué notas en el agua? (opcional, puedes elegir varias)</p>
              <div className="flex flex-wrap gap-2">
                {DETALLES_SUCIA.map((d) => {
                  const activo = detalles.includes(d);
                  return (
                    <button
                      key={d}
                      onClick={() => setDetalles(activo ? detalles.filter((x) => x !== d) : [...detalles, d])}
                      aria-pressed={activo}
                      className={`rounded-full border px-3 py-2 text-sm ${
                        activo ? "border-purple-700 bg-purple-700 text-white" : "border-gray-300 bg-white"
                      }`}
                    >
                      {ETIQUETAS[d]}
                    </button>
                  );
                })}
              </div>
              <BotonOpcion texto="Enviar: agua sucia" color={COLOR_ESTADO.sucia} disabled={bloqueado} onClick={() => enviarReporte("sucia")} />
            </>
          )}

          {paso === "bache" && (
            <>
              <p className="text-xs text-gray-500">Toca el tamaño para enviar:</p>
              <div className="grid grid-cols-2 gap-2">
                {TAMANOS_BACHE.map((t) => (
                  <BotonOpcion
                    key={t}
                    texto={t === "peligroso" ? "⚠️ Peligroso" : ETIQUETAS[t]}
                    color={t === "peligroso" ? "#dc2626" : "#374151"}
                    disabled={bloqueado}
                    onClick={() => enviarReporte(t)}
                  />
                ))}
              </div>
            </>
          )}

          {paso === "drenaje" && (
            <>
              <p className="text-xs text-gray-500">Toca el problema para enviar:</p>
              <div className="grid grid-cols-1 gap-2">
                {TIPOS_DRENAJE.map((t) => (
                  <BotonOpcion key={t} texto={ETIQUETAS[t]} color={COLOR_PIN.drenaje} disabled={bloqueado} onClick={() => enviarReporte(t)} />
                ))}
              </div>
            </>
          )}

          {enviando && <p className="text-center text-sm font-semibold text-gray-700">Enviando…</p>}
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}
        </div>
      )}
    </HojaInferior>
  );
}

function armarFormulario(tipo: TipoPin, subtipo: string, lat: number, lng: number, comentario: string, foto: File | null, token: string) {
  const f = new FormData();
  f.set("tipo", tipo);
  f.set("subtipo", subtipo);
  f.set("lat", String(lat));
  f.set("lng", String(lng));
  f.set("token", token);
  if (comentario.trim()) f.set("comentario", comentario.trim());
  if (foto) f.set("foto", foto);
  return f;
}

function BotonTipo({ emoji, texto, color, onClick }: { emoji: string; texto: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 rounded-2xl border-2 bg-white py-4 text-base font-bold text-gray-900 active:scale-95"
      style={{ borderColor: color }}
    >
      <span className="text-3xl" aria-hidden>
        {emoji}
      </span>
      {texto}
    </button>
  );
}

function BotonOpcion({ texto, color, disabled, onClick }: { texto: string; color: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="min-h-14 rounded-xl px-3 py-3 text-base font-bold text-white shadow active:scale-95 disabled:opacity-50"
      style={{ background: color }}
    >
      {texto}
    </button>
  );
}
