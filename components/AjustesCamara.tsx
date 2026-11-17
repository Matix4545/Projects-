"use client";

import { useEffect, useRef, useState } from "react";
import { calibrarConRectangulo, camaraDesdeFov, ejesSuelo, FOV_TIPICO, inclinacion, type Px, type Vec3 } from "@/lib/baches/geometria";
import { Detector, leerInfoModelo, type InfoModelo } from "@/lib/baches/modelo";
import { Orientacion } from "@/lib/baches/sensores";
import { dibujarPiso } from "./CamaraBaches";
import { HojaInferior } from "./HojaInferior";
import { Interruptor } from "./Interruptor";
import { Bloque } from "./Pagina";

export type AjustesCamara = {
  activa: boolean;
  alturaCm: number;
  fov: number;
  /** Fecha de la calibración (null = valor típico) */
  calibrada: string | null;
  /** Inclinación guardada al calibrar, por si el celular no da orientación en vivo */
  abajo: Vec3 | null;
};

const ALTURA_POR_VEHICULO: Record<string, number> = { auto: 125, camioneta: 145, pickup: 160, moto: 110, otro: 130 };

const leer = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const guardar = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* sin almacenamiento */
  }
};

/** Ajustes de la cámara guardados en este celular (la altura, por vehículo) */
export function useAjustesCamara(vehiculo: string) {
  const [a, setA] = useState<AjustesCamara>({ activa: false, alturaCm: ALTURA_POR_VEHICULO[vehiculo] ?? 130, fov: FOV_TIPICO, calibrada: null, abajo: null });
  useEffect(() => {
    const cal = (() => {
      try {
        return JSON.parse(leer("rc_cam_calibracion") ?? "null") as { fov: number; fecha: string; abajo: Vec3 | null } | null;
      } catch {
        return null;
      }
    })();
    setA({
      activa: leer("rc_cam_activa") === "1",
      alturaCm: Number(leer(`rc_cam_altura_${vehiculo}`)) || ALTURA_POR_VEHICULO[vehiculo] || 130,
      fov: cal?.fov ?? FOV_TIPICO,
      calibrada: cal?.fecha ?? null,
      abajo: cal?.abajo ?? null,
    });
  }, [vehiculo]);
  const cambiar = (c: Partial<AjustesCamara>) =>
    setA((x) => {
      const n = { ...x, ...c };
      guardar("rc_cam_activa", n.activa ? "1" : "0");
      guardar(`rc_cam_altura_${vehiculo}`, String(n.alturaCm));
      if (c.fov !== undefined || c.abajo !== undefined) {
        guardar("rc_cam_calibracion", JSON.stringify({ fov: n.fov, fecha: n.calibrada, abajo: n.abajo }));
      }
      return n;
    });
  return [a, cambiar] as const;
}

export type EstadoDetector = { info: InfoModelo | null | undefined; detector: Detector | null; progreso: number | null; error: string | null };

/** Descarga y prepara el modelo cuando se activa la cámara */
export function useDetector(activa: boolean): EstadoDetector {
  const [info, setInfo] = useState<InfoModelo | null | undefined>(undefined);
  const [detector, setDetector] = useState<Detector | null>(null);
  const [progreso, setProgreso] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    leerInfoModelo().then(setInfo);
  }, []);
  useEffect(() => {
    if (!activa || !info || detector) return;
    let vigente = true;
    setError(null);
    setProgreso(0);
    Detector.crear(info, (f) => vigente && setProgreso(f))
      .then((d) => vigente && setDetector(d))
      .catch((e) => vigente && setError(e instanceof Error ? e.message : "No se pudo preparar el detector."))
      .finally(() => vigente && setProgreso(null));
    return () => {
      vigente = false;
    };
  }, [activa, info, detector]);
  return { info, detector, progreso, error };
}

/** Pide el permiso de orientación en iPhone (debe ser dentro de un toque) */
export async function pedirPermisoOrientacion() {
  const DOE = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
  if (typeof DOE?.requestPermission === "function") {
    try {
      return (await DOE.requestPermission()) === "granted";
    } catch {
      return false;
    }
  }
  return true;
}

export async function abrirCamara() {
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
  });
}

