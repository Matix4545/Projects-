"use client";

import { useEffect, useRef, useState } from "react";
import {
  COLOR_ESTADO,
  DETALLES_SUCIA,
  ETIQUETAS,
  INFO_PIN,
  MAX_COMENTARIO,
  SUBTIPOS,
  SUBTIPOS_PELIGROSOS,
  TIPOS_PIN,
  esLinea,
  type DetalleSucia,
  type EstadoAgua,
  type TipoPin,
} from "@/lib/constantes";
import { enviar, zonaDePunto } from "@/lib/datos";
import { largoM, puntoMedio } from "@/lib/tramos";
import { HojaInferior } from "./HojaInferior";
import { ERROR_TURNSTILE_NAVEGADOR, useTurnstile } from "./Turnstile";

export type OrigenUbicacion = "buscando" | "gps" | "mapa" | "sin_gps" | "fuera" | "impreciso";
type Paso = "tipo" | "agua" | TipoPin;

/** Calle cerrada / con baches: cuántos extremos se han tocado y el tramo resultante */
export type EstadoTramo = {
  extremos: number;
  puntos: [number, number][] | null;
  ajustada: boolean;
  buscando: boolean;
  error: string | null;
};

type Props = {
  ubicacion: [number, number] | null;
  origen: OrigenUbicacion;
  tramo: EstadoTramo;
  onModoLinea: (linea: boolean) => void;
  /** "agua" cuando se abre desde el panel de una colonia */
  pasoInicial?: "tipo" | "agua";
  onCerrar: () => void;
  onEnviado: (mensaje: string) => void;
};

const TITULOS: Record<Paso, string> = {
  tipo: "¿Qué quieres reportar?",
  agua: "¿Cómo está el agua?",
  ...(Object.fromEntries(TIPOS_PIN.map((t) => [t, INFO_PIN[t].pregunta])) as Record<TipoPin, string>),
};

