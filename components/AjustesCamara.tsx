"use client";

import { useEffect, useRef, useState } from "react";
import { calibrarConRectangulo, camaraDesdeFov, ejesSuelo, FOV_TIPICO, inclinacion, sueloAPixel, type Px, type Vec3 } from "@/lib/baches/geometria";
import { Detector, leerInfoModelo, type InfoModelo } from "@/lib/baches/modelo";
import { Orientacion } from "@/lib/baches/sensores";
import { dibujarPiso } from "./CamaraBaches";
import { HojaInferior } from "./HojaInferior";
import { Interruptor } from "./Interruptor";
import { MedidaReferencia } from "./MedidaReferencia";
import { Bloque } from "./Pagina";

export type AjustesCamara = {
  activa: boolean;
  alturaCm: number;
  fov: number;
  /** Fecha de la calibración (null = valor típico) */
  calibrada: string | null;
  /** Inclinación guardada al calibrar, por si el celular no da orientación en vivo */
  abajo: Vec3 | null;
  /** Día (AAAA-MM-DD) en que se revisó la cámara por última vez */
  revisada: string | null;
};

/** Hoy en Cajeme, AAAA-MM-DD */
export const hoy = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Hermosillo" });
export const revisadaHoy = (a: AjustesCamara) => a.revisada === hoy();

const ALTURA_POR_VEHICULO: Record<string, number> = { auto: 125, camioneta: 145, pickup: 160, moto: 110, otro: 130 };

/**
 * Campo de visión creíble para la cámara trasera de un celular (lado largo). Normal ≈ 60–80°, gran
 * angular ≈ 100–120°. Fuera de esto el ajuste fino salió mal (esquinas en otro orden, medidas
 * equivocadas) y mediría todo mal: no se guarda, y uno guardado así se ignora.
 */
export const FOV_CREIBLE = { min: 45, max: 120 };
const fovCreible = (f: unknown): f is number => typeof f === "number" && Number.isFinite(f) && f >= FOV_CREIBLE.min && f <= FOV_CREIBLE.max;
/** Altura creíble del celular sobre el piso al calcularla con el ajuste fino (cm) */
const ALTURA_CREIBLE = { min: 60, max: 300 };

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
  const [a, setA] = useState<AjustesCamara>({
    activa: false,
    alturaCm: ALTURA_POR_VEHICULO[vehiculo] ?? 130,
    fov: FOV_TIPICO,
    calibrada: null,
    abajo: null,
    revisada: null,
  });
  useEffect(() => {
    const cal = (() => {
      try {
        return JSON.parse(leer("rc_cam_calibracion") ?? "null") as { fov: number; fecha: string; abajo: Vec3 | null } | null;
      } catch {
        return null;
      }
    })();
    // Un ajuste fino con un campo de visión imposible (p. ej. 139°) se descarta: se usa el típico
    const calOk = cal && fovCreible(cal.fov) ? cal : null;
    setA({
      // Prendida salvo que la hayan apagado en este celular (solo cuenta si entró el equipo o un voluntario)
      activa: leer("rc_cam_activa") !== "0",
      alturaCm: Math.max(40, Math.min(400, Number(leer(`rc_cam_altura_${vehiculo}`)) || ALTURA_POR_VEHICULO[vehiculo] || 130)),
      fov: calOk?.fov ?? FOV_TIPICO,
      calibrada: calOk?.fecha ?? null,
      abajo: calOk?.abajo ?? cal?.abajo ?? null,
      revisada: leer("rc_cam_revisada"),
    });
  }, [vehiculo]);
  const cambiar = (c: Partial<AjustesCamara>) =>
    setA((x) => {
      const n = { ...x, ...c };
      guardar("rc_cam_activa", n.activa ? "1" : "0");
      guardar(`rc_cam_altura_${vehiculo}`, String(n.alturaCm));
      if (c.revisada !== undefined) guardar("rc_cam_revisada", n.revisada ?? "");
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
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    // Sin conexión no es lo mismo que "no hay modelo": se reintenta hasta saberlo
    let vigente = true;
    let reloj: ReturnType<typeof setTimeout> | undefined;
    const intentar = () =>
      leerInfoModelo()
        .then((i) => vigente && setInfo(i))
        .catch(() => {
          if (vigente) reloj = setTimeout(intentar, 4000);
        });
    intentar();
    return () => {
      vigente = false;
      clearTimeout(reloj);
    };
  }, []);
  useEffect(() => {
    if (!activa || !info || detector) return;
    let vigente = true;
    setError(null);
    setProgreso(0);
    let reloj: ReturnType<typeof setTimeout> | undefined;
    Detector.crear(info, (f) => vigente && setProgreso(f))
      .then((d) => vigente && setDetector(d))
      .catch((e) => {
        if (!vigente) return;
        // Un corte de señal al bajar el modelo: se reintenta solo (3 veces) antes de mostrar el error
        if (intento < 3) reloj = setTimeout(() => vigente && setIntento((n) => n + 1), 4000);
        else setError(e instanceof Error ? e.message : "No se pudo preparar el detector.");
      })
      .finally(() => vigente && setProgreso(null));
    return () => {
      vigente = false;
      clearTimeout(reloj);
    };
  }, [activa, info, detector, intento]);
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