/** Bloque de la página de inicio de /medir (solo equipo) */
export function BloqueCamara({ ajustes, cambiar, estado }: { ajustes: AjustesCamara; cambiar: (c: Partial<AjustesCamara>) => void; estado: EstadoDetector }) {
  const [calibrando, setCalibrando] = useState(false);
  const { info } = estado;
  const sinModelo = info === null;
  return (
    <>
      <Bloque
        titulo="Baches con la cámara · solo equipo"
        sinRelleno
        nota={
          ajustes.activa ? (
            <>
              El celular va en el <strong>parabrisas</strong>, mirando al frente. Cada bache se mide en m² sobre el plano de la calle y se sube solo al mapa
              (si ya había uno a menos de 8 m, se le suma la detección). Solo se envía un recorte del bache, nunca el video.
            </>
          ) : sinModelo ? (
            <>Aún no hay modelo entrenado. Córrelo en GitHub → Actions → “Entrenar detector de baches”.</>
          ) : undefined
        }
      >
        <div className="flex items-center justify-between px-4 py-2.5 text-[16px]">
          Detectar baches con la cámara
          <Interruptor etiqueta="Detectar baches con la cámara" activo={ajustes.activa && !sinModelo} onCambio={(v) => !sinModelo && cambiar({ activa: v })} />
        </div>
        {ajustes.activa && !sinModelo && (
          <>
            <label className="flex items-center justify-between gap-3 border-t border-ios-separador px-4 py-2.5 text-[16px]">
              Altura de la cámara sobre el piso
              <span className="flex items-center gap-1 text-ios-secundario">
                <input
                  type="number"
                  inputMode="numeric"
                  min={40}
                  max={400}
                  value={ajustes.alturaCm}
                  onChange={(e) => cambiar({ alturaCm: Math.max(40, Math.min(400, Number(e.target.value) || 0)) })}
                  className="w-16 bg-transparent text-right text-ios-etiqueta outline-none"
                />
                cm
              </span>
            </label>
            <div className="flex items-center justify-between gap-3 border-t border-ios-separador px-4 py-2.5 text-[16px]">
              <span>
                Campo de visión
                <span className="block text-[13px] text-ios-secundario">
                  {ajustes.calibrada ? `${ajustes.fov.toFixed(1)}° · calibrado el ${ajustes.calibrada}` : `${ajustes.fov}° (típico, sin calibrar)`}
                </span>
              </span>
              <button
                onClick={async () => {
                  await pedirPermisoOrientacion();
                  setCalibrando(true);
                }}
                className="boton boton-tenue min-h-9 rounded-full px-4 text-[15px]"
              >
                Probar y calibrar
              </button>
            </div>
            <div className="border-t border-ios-separador px-4 py-2.5 text-[14px] text-ios-secundario">
              {estado.error ? (
                <span className="text-ios-rojo">{estado.error}</span>
              ) : estado.progreso != null ? (
                `Descargando el detector… ${Math.round(estado.progreso * 100)}%`
              ) : estado.detector ? (
                <>
                  ✓ Detector listo ({estado.detector.proveedor === "webgpu" ? "WebGPU" : "CPU"}){info?.fecha ? ` · modelo del ${info.fecha}` : ""}
                  {info?.map50 != null ? ` · precisión ${Math.round(info.map50 * 100)}%` : ""}
                </>
              ) : (
                "Preparando el detector…"
              )}
              {info?.sintetico && <span className="block font-medium text-[#c93400]">Modelo de PRUEBA (imágenes sintéticas): no detecta baches reales.</span>}
            </div>
          </>
        )}
      </Bloque>
      {calibrando && (
        <CalibrarCamara
          ajustes={ajustes}
          onCerrar={() => setCalibrando(false)}
          onGuardar={(c) => {
            cambiar(c);
            setCalibrando(false);
          }}
        />
      )}
    </>
  );
}