export function FlujoReporte({ ubicacion, origen, tramo, onModoLinea, pasoInicial = "tipo", onCerrar, onEnviado }: Props) {
  const obtenerToken = useTurnstile();
  const [paso, setPaso] = useState<Paso>(pasoInicial);
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
        maxWidthOrHeight: 1280,
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

  const linea = paso !== "tipo" && paso !== "agua" && esLinea(paso);
  const sinUbicacion = linea ? !tramo.puntos : !ubicacion;

  function irA(nuevo: Paso) {
    setPaso(nuevo);
    setError(null);
    setEligiendoSucia(false);
    onModoLinea(nuevo !== "tipo" && nuevo !== "agua" && esLinea(nuevo));
  }
  const coloniaInvalida = paso === "agua" && (colonia === null || colonia === "buscando");
  const bloqueado = enviando || comprimiendo || sinUbicacion || coloniaInvalida;

  async function enviarReporte(subtipo: string) {
    const punto = linea ? (tramo.puntos ? puntoMedio(tramo.puntos) : null) : ubicacion;
    if (!punto || bloqueado) return;
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
      const [lat, lng] = punto;
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
          : await enviar(
              "/api/reportes/pin",
              armarFormulario(paso as TipoPin, subtipo, lat, lng, comentario, foto, token, linea ? tramo.puntos : null),
            );
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
    if (linea) {
      if (tramo.extremos === 0) return "Toca en el mapa dónde EMPIEZA la calle afectada.";
      if (tramo.extremos === 1) return "Ahora toca dónde TERMINA.";
      if (tramo.error) return `${tramo.error} Toca el mapa para empezar de nuevo.`;
      if (tramo.buscando || !tramo.puntos) return "Buscando la calle…";
      const metros = Math.round(largoM(tramo.puntos) / 10) * 10;
      return `Tramo de ${metros.toLocaleString("es-MX")} m${tramo.ajustada ? " siguiendo la calle" : " en línea recta"}. ¿No es la calle correcta? Toca el mapa para empezar de nuevo.`;
    }
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
              onClick={() => irA("tipo")}
              aria-label="Regresar"
              className="-ml-1 grid h-8 w-6 place-items-center text-ios-azul"
            >
              <svg width="12" height="20" viewBox="0 0 12 20" aria-hidden>
                <path d="M10 2L2 10l8 8" stroke="currentColor" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          {TITULOS[paso]}
        </span>
      }
    >
      {paso === "tipo" ? (
        <div className="grid grid-cols-3 gap-2.5">
          <BotonTipo emoji="💧" texto="Agua" color="#007aff" onClick={() => irA("agua")} />
          {TIPOS_PIN.map((t) => (
            <BotonTipo key={t} emoji={INFO_PIN[t].emoji} texto={INFO_PIN[t].nombre} color={INFO_PIN[t].color} onClick={() => irA(t)} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <p
            className={`rounded-xl px-3.5 py-2.5 text-[15px] ${
              sinUbicacion || (paso === "agua" && colonia === null) || (linea && tramo.error)
                ? "bg-ios-naranja/12 text-[#c93400]"
                : "bg-ios-azul/10 text-ios-azul"
            }`}
          >
            {linea ? "🛣️" : "📍"} {textoUbicacion}
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
                  <img src={vistaPrevia} alt="Vista previa" className="h-14 w-14 rounded-xl object-cover" />
                  <button onClick={quitarFoto} className="text-[15px] text-ios-rojo">
                    Quitar foto
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => entradaFoto.current?.click()}
                  disabled={comprimiendo}
                  className="boton boton-tenue min-h-[44px] rounded-xl px-4 text-[15px]"
                >
                  {comprimiendo ? "Procesando foto…" : "📷 Agregar foto"}
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
                className="campo resize-none"
              />
              <div className="mt-1 text-right text-xs text-ios-terciario">
                {comentario.length}/{MAX_COMENTARIO}
              </div>
            </div>
          ) : (
            <button onClick={() => setVerComentario(true)} className="text-[15px] text-ios-azul">
              Agregar comentario
            </button>
          )}

          {paso === "agua" && !eligiendoSucia && (
            <>
              <p className="titulo-grupo !px-1 !pb-0">Toca una opción para enviar</p>
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
              <p className="text-[15px] text-ios-secundario">¿Qué notas en el agua? (opcional, puedes elegir varias)</p>
              <div className="flex flex-wrap gap-2">
                {DETALLES_SUCIA.map((d) => {
                  const activo = detalles.includes(d);
                  return (
                    <button
                      key={d}
                      onClick={() => setDetalles(activo ? detalles.filter((x) => x !== d) : [...detalles, d])}
                      aria-pressed={activo}
                      className={`rounded-full px-3.5 py-2 text-[15px] ${activo ? "bg-ios-etiqueta text-white" : "bg-ios-relleno"}`}
                    >
                      {ETIQUETAS[d]}
                    </button>
                  );
                })}
              </div>
              <BotonOpcion texto="Enviar: agua sucia" color={COLOR_ESTADO.sucia} disabled={bloqueado} onClick={() => enviarReporte("sucia")} />
            </>
          )}

          {paso !== "agua" && (
            <>
              <p className="titulo-grupo !px-1 !pb-0">Toca una opción para enviar</p>
              <div className={`grid gap-2 ${paso === "bache" || paso === "calle_cerrada" ? "grid-cols-2" : "grid-cols-1"}`}>
                {SUBTIPOS[paso].map((t) => (
                  <BotonOpcion
                    key={t}
                    texto={SUBTIPOS_PELIGROSOS.has(t) ? `⚠️ ${ETIQUETAS[t]}` : ETIQUETAS[t]}
                    color={SUBTIPOS_PELIGROSOS.has(t) ? "peligro" : null}
                    disabled={bloqueado}
                    onClick={() => enviarReporte(t)}
                  />
                ))}
              </div>
            </>
          )}

          {enviando && <p className="text-center text-[15px] text-ios-secundario">Enviando…</p>}
          {error && (
            <p role="alert" className="rounded-xl bg-ios-rojo/10 px-3.5 py-2.5 text-[15px] text-ios-rojo">
              {error}
            </p>
          )}
        </div>
      )}
    </HojaInferior>
  );
}

function armarFormulario(
  tipo: TipoPin,
  subtipo: string,
  lat: number,
  lng: number,
  comentario: string,
  foto: File | null,
  token: string,
  trazo: [number, number][] | null,
) {
  const f = new FormData();
  if (trazo) f.set("trazo", JSON.stringify(trazo));
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
      className="flex flex-col items-center gap-2 rounded-2xl bg-ios-fondo px-1 pb-3 pt-3.5 text-[13px] font-medium leading-tight transition active:scale-95 active:opacity-70"
    >
      <span className="grid h-[52px] w-[52px] place-items-center rounded-[14px] text-[28px]" style={{ background: `${color}26` }} aria-hidden>
        {emoji}
      </span>
      {texto}
    </button>
  );
}

/** Opción que envía el reporte. Con color: el del mapa (agua); "peligro": rojo; null: neutra. */
function BotonOpcion({
  texto,
  color,
  disabled,
  onClick,
}: {
  texto: string;
  color: string | null;
  disabled: boolean;
  onClick: () => void;
}) {
  const estilo =
    color === "peligro"
      ? "bg-ios-rojo/10 text-ios-rojo"
      : color === null
        ? "bg-ios-fondo text-ios-etiqueta"
        : "text-white";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`boton min-h-[54px] rounded-[14px] px-3 text-[16px] leading-tight ${estilo}`}
      style={color && color !== "peligro" ? { background: color } : undefined}
    >
      {texto}
    </button>
  );
}