/** Palomita para lo que ya está bien */
export function Palomita({ className = "" }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className={className}>
      <path d="M3 8.5l3.2 3L13 4.5" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const metros = (cm: number) => `${(cm / 100).toFixed(2)} m`;

/** Línea de estado del detector: solo se muestra si hay algo que decir (descargando, error, modelo de prueba) */
function LineaDetector({ estado }: { estado: EstadoDetector }) {
  if (estado.error) return <p className="rounded-xl bg-ios-rojo/10 px-3 py-2 text-[14px] text-ios-rojo">{estado.error}</p>;
  return (
    <>
      {estado.progreso != null && (
        <div className="space-y-1.5">
          <p className="text-[14px] text-ios-secundario">Preparando el detector de baches… {Math.round(estado.progreso * 100)}%</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-ios-relleno">
            <div className="h-full rounded-full bg-ios-azul transition-[width]" style={{ width: `${Math.round(estado.progreso * 100)}%` }} />
          </div>
        </div>
      )}
      {estado.info?.sintetico && <p className="text-[14px] font-medium text-[#c93400]">Modelo de PRUEBA (imágenes sintéticas): no detecta baches reales.</p>}
    </>
  );
}

/** Paso "Revisa la cámara" de /medir (equipo y voluntarios): prender la cámara y revisar que vea la calle */
export function PasoCamara({ ajustes, cambiar, estado }: { ajustes: AjustesCamara; cambiar: (c: Partial<AjustesCamara>) => void; estado: EstadoDetector }) {
  const [revisando, setRevisando] = useState(false);
  const sinModelo = estado.info === null;
  const activa = ajustes.activa && !sinModelo;
  const abrir = async () => {
    // En iPhone el permiso de orientación se pide dentro del toque
    await pedirPermisoOrientacion();
    setRevisando(true);
  };
  return (
    <>
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-ios-fondo px-4 py-3">
        <span className="text-[16px] font-medium leading-tight">
          Buscar baches con la cámara
          <span className="block text-[13px] font-normal text-ios-secundario">
            {sinModelo ? "Todavía no hay un modelo de baches instalado" : "Los mide y los sube al mapa solos"}
          </span>
        </span>
        <Interruptor etiqueta="Detectar baches con la cámara" activo={activa} onCambio={(v) => !sinModelo && cambiar({ activa: v })} />
      </div>
      {activa && (
        <>
          <LineaDetector estado={estado} />
          {revisadaHoy(ajustes) ? (
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-1.5 text-[15px] font-medium text-[#248a3d]">
                <Palomita />
                Revisada hoy · altura {metros(ajustes.alturaCm)}
              </p>
              <button onClick={abrir} className="boton boton-tenue min-h-9 shrink-0 rounded-full px-4 text-[15px]">
                Otra vez
              </button>
            </div>
          ) : (
            <>
              <p className="text-[15px] leading-snug text-ios-secundario">Con el carro estacionado, revisa que la cámara vea bien la calle. Toma 30 segundos.</p>
              <button onClick={abrir} className="boton boton-tenue h-12 w-full">
                Revisar la cámara
              </button>
            </>
          )}
        </>
      )}
      {revisando && <RevisarCamara ajustes={ajustes} cambiar={cambiar} onCerrar={() => setRevisando(false)} />}
    </>
  );
}

/** Al final de /medir (solo equipo): medida a mano, ajuste fino y detalles técnicos */
export function HerramientasEquipo({ ajustes, cambiar, estado }: { ajustes: AjustesCamara; cambiar: (c: Partial<AjustesCamara>) => void; estado: EstadoDetector }) {
  const [referencia, setReferencia] = useState(false);
  const [ajuste, setAjuste] = useState(false);
  const { info, detector } = estado;
  const fila = "flex items-center justify-between gap-3 border-t border-ios-separador px-4 py-3 text-[16px] first:border-0";
  return (
    <>
      <Bloque titulo="Herramientas del equipo" sinRelleno>
        <div className={fila}>
          <span className="leading-tight">
            Medir un bache a mano
            <span className="block text-[13px] text-ios-secundario">Con una hoja carta, para comprobar que la cámara mide bien</span>
          </span>
          <button onClick={() => setReferencia(true)} className="boton boton-tenue min-h-9 shrink-0 rounded-full px-4 text-[15px]">
            Medir
          </button>
        </div>
        {ajustes.activa && info !== null && (
          <div className={fila}>
            <span className="leading-tight">
              Ajuste fino de la cámara
              <span className="block text-[13px] text-ios-secundario">Con hojas en el piso, si la franja verde no cae donde debe</span>
            </span>
            <button
              onClick={async () => {
                await pedirPermisoOrientacion();
                setAjuste(true);
              }}
              className="boton boton-tenue min-h-9 shrink-0 rounded-full px-4 text-[15px]"
            >
              Ajustar
            </button>
          </div>
        )}
        <details className="group border-t border-ios-separador">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[16px] [&::-webkit-details-marker]:hidden">
            Detalles técnicos
            <svg width="8" height="13" viewBox="0 0 8 13" aria-hidden className="text-ios-terciario transition-transform group-open:rotate-90">
              <path d="M1.5 1.5l5 5-5 5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </summary>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 px-4 pb-3.5 text-[14px]">
            <dt className="text-ios-secundario">Detector</dt>
            <dd>
              {estado.error
                ? "con error"
                : detector
                  ? `listo (${detector.proveedor === "webgpu" ? "WebGPU" : "CPU"})`
                  : estado.progreso != null
                    ? `descargando ${Math.round(estado.progreso * 100)}%`
                    : ajustes.activa
                      ? "preparando…"
                      : "apagado"}
            </dd>
            <dt className="text-ios-secundario">Modelo</dt>
            <dd>
              {info === null ? "sin instalar" : info ? `${info.fecha ? `del ${info.fecha}` : "instalado"}${info.map50 != null ? ` · precisión ${Math.round(info.map50 * 100)}%` : ""}` : "…"}
            </dd>
            <dt className="text-ios-secundario">Campo de visión</dt>
            <dd>{ajustes.calibrada ? `${ajustes.fov.toFixed(1)}° · ajustado el ${ajustes.calibrada}` : `${ajustes.fov}° (típico, sin ajuste fino)`}</dd>
            <dt className="text-ios-secundario">Altura</dt>
            <dd>{ajustes.alturaCm} cm</dd>
          </dl>
        </details>
      </Bloque>
      {referencia && <MedidaReferencia onCerrar={() => setReferencia(false)} />}
      {ajuste && <RevisarCamara ajustes={ajustes} cambiar={cambiar} inicio="ajuste" onCerrar={() => setAjuste(false)} />}
    </>
  );
}

/** Cómo está colocado el celular, visto por sus sensores */
type Revision = { pitch: number; roll: number; horizontal: boolean; apunta: "bien" | "arriba" | "abajo" };

function revisarPose(g: Vec3, vw: number, vh: number, fov: number, h: number): Revision {
  const { pitch, roll } = inclinacion(g);
  const ejes = ejesSuelo(g);
  let apunta: Revision["apunta"] = "bien";
  if (!ejes) apunta = pitch > 0 ? "arriba" : "abajo";
  else {
    const cam = camaraDesdeFov(vw, vh, fov);
    const y8 = sueloAPixel([0, 8], cam, ejes, h)?.[1];
    const y14 = sueloAPixel([0, 14], cam, ejes, h)?.[1];
    // Mira al cielo: la calle cercana se sale por abajo de la imagen
    if (pitch < -2 || y8 == null || y8 > vh * 0.92) apunta = "abajo";
    // Mira al cofre: lo lejano de la franja se sale por arriba
    else if (y14 == null || y14 < vh * 0.06) apunta = "arriba";
  }
  return { pitch, roll, horizontal: vw >= vh, apunta };
}

type Punto = { estado: "bien" | "mal" | "info"; texto: string };

function puntosRevision(r: Revision): Punto[] {
  const giro = Math.abs(r.roll);
  return [
    r.horizontal ? { estado: "bien", texto: "Acostado (horizontal)" } : { estado: "mal", texto: "Gíralo a horizontal (acostado): ve más calle" },
    giro > 45
      ? { estado: "mal", texto: "La pantalla no giró: quita el bloqueo de rotación" }
      : giro > 6
        ? { estado: "mal", texto: `Está chueco (${Math.round(giro)}°): enderézalo` }
        : { estado: "bien", texto: "Derecho" },
    r.apunta === "bien"
      ? { estado: "bien", texto: "Viendo la calle" }
      : r.apunta === "abajo"
        ? { estado: "mal", texto: "Apúntalo un poco más abajo, hacia la calle" }
        : { estado: "mal", texto: "Apúntalo un poco más arriba" },
  ];
}

/**
 * Revisión de la cámara antes de salir: video en vivo con la franja donde se mide,
 * estado claro (bien colocado / qué corregir) y la altura. Incluye el ajuste fino con un
 * rectángulo de medida conocida (hojas carta, cajón de estacionamiento).
 */
export function RevisarCamara({
  ajustes,
  cambiar,
  onCerrar,
  inicio = "revisar",
}: {
  ajustes: AjustesCamara;
  cambiar: (c: Partial<AjustesCamara>) => void;
  onCerrar: () => void;
  inicio?: "revisar" | "ajuste";
}) {
  const [modo, setModo] = useState(inicio);
  const video = useRef<HTMLVideoElement>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const foto = useRef<HTMLCanvasElement>(null);
  const orientacion = useRef(new Orientacion(3));
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState<Revision | null>(null);
  const [sinSensor, setSinSensor] = useState(false);
  const [congelada, setCongelada] = useState<{ g: Vec3; vw: number; vh: number } | null>(null);
  const [esquinas, setEsquinas] = useState<Px[]>([]);
  const [anchoCm, setAnchoCm] = useState(100);
  const [largoCm, setLargoCm] = useState(200);
  const [calcularAltura, setCalcularAltura] = useState(false);
  const [resultado, setResultado] = useState<ReturnType<typeof calibrarConRectangulo>>(null);
  // Con la imagen congelada se deja de pintar en vivo (el lienzo es de las esquinas)
  const pausada = useRef(false);
  pausada.current = !!congelada;
  // La altura y el modo cambian sin reiniciar la cámara
  const params = useRef({ ajustes, modo });
  params.current = { ajustes, modo };

  /** "Abajo" en vivo (null si el sensor no ha dado lecturas en 2 s) */
  const enVivo = () => (performance.now() / 1000 - orientacion.current.ultima < 2 ? orientacion.current.abajo() : null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let vivo = true;
    const desde = performance.now();
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
    let cuadro = 0;
    const pintar = () => {
      if (!vivo) return;
      const v = video.current;
      const c = lienzo.current;
      const { ajustes: a, modo: m } = params.current;
      const vivoG = enVivo();
      const g = vivoG ?? a.abajo;
      if (v && c && v.videoWidth && !pausada.current) {
        const dpr = window.devicePixelRatio || 1;
        c.width = Math.round(c.clientWidth * dpr);
        c.height = Math.round(c.clientHeight * dpr);
        const ctx = c.getContext("2d")!;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const ejes = g ? ejesSuelo(g) : null;
        if (ejes) {
          dibujarPiso(
            ctx,
            camaraDesdeFov(v.videoWidth, v.videoHeight, a.fov),
            ejes,
            a.alturaCm / 100,
            c.clientWidth / v.videoWidth,
            m === "revisar" ? { distancias: [10], etiqueta: "Aquí mide" } : { distancias: [5, 10, 15, 20] },
          );
        }
        if (cuadro++ % 10 === 0) {
          setRevision(vivoG ? revisarPose(vivoG, v.videoWidth, v.videoHeight, a.fov, a.alturaCm / 100) : null);
          setSinSensor(!vivoG && performance.now() - desde > 2500);
        }
      }
      requestAnimationFrame(pintar);
    };
    requestAnimationFrame(pintar);
    return () => {
      vivo = false;
      window.removeEventListener("deviceorientation", alOrientar);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function congelar() {
    const v = video.current;
    const g = enVivo() ?? ajustes.abajo;
    if (!v?.videoWidth) return;
    if (!g) {
      setError("El celular no da su inclinación (sensor de orientación). Sin eso no se puede ajustar.");
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

  const puntos = revision ? puntosRevision(revision) : [];
  // El ajuste fino solo se puede guardar si el resultado es físicamente posible
  const creible =
    !!resultado &&
    fovCreible(resultado.fovLargo) &&
    (!calcularAltura || (resultado.alturaM * 100 >= ALTURA_CREIBLE.min && resultado.alturaM * 100 <= ALTURA_CREIBLE.max));
  const bien = !!revision && puntos.every((p) => p.estado !== "mal");
  const primerProblema = puntos.find((p) => p.estado === "mal");
  const altura = (cm: number) => cambiar({ alturaCm: Math.max(40, Math.min(400, Math.round(cm))) });

  return (
    <HojaInferior titulo={modo === "revisar" ? "Revisar la cámara" : "Ajuste fino de la cámara"} onCerrar={onCerrar}>
      <div className="space-y-3 pb-2">
        <div className="relative overflow-hidden rounded-2xl bg-black">
          <video ref={video} muted playsInline autoPlay className={`block w-full ${congelada ? "hidden" : ""}`} />
          <canvas ref={foto} className={`block w-full ${congelada ? "" : "hidden"}`} />
          <canvas ref={lienzo} onPointerDown={tocar} className={`absolute inset-0 h-full w-full ${congelada ? "cursor-crosshair" : "pointer-events-none"}`} />
          {modo === "revisar" && (
            <div
              className={`absolute left-1/2 top-2 flex max-w-[92%] -translate-x-1/2 items-center gap-1.5 rounded-full px-3 py-1.5 text-[14px] font-semibold text-white shadow-lg ${
                bien ? "bg-[#248a3d]" : revision ? "bg-[#c93400]" : "bg-black/60"
              }`}
            >
              {bien && <Palomita />}
              <span className="truncate">
                {bien ? "Bien colocado" : primerProblema ? primerProblema.texto : sinSensor ? "Sin sensor de inclinación" : "Revisando…"}
              </span>
            </div>
          )}
        </div>
        {error && <p className="rounded-xl bg-ios-rojo/10 px-3 py-2 text-[14px] text-ios-rojo">{error}</p>}

        {modo === "revisar" && (
          <>
            {sinSensor ? (
              <p className="rounded-xl bg-ios-naranja/12 px-3 py-2 text-[14px] text-[#c93400]">
                Tu celular no da su inclinación. Haz el ajuste fino con hojas (abajo) para poder medir el tamaño de los baches.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {(puntos.length ? puntos : [{ estado: "info", texto: "Leyendo los sensores…" } as Punto]).map((p) => (
                  <li key={p.texto} className="flex items-center gap-2.5 text-[15px]">
                    <span
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-white ${
                        p.estado === "bien" ? "bg-ios-verde" : p.estado === "mal" ? "bg-ios-naranja" : "bg-ios-terciario"
                      }`}
                    >
                      {p.estado === "bien" ? <Palomita className="h-3.5 w-3.5" /> : <span className="text-[13px] font-bold">{p.estado === "mal" ? "!" : "i"}</span>}
                    </span>
                    {p.texto}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-ios-fondo px-4 py-3">
              <span className="text-[16px] leading-tight">
                Altura del celular
                <span className="block text-[13px] text-ios-secundario">Del piso al celular, con cinta</span>
              </span>
              <span className="flex items-center gap-2">
                <button
                  onClick={() => altura(ajustes.alturaCm - 5)}
                  aria-label="Bajar 5 cm"
                  className="grid h-9 w-9 place-items-center rounded-full bg-white text-[22px] font-medium leading-none text-ios-azul shadow-sm active:opacity-60"
                >
                  −
                </button>
                <label className="flex items-baseline gap-0.5 text-[17px] font-semibold tabular-nums">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={3}
                    aria-label="Altura en centímetros"
                    value={ajustes.alturaCm}
                    onChange={(e) => altura(Number(e.target.value.replace(/\D/g, "")) || 0)}
                    className="w-10 bg-transparent text-right outline-none"
                  />
                  <span className="text-[14px] font-normal text-ios-secundario">cm</span>
                </label>
                <button
                  onClick={() => altura(ajustes.alturaCm + 5)}
                  aria-label="Subir 5 cm"
                  className="grid h-9 w-9 place-items-center rounded-full bg-white text-[22px] font-medium leading-none text-ios-azul shadow-sm active:opacity-60"
                >
                  +
                </button>
              </span>
            </div>
            <p className="text-[14px] leading-snug text-ios-secundario">
              La <strong className="font-semibold text-[#248a3d]">franja verde</strong> es donde se miden los baches: debe caer sobre la calle, delante del cofre. Algo que
              esté a 10 m del celular debe quedar sobre la línea blanca.
            </p>
            <button
              onClick={() => {
                const g = enVivo();
                cambiar({ revisada: hoy(), ...(g ? { abajo: g } : {}) });
                onCerrar();
              }}
              className={`boton h-12 w-full ${bien ? "boton-exito" : "boton-gris"}`}
            >
              {bien ? "Listo" : "Guardar así"}
            </button>
            <button onClick={() => setModo("ajuste")} className="w-full py-1 text-center text-[15px] text-ios-azul">
              ¿La franja no cae sobre la calle? Ajuste fino
            </button>
          </>
        )}

        {modo === "ajuste" && !congelada && (
          <>
            <p className="text-[15px] leading-snug text-ios-secundario">
              Con el carro estacionado en piso plano, pon delante (a unos 5–8 m) algo de medida conocida: <strong className="text-ios-etiqueta">4 hojas carta</strong>, un tapete o
              las rayas de un cajón de estacionamiento. Luego toma una foto.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => (inicio === "ajuste" ? onCerrar() : setModo("revisar"))} className="boton boton-gris text-[16px]">
                Volver
              </button>
              <button onClick={congelar} className="boton boton-principal text-[16px]">
                Tomar foto
              </button>
            </div>
          </>
        )}

        {modo === "ajuste" && congelada && (
          <>
            <p className="text-[15px] leading-snug text-ios-secundario">
              Toca las 4 esquinas dando la vuelta: <strong className="text-ios-etiqueta">1 → 2</strong> es el lado de enfrente (el más cercano) y{" "}
              <strong className="text-ios-etiqueta">2 → 3</strong> el lado largo.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="campo flex items-center justify-between text-[15px]">
                Enfrente
                <span className="flex items-center gap-1">
                  <input type="number" inputMode="numeric" aria-label="Ancho (1→2) en cm" value={anchoCm} onChange={(e) => setAnchoCm(Number(e.target.value) || 0)} className="w-14 bg-transparent text-right outline-none" />
                  cm
                </span>
              </label>
              <label className="campo flex items-center justify-between text-[15px]">
                Largo
                <span className="flex items-center gap-1">
                  <input type="number" inputMode="numeric" aria-label="Largo (2→3) en cm" value={largoCm} onChange={(e) => setLargoCm(Number(e.target.value) || 0)} className="w-14 bg-transparent text-right outline-none" />
                  cm
                </span>
              </label>
            </div>
            <div className="flex items-center justify-between gap-3 text-[15px]">
              <span className="leading-tight">
                Calcular también la altura
                <span className="block text-[13px] text-ios-secundario">Apágalo si mediste la altura con cinta ({ajustes.alturaCm} cm)</span>
              </span>
              <Interruptor etiqueta="Calcular también la altura" activo={calcularAltura} onCambio={setCalcularAltura} />
            </div>
            {resultado && !creible && (
              <p className="rounded-xl bg-ios-rojo/10 px-3 py-2 text-[15px] text-ios-rojo">
                Este resultado no es posible (campo de visión {resultado.fovLargo.toFixed(0)}°
                {calcularAltura ? `, altura ${Math.round(resultado.alturaM * 100)} cm` : ""}) y mediría todo mal, así que no se puede guardar. Revisa que tocaste
                las 4 esquinas en orden dando la vuelta (1 → 2 el lado de enfrente), que el ancho y el largo están bien escritos y que el rectángulo está en
                el piso, completo en la foto.
              </p>
            )}
            {resultado && creible && (
              <p className={`rounded-xl px-3 py-2 text-[15px] ${resultado.error < 0.05 ? "bg-ios-verde/12 text-[#248a3d]" : "bg-ios-naranja/12 text-[#c93400]"}`}>
                {resultado.error < 0.05 ? "✓ Quedó bien" : "Diferencia grande: revisa las medidas o toca las esquinas con más cuidado"} · campo de visión{" "}
                <strong>{resultado.fovLargo.toFixed(1)}°</strong>
                {calcularAltura && (
                  <>
                    {" "}
                    · altura <strong>{Math.round(resultado.alturaM * 100)} cm</strong>
                  </>
                )}{" "}
                · diferencia {(resultado.error * 100).toFixed(1)}%
              </p>
            )}
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => (esquinas.length ? setEsquinas((q) => q.slice(0, -1)) : setCongelada(null))} className="boton boton-gris px-2 text-[15px]">
                {esquinas.length ? "Deshacer" : "Volver"}
              </button>
              <button onClick={calcular} disabled={esquinas.length !== 4 || anchoCm <= 0 || largoCm <= 0} className="boton boton-principal px-2 text-[15px]">
                Calcular
              </button>
              <button
                disabled={!resultado || !creible}
                onClick={() => {
                  if (!resultado || !creible) return;
                  cambiar({
                    fov: resultado.fovLargo,
                    calibrada: new Date().toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }),
                    abajo: congelada.g,
                    revisada: hoy(),
                    ...(calcularAltura ? { alturaCm: Math.max(40, Math.min(400, Math.round(resultado.alturaM * 100))) } : {}),
                  });
                  // De regreso a la vista en vivo para ver la franja ya ajustada
                  setCongelada(null);
                  setEsquinas([]);
                  setResultado(null);
                  setModo("revisar");
                }}
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