/** Vista previa con la cuadrícula del piso y calibración con un rectángulo de medida conocida */
function CalibrarCamara({ ajustes, onCerrar, onGuardar }: { ajustes: AjustesCamara; onCerrar: () => void; onGuardar: (c: Partial<AjustesCamara>) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const foto = useRef<HTMLCanvasElement>(null);
  const orientacion = useRef(new Orientacion(3));
  const [error, setError] = useState<string | null>(null);
  const [pose, setPose] = useState<{ pitch: number; roll: number } | null>(null);
  const [congelada, setCongelada] = useState<{ g: Vec3; vw: number; vh: number } | null>(null);
  const [esquinas, setEsquinas] = useState<Px[]>([]);
  const [anchoCm, setAnchoCm] = useState(100);
  const [largoCm, setLargoCm] = useState(200);
  const [calcularAltura, setCalcularAltura] = useState(false);
  const [resultado, setResultado] = useState<ReturnType<typeof calibrarConRectangulo>>(null);
  // Con la imagen congelada se deja de pintar la cuadrícula en vivo (el lienzo es de las esquinas)
  const pausada = useRef(false);
  pausada.current = !!congelada;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let vivo = true;
    const alOrientar = (e: DeviceOrientationEvent) => orientacion.current.lectura(e.beta, e.gamma, performance.now() / 1000);
    window.addEventListener("deviceorientation", alOrientar);
    abrirCamara()
      .then((s) => {
        if (!vivo) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        video.current!.srcObject = s;
        video.current!.play().catch(() => {});
      })
      .catch(() => setError("Sin permiso de cámara. Actívalo en los ajustes del navegador para este sitio."));
    // Cuadrícula en vivo
    let cuadro = 0;
    const pintar = () => {
      if (!vivo) return;
      const v = video.current;
      const c = lienzo.current;
      const g = orientacion.current.abajo() ?? ajustes.abajo;
      if (v && c && v.videoWidth && g && !pausada.current) {
        const ejes = ejesSuelo(g);
        const dpr = window.devicePixelRatio || 1;
        c.width = Math.round(c.clientWidth * dpr);
        c.height = Math.round(c.clientHeight * dpr);
        const ctx = c.getContext("2d")!;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (ejes) dibujarPiso(ctx, camaraDesdeFov(v.videoWidth, v.videoHeight, ajustes.fov), ejes, ajustes.alturaCm / 100, c.clientWidth / v.videoWidth);
        if (cuadro++ % 15 === 0) setPose(inclinacion(g));
      }
      requestAnimationFrame(pintar);
    };
    requestAnimationFrame(pintar);
    return () => {
      vivo = false;
      window.removeEventListener("deviceorientation", alOrientar);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [ajustes.abajo, ajustes.fov, ajustes.alturaCm]);

  function congelar() {
    const v = video.current;
    const g = orientacion.current.abajo() ?? ajustes.abajo;
    if (!v?.videoWidth) return;
    if (!g) {
      setError("El celular no da su inclinación (sensor de orientación). Sin eso no se puede calibrar.");
      return;
    }
    const c = foto.current!;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    setCongelada({ g, vw: v.videoWidth, vh: v.videoHeight });
    setEsquinas([]);
    setResultado(null);
  }

  // Dibuja las esquinas tocadas sobre la foto congelada
  useEffect(() => {
    const c = lienzo.current;
    if (!c || !congelada) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(c.clientWidth * dpr);
    c.height = Math.round(c.clientHeight * dpr);
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const k = c.clientWidth / congelada.vw;
    ctx.strokeStyle = "#34c759";
    ctx.fillStyle = "#34c759";
    ctx.lineWidth = 2;
    ctx.beginPath();
    esquinas.forEach(([x, y], i) => (i ? ctx.lineTo(x * k, y * k) : ctx.moveTo(x * k, y * k)));
    if (esquinas.length === 4) ctx.closePath();
    ctx.stroke();
    ctx.font = "700 12px system-ui";
    esquinas.forEach(([x, y], i) => {
      ctx.beginPath();
      ctx.arc(x * k, y * k, 5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillText(String(i + 1), x * k + 7, y * k - 7);
    });
  }, [esquinas, congelada]);

  function tocar(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!congelada || esquinas.length >= 4) return;
    const r = e.currentTarget.getBoundingClientRect();
    const k = congelada.vw / r.width;
    setEsquinas((q) => [...q, [(e.clientX - r.left) * k, (e.clientY - r.top) * k]]);
  }

  function calcular() {
    if (!congelada) return;
    setResultado(
      calibrarConRectangulo({
        esquinas,
        anchoM: anchoCm / 100,
        largoM: largoCm / 100,
        abajoCam: congelada.g,
        ancho: congelada.vw,
        alto: congelada.vh,
        alturaM: calcularAltura ? undefined : ajustes.alturaCm / 100,
      }),
    );
  }

  return (
    <HojaInferior titulo="Probar y calibrar la cámara" onCerrar={onCerrar}>
      <div className="space-y-3 pb-2">
        <div className="relative overflow-hidden rounded-2xl bg-black">
          <video ref={video} muted playsInline autoPlay className={`block w-full ${congelada ? "hidden" : ""}`} />
          <canvas ref={foto} className={`block w-full ${congelada ? "" : "hidden"}`} />
          <canvas ref={lienzo} onPointerDown={tocar} className={`absolute inset-0 h-full w-full ${congelada ? "cursor-crosshair" : "pointer-events-none"}`} />
          {pose && !congelada && (
            <div className="absolute right-2 top-2 rounded-full bg-black/55 px-2.5 py-1 font-mono text-[11px] text-white">
              ↓{pose.pitch.toFixed(1)}° ↻{pose.roll.toFixed(1)}°
            </div>
          )}
        </div>
        {error && <p className="rounded-xl bg-ios-rojo/10 px-3 py-2 text-[14px] text-ios-rojo">{error}</p>}
        {!congelada ? (
          <>
            <p className="text-[14px] text-ios-secundario">
              La franja verde es donde se mide el tamaño (de {3} a {14} m). Apunta el celular para que cubra tu carril y la línea amarilla quede sobre el
              horizonte. Si las líneas no coinciden con la calle, calibra.
            </p>
            <p className="text-[14px] text-ios-secundario">
              <strong className="text-ios-etiqueta">Para calibrar</strong>, con el vehículo estacionado en piso plano, pon delante (a unos 5–8 m) un rectángulo de
              medida conocida: cuatro hojas carta, un tapete, cinta en el piso o las rayas de un cajón de estacionamiento. Luego toca Congelar.
            </p>
            <button onClick={congelar} className="boton boton-principal w-full">
              Congelar imagen
            </button>
          </>
        ) : (
          <>
            <p className="text-[14px] text-ios-secundario">
              Toca las 4 esquinas en orden, dando la vuelta: <strong>1 → 2</strong> es el lado ancho (el más cercano), <strong>2 → 3</strong> el largo.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="campo flex items-center justify-between text-[15px]">
                Ancho (1→2)
                <span className="flex items-center gap-1">
                  <input type="number" inputMode="numeric" value={anchoCm} onChange={(e) => setAnchoCm(Number(e.target.value) || 0)} className="w-14 bg-transparent text-right outline-none" />
                  cm
                </span>
              </label>
              <label className="campo flex items-center justify-between text-[15px]">
                Largo (2→3)
                <span className="flex items-center gap-1">
                  <input type="number" inputMode="numeric" value={largoCm} onChange={(e) => setLargoCm(Number(e.target.value) || 0)} className="w-14 bg-transparent text-right outline-none" />
                  cm
                </span>
              </label>
            </div>
            <div className="flex items-center justify-between text-[15px]">
              <span>
                Calcular también la altura
                <span className="block text-[13px] text-ios-secundario">Apágalo si mediste la altura con cinta ({ajustes.alturaCm} cm)</span>
              </span>
              <Interruptor etiqueta="Calcular también la altura" activo={calcularAltura} onCambio={setCalcularAltura} />
            </div>
            {resultado && (
              <p className={`rounded-xl px-3 py-2 text-[15px] ${resultado.error < 0.05 ? "bg-ios-verde/12 text-[#248a3d]" : "bg-ios-naranja/12 text-[#c93400]"}`}>
                Campo de visión <strong>{resultado.fovLargo.toFixed(1)}°</strong>
                {calcularAltura && (
                  <>
                    {" "}
                    · altura <strong>{Math.round(resultado.alturaM * 100)} cm</strong>
                  </>
                )}{" "}
                · diferencia con el rectángulo {(resultado.error * 100).toFixed(1)}%
                {resultado.error >= 0.05 && ". Es mucha: revisa las medidas o toca las esquinas con más cuidado."}
              </p>
            )}
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => (esquinas.length ? setEsquinas((q) => q.slice(0, -1)) : setCongelada(null))} className="boton boton-tenue px-2 text-[15px]">
                {esquinas.length ? "Deshacer" : "Volver"}
              </button>
              <button onClick={calcular} disabled={esquinas.length !== 4 || anchoCm <= 0 || largoCm <= 0} className="boton boton-principal px-2 text-[15px]">
                Calcular
              </button>
              <button
                disabled={!resultado}
                onClick={() =>
                  resultado &&
                  onGuardar({
                    fov: resultado.fovLargo,
                    calibrada: new Date().toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }),
                    abajo: congelada.g,
                    ...(calcularAltura ? { alturaCm: Math.round(resultado.alturaM * 100) } : {}),
                  })
                }
                className="boton boton-exito px-2 text-[15px]"
              >
                Guardar
              </button>
            </div>
          </>
        )}
      </div>
    </HojaInferior>
  );
}
