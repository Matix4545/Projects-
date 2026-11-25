"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { enviarYa, iniciar as iniciarBuzon, suscribir as suscribirBuzon, type EstadoBuzon, type Resultado } from "@/lib/baches/buzon";
import { NIVELES_BACHE, nivelBache } from "@/lib/constantes";
import { COLOR_CLASE, MotorRugosidad, clasificar, resumir, type EstadoMedicion, type Tramo } from "@/lib/rugosidad";
import {
  HerramientasEquipo,
  Palomita,
  PasoCamara,
  RevisarCamara,
  abrirCamara,
  pedirPermisoOrientacion,
  revisadaHoy,
  useAjustesCamara,
  useDetector,
} from "./AjustesCamara";
import { CamaraBaches, type BacheSubido, type ControlCamara } from "./CamaraBaches";
import { Interruptor } from "./Interruptor";
import { DibujoParabrisas } from "./DibujoParabrisas";
import { Bloque, Pagina } from "./Pagina";
import { useTurnstile } from "./Turnstile";

type Fase = "inicio" | "midiendo" | "terminado";
type Vehiculo = "auto" | "camioneta" | "pickup" | "moto" | "otro";

const VEHICULOS: [Vehiculo, string][] = [
  ["auto", "🚗 Auto"],
  ["camioneta", "🚙 Camioneta / SUV"],
  ["pickup", "🛻 Pickup"],
  ["moto", "🏍️ Moto"],
  ["otro", "Otro"],
];
type Soporte = "rejilla" | "parabrisas" | "tablero" | "portavasos" | "otro";
const SOPORTES: [Soporte, string][] = [
  ["rejilla", "Rejilla del aire"],
  ["parabrisas", "Parabrisas"],
  ["tablero", "Tablero"],
  ["portavasos", "Portavasos"],
  ["otro", "Otro"],
];
// Android e iPhone leen el acelerómetro distinto: se guarda solo eso, no el modelo
const plataforma = () => {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  return /android/i.test(ua) ? "android" : /iphone|ipad|ipod/i.test(ua) ? "ios" : "otro";
};
const ENVIO_CADA_MS = 5 * 60_000;
/** "🚗 Auto" → "Auto" */
const sinEmoji = (t: string) => t.replace(/^\p{Extended_Pictographic}\uFE0F?\s*/u, "");
/**
 * Horizontal y pantalla completa mientras se mide con la cámara. En Android (navegador o app instalada)
 * se fija la orientación; en iPhone no se puede: se gira a mano (sin bloqueo de rotación).
 */
async function ponerHorizontal() {
  try {
    const instalada = window.matchMedia("(display-mode: standalone)").matches;
    if (!instalada && !document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    }
  } catch {
    /* sin pantalla completa (iPhone) */
  }
  try {
    await (screen.orientation as unknown as { lock?: (o: string) => Promise<void> }).lock?.("landscape");
  } catch {
    /* no se pudo fijar: se gira a mano */
  }
}

type Candado = { release: () => Promise<void> };

/** Pantalla encendida mientras se mide; null si el celular no lo permite (p. ej. app instalada en un iPhone con iOS viejo) */
async function pedirPantallaEncendida(): Promise<Candado | null> {
  try {
    return (await (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<Candado> } }).wakeLock?.request("screen")) ?? null;
  } catch {
    return null;
  }
}

function quitarHorizontal() {
  try {
    (screen.orientation as unknown as { unlock?: () => void }).unlock?.();
  } catch {
    /* nada que soltar */
  }
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
}

const ERRORES_ENTRAR: Record<string, string> = {
  clave: "Contraseña incorrecta.",
  "demasiados-intentos": "Demasiados intentos. Vuelve a intentarlo mañana.",
  "sin-configurar": "El acceso del equipo no está activado.",
  servidor: "No se pudo comprobar en este momento. Intenta de nuevo.",
};

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

/** "Medir mi recorrido": el celular mide la rugosidad mientras se maneja y la envía poco a poco. */
export function Medidor() {
  const obtenerToken = useTurnstile();
  const [fase, setFase] = useState<Fase>("inicio");
  const [vehiculo, setVehiculo] = useState<Vehiculo>("auto");
  const [soporte, setSoporte] = useState<Soporte>("rejilla");
  const [esPrueba, setEsPrueba] = useState(false);
  const [nota, setNota] = useState("");
  const [estado, setEstado] = useState<EstadoMedicion | null>(null);
  const [tramos, setTramos] = useState<Tramo[]>([]);
  const [kmEnviados, setKmEnviados] = useState(0);
  const [pendientesEnvio, setPendientesEnvio] = useState(0);
  const [pausa, setPausa] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historico, setHistorico] = useState(0);
  /** Error al entrar como equipo (regresa en ?error=) */
  const [errorEntrar, setErrorEntrar] = useState<string | null>(null);
  // Baches con la cámara: solo para el equipo (entró con la contraseña del panel)
  const [equipo, setEquipo] = useState(false);
  // Voluntario: entró con el código de voluntarios; solo puede medir baches con la cámara
  const [voluntario, setVoluntario] = useState(false);
  const puedeCamara = equipo || voluntario;
  /** Ya midió con la cámara en este celular: abre directo en "Listo para medir" */
  const [listo, setListo] = useState(false);
  /** En "Listo para medir" tocó "Cambiar ajustes": se muestran los 3 pasos */
  const [verPasos, setVerPasos] = useState(false);
  const [revisando, setRevisando] = useState(false);
  const [camara, cambiarCamara] = useAjustesCamara(vehiculo);
  const detector = useDetector(puedeCamara && camara.activa);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [baches, setBaches] = useState<BacheSubido[]>([]);
  // Buzón de envío de los baches de la cámara (sobrevive a Terminar, a cortes de señal y a recargar)
  const [buzon, setBuzon] = useState<EstadoBuzon>({ pendientes: 0, problema: null, enviando: false });
  const [resultados, setResultados] = useState<ReadonlyMap<string, Resultado>>(new Map());
  const [sinCandado, setSinCandado] = useState(false);
  const iniciando = useRef(false);
  const control = useRef<ControlCamara>(null);

  const motor = useRef<MotorRugosidad | null>(null);
  const sesion = useRef("");
  const cola = useRef<Tramo[]>([]);
  const enviando = useRef(false);
  const limpiar = useRef<() => void>(() => {});
  const ocultoDesde = useRef<number | null>(null);

  useEffect(() => {
    const v = leer("rc_vehiculo") as Vehiculo | null;
    if (v && VEHICULOS.some(([k]) => k === v)) setVehiculo(v);
    const s = leer("rc_soporte") as Soporte | null;
    if (s && SOPORTES.some(([k]) => k === s)) setSoporte(s);
    setHistorico(Number(leer("rc_km_medidos")) || 0);
    setListo(leer("rc_medir_listo") === "1");
    iniciarBuzon();
    const e = new URLSearchParams(window.location.search).get("error");
    if (e) {
      setErrorEntrar(ERRORES_ENTRAR[e] ?? "No se pudo entrar.");
      window.history.replaceState(null, "", window.location.pathname);
    }
    fetch("/api/equipo/sesion")
      .then((r) => r.json())
      .then((r: { equipo?: boolean; voluntario?: boolean }) => {
        setEquipo(!!r.equipo);
        setVoluntario(!!r.voluntario);
      })
      .catch(() => {});
    return () => limpiar.current();
  }, []);

  useEffect(
    () =>
      suscribirBuzon((e, r) => {
        setBuzon(e);
        setResultados(new Map(r));
      }),
    [],
  );

  // Mientras mide o quedan baches por enviar: avisar antes de cerrar o recargar, y sin "jalar para recargar"
  const ocupado = fase === "midiendo" || buzon.pendientes > 0;
  useEffect(() => {
    if (!ocupado) return;
    const alSalir = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", alSalir);
    const antes = document.documentElement.style.overscrollBehavior;
    document.documentElement.style.overscrollBehavior = "none";
    return () => {
      window.removeEventListener("beforeunload", alSalir);
      document.documentElement.style.overscrollBehavior = antes;
    };
  }, [ocupado]);

  // Con la cámara el celular va en el parabrisas (o el tablero): se ajusta solo
  const camaraPrendida = puedeCamara && camara.activa && detector.info !== null;
  useEffect(() => {
    if (camaraPrendida && soporte !== "parabrisas" && soporte !== "tablero") setSoporte("parabrisas");
  }, [camaraPrendida, soporte]);

  /** Manda lo que esté listo; si falla, se queda en la cola y se reintenta en el siguiente envío. */
  async function enviarCola() {
    if (enviando.current || cola.current.length === 0) return;
    enviando.current = true;
    const lote = cola.current.slice(0, 200);
    try {
      const token = await obtenerToken();
      const res = await fetch("/api/rugosidad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sesion: sesion.current,
          fecha: new Date().toLocaleDateString("en-CA", { timeZone: "America/Hermosillo" }), // solo el día
          vehiculo,
          soporte,
          plataforma: plataforma(),
          nota: esPrueba && nota.trim() ? nota.trim() : undefined,
          hz: motor.current?.hz,
          tramos: lote.map(({ puntos, largo_m, vel_kmh, rms, rms_baja, p95, vel_sd, golpes }) => ({
            puntos,
            largo_m,
            vel_kmh,
            rms,
            rms_baja,
            p95,
            vel_sd,
            golpes,
          })),
          token,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      cola.current = cola.current.slice(lote.length);
      const km = lote.reduce((s, t) => s + t.largo_m, 0) / 1000;
      setKmEnviados((k) => k + km);
      const total = (Number(leer("rc_km_medidos")) || 0) + km;
      guardar("rc_km_medidos", String(total));
      setHistorico(total);
    } catch {
      /* sin conexión: se reintenta después */
    } finally {
      enviando.current = false;
      setPendientesEnvio(cola.current.length);
    }
  }

  function liberarYEnviar(final: boolean) {
    const nuevos = motor.current?.liberar(final) ?? [];
    // Al liberar se calculan los recortes de privacidad: se refresca el estado para mostrarlos
    if (motor.current) setEstado(motor.current.estado());
    if (nuevos.length) {
      cola.current.push(...nuevos);
      setTramos((t) => [...t, ...nuevos]);
    }
    setPendientesEnvio(cola.current.length);
    return enviarCola();
  }

  async function empezar() {
    if (iniciando.current) return; // doble toque
    iniciando.current = true;
    try {
      await arrancar();
    } finally {
      iniciando.current = false;
    }
  }

  async function arrancar() {
    setError(null);
    // La pantalla encendida se pide primero, dentro del toque (en iPhone después ya no se puede)
    const promesaCandado = pedirPantallaEncendida();
    const soltarCandado = () => promesaCandado.then((c) => c?.release().catch(() => {}));
    try {
      // En iPhone el permiso del acelerómetro se pide dentro del toque
      const DME = (window as unknown as { DeviceMotionEvent?: { requestPermission?: () => Promise<string> } }).DeviceMotionEvent;
      if (!DME) throw new Error("Este navegador no tiene acceso al acelerómetro.");
      if (typeof DME.requestPermission === "function" && (await DME.requestPermission()) !== "granted") {
        throw new Error("Sin permiso de movimiento no se puede medir. Acéptalo e intenta de nuevo.");
      }
      if (!("geolocation" in navigator)) throw new Error("Este navegador no tiene GPS.");
    } catch (e) {
      soltarCandado();
      setError(e instanceof Error ? e.message : "No se pudo iniciar.");
      return;
    }

    // Se pidió la cámara pero el detector no está listo: avisar en vez de medir sin cámara sin decir nada
    if (puedeCamara && camara.activa && detector.info !== null && !detector.detector) {
      setError(
        detector.error
          ? `No se pudo preparar el detector de baches (${detector.error}). Recarga la página. Si sigue igual, apaga “Buscar baches con la cámara” para medir solo las calles.`
          : "El detector de baches todavía se está preparando. Espera unos segundos e intenta de nuevo.",
      );
      soltarCandado();
      return;
    }

    // Cámara para los baches (si está activa y el detector ya está listo)
    let video: MediaStream | null = null;
    if (puedeCamara && camara.activa && detector.detector) {
      // El celular va acostado: en Android se pone en horizontal y a pantalla completa (dentro del toque).
      // Máximo 1 s: la cámara no espera a que termine de girar
      await Promise.race([ponerHorizontal(), new Promise((r) => setTimeout(r, 1000))]);
      await pedirPermisoOrientacion();
      try {
        video = await abrirCamara();
      } catch {
        quitarHorizontal();
        soltarCandado();
        setError("Sin permiso de cámara no se pueden detectar baches. Actívalo en los ajustes del navegador o apaga “Buscar baches con la cámara”.");
        return;
      }
    }
    setStream(video);
    setBaches([]);
    if (video) {
      // La próxima vez abre directo en "Listo para medir"
      guardar("rc_medir_listo", "1");
      setListo(true);
      setVerPasos(false);
    }

    guardar("rc_vehiculo", vehiculo);
    guardar("rc_soporte", soporte);
    motor.current = new MotorRugosidad();
    sesion.current = crypto.randomUUID();
    cola.current = [];
    setTramos([]);
    setKmEnviados(0);
    setPausa(null);

    const alMover = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (a?.x == null || a.y == null || a.z == null) return;
      motor.current?.movimiento(a.x, a.y, a.z, e.timeStamp / 1000);
    };
    window.addEventListener("devicemotion", alMover);
    const vigia = navigator.geolocation.watchPosition(
      (p) => {
        motor.current?.posicion(p.coords.latitude, p.coords.longitude, p.coords.accuracy, p.coords.speed, p.timestamp / 1000);
        setEstado(motor.current?.estado() ?? null);
        setError(null);
      },
      (e) =>
        setError(
          e.code === e.PERMISSION_DENIED
            ? "Sin permiso de ubicación no se puede medir. Actívalo en los ajustes del navegador para este sitio."
            : "Buscando señal de GPS… si tarda, sal a un lugar despejado.",
        ),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    );

    // Pantalla encendida mientras mide (se vuelve a pedir al regresar a la página)
    let candado = await promesaCandado;
    setSinCandado(!candado);
    const pedirCandado = async () => {
      candado = await pedirPantallaEncendida();
      setSinCandado(!candado);
    };
    const alCambiarVisibilidad = () => {
      if (document.visibilityState === "hidden") {
        ocultoDesde.current = Date.now();
        liberarYEnviar(false);
      } else {
        if (ocultoDesde.current && Date.now() - ocultoDesde.current > 60_000) {
          setPausa(`La medición se pausó ${Math.round((Date.now() - ocultoDesde.current) / 60_000)} min mientras estuviste en otra app.`);
        }
        ocultoDesde.current = null;
        pedirCandado();
      }
    };
    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    const intervalo = setInterval(() => liberarYEnviar(false), ENVIO_CADA_MS);

    limpiar.current = () => {
      window.removeEventListener("devicemotion", alMover);
      navigator.geolocation.clearWatch(vigia);
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      clearInterval(intervalo);
      candado?.release().catch(() => {});
      video?.getTracks().forEach((t) => t.stop());
      if (video) quitarHorizontal();
    };
    setEstado(motor.current.estado());
    setFase("midiendo");
  }

  async function terminar() {
    // La cámara cierra los baches que tenía a la vista y envía lo pendiente
    const camaraLista = control.current?.terminar();
    limpiar.current();
    limpiar.current = () => {};
    setError(null);
    setFase("terminado");
    await Promise.all([liberarYEnviar(true), camaraLista]);
    // Un reintento más si quedó algo sin enviar
    if (cola.current.length) setTimeout(enviarCola, 5000);
  }

  const resumen = resumir(tramos);
  // Cada bache con lo que contestó el servidor (si ya se envió)
  const vistos: BacheSubido[] = baches.map((b) => {
    const r = resultados.get(b.clave);
    return r ? { ...b, enviado: true, nuevo: r.nuevo, publicado: !r.error && r.pin_id != null, calle: r.calle ?? null, prueba: !!r.prueba } : b;
  });
  const enElMapa = vistos.filter((b) => b.enviado && b.publicado).length;
  const avisoBuzon =
    buzon.problema === "sesion"
      ? `Tu sesión se cerró. ${buzon.pendientes} ${buzon.pendientes === 1 ? "bache quedó guardado" : "baches quedaron guardados"} en este celular: entra otra vez y se envían solos.`
      : buzon.problema === "sin-conexion" && buzon.pendientes > 0
        ? `Sin señal: ${buzon.pendientes} ${buzon.pendientes === 1 ? "bache guardado" : "baches guardados"} en este celular. Se envían solos cuando haya internet; no cierres la app.`
        : buzon.problema === "servidor" && buzon.pendientes > 0
          ? `El servidor no respondió. ${buzon.pendientes} ${buzon.pendientes === 1 ? "bache guardado" : "baches guardados"}: se reintenta solo.`
          : null;
  const tarjetaBuzon = (buzon.pendientes > 0 || avisoBuzon) && (
    <div className={`space-y-2 rounded-2xl px-4 py-3 text-[15px] ${avisoBuzon ? "bg-ios-naranja/12 text-[#c93400]" : "bg-white text-ios-secundario"}`}>
      <p>{avisoBuzon ?? `Enviando ${buzon.pendientes} ${buzon.pendientes === 1 ? "bache" : "baches"}…`}</p>
      {buzon.problema === "sesion" ? (
        <button onClick={() => window.location.assign("/medir")} className="boton boton-principal h-10 w-full text-[15px]">
          Entrar otra vez
        </button>
      ) : (
        avisoBuzon && (
          <button onClick={enviarYa} className="boton boton-tenue h-10 w-full text-[15px]">
            Reintentar ahora
          </button>
        )
      )}
    </div>
  );
  const kmMedidos = (estado?.distancia_m ?? 0) / 1000;
  // Con cámara: el equipo entró, la prendió y hay modelo
  const conCamara = puedeCamara && camara.activa && detector.info !== null;
  const preparando = conCamara && !detector.detector && !detector.error;
  const soportes = conCamara ? SOPORTES.filter(([k]) => k === "parabrisas" || k === "tablero") : SOPORTES;

  const revisada = revisadaHoy(camara);
  // Después de la primera vez con la cámara, la página abre directo en "Listo para medir"
  const modoRapido = puedeCamara && listo && !verPasos;

  const interruptorPrueba = (
    <div className={modoRapido ? "rounded-2xl bg-white" : "rounded-2xl bg-ios-fondo"}>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="text-[16px] font-medium leading-tight">
          Solo es prueba
          <span className="block text-[13px] font-normal text-ios-secundario">
            {conCamara ? "Los baches se guardan para revisarlos y no se publican" : "Para calibrar: misma calle, mismo carril, velocidad constante"}
          </span>
        </span>
        <Interruptor etiqueta="Recorrido de prueba" activo={esPrueba} onCambio={setEsPrueba} />
      </div>
      {esPrueba && (
        <div className="border-t border-ios-separador px-4 py-3">
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            maxLength={60}
            placeholder="Nota (opcional): Calle 300, carril derecho"
            aria-label="Nota del recorrido de prueba"
            className="w-full bg-transparent text-[16px] outline-none placeholder:text-ios-terciario"
          />
        </div>
      )}
    </div>
  );

  const botonEmpezar = (
    <div className="space-y-3">
      <button onClick={empezar} disabled={preparando} className="boton boton-principal h-14 w-full text-[18px] shadow-[0_8px_20px_rgba(0,122,255,0.25)]">
        {preparando ? "Preparando el detector…" : "Empezar a medir"}
      </button>
      {/* Que quede claro si se va a abrir la cámara o solo se medirán las calles */}
      <p
        className={`flex items-center justify-center gap-1.5 px-4 text-center text-[14px] font-medium ${
          conCamara && !detector.error ? "text-[#248a3d]" : "text-[#c93400]"
        }`}
      >
        {conCamara && !detector.error && (
          <svg width="18" height="16" viewBox="0 0 20 18" aria-hidden>
            <path d="M2 5.5h3.5L7.5 3h5l2 2.5H18v10H2z" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinejoin="round" />
            <circle cx="10" cy="10.2" r="3" stroke="currentColor" strokeWidth="1.8" fill="none" />
          </svg>
        )}
        {!puedeCamara
          ? "Sin entrar con tu código solo se mide el estado de las calles (sin cámara)."
          : !camara.activa
            ? `La cámara está apagada: solo se medirá el estado de las calles. Préndela en ${modoRapido ? "“Cambiar ajustes”" : "el paso 2"}.`
            : detector.error
              ? "El detector de baches no cargó. Recarga la página."
              : "Se abrirá la cámara para buscar baches."}
      </p>
      {historico > 0 && (
        <p className="text-center text-[15px] text-ios-secundario">
          Con este teléfono llevas <strong className="font-semibold text-ios-etiqueta">{historico.toFixed(1)} km</strong> medidos. ¡Gracias!
        </p>
      )}
      <p className="px-4 text-center text-[13px] text-ios-secundario">Deja esta página abierta. Si cambias de app o se apaga la pantalla, se pausa y sigue al volver.</p>
    </div>
  );

  return (
    <Pagina
      titulo={puedeCamara ? "Medir baches" : "Medir recorrido"}
      ancho="max-w-md"
      volver={fase === "midiendo" ? null : undefined}
      subtitulo={
        modoRapido
          ? undefined
          : conCamara
            ? "Maneja normal: tu celular encuentra los baches, los mide y los sube al mapa solo."
            : "Tu celular mide qué tan maltratadas están las calles mientras manejas. Es anónimo: no guardamos dónde empieza ni dónde termina tu viaje."
      }
    >
      {fase === "inicio" && (
        <>
          {tarjetaBuzon}
          {!puedeCamara && <EntrarEquipo error={errorEntrar} />}

          {modoRapido ? (
            <>
              <section className="rounded-3xl bg-white px-5 py-6 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/medir-192.png" alt="" className="mx-auto h-16 w-16 rounded-2xl" />
                <h2 className="mt-3 text-[26px] font-bold tracking-tight">Listo para medir</h2>
                <p className="mt-1 text-[15px] text-ios-secundario">
                  {sinEmoji(VEHICULOS.find(([k]) => k === vehiculo)?.[1] ?? "")} · {SOPORTES.find(([k]) => k === soporte)?.[1]} · altura{" "}
                  {(camara.alturaCm / 100).toFixed(2)} m
                </p>
                <p className={`mt-2 flex items-center justify-center gap-1.5 text-[15px] font-medium ${revisada ? "text-[#248a3d]" : "text-[#c93400]"}`}>
                  {revisada ? (
                    <>
                      <Palomita /> Cámara revisada hoy
                    </>
                  ) : (
                    "Revisa la cámara antes de arrancar"
                  )}
                </p>
                {voluntario && <p className="mt-2 text-[14px] text-ios-secundario">Entraste como voluntario. ¡Gracias por apoyar!</p>}
              </section>
              {botonEmpezar}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={async () => {
                    await pedirPermisoOrientacion();
                    setRevisando(true);
                  }}
                  className={`boton h-12 text-[16px] ${revisada ? "boton-gris" : "boton-tenue"}`}
                >
                  Revisar la cámara
                </button>
                <button onClick={() => setVerPasos(true)} className="boton boton-gris h-12 text-[16px]">
                  Cambiar ajustes
                </button>
              </div>
              {interruptorPrueba}
              {revisando && <RevisarCamara ajustes={camara} cambiar={cambiarCamara} onCerrar={() => setRevisando(false)} />}
            </>
          ) : (
            <>
              <Paso n={1} titulo="Coloca el celular">
                {conCamara && <DibujoParabrisas />}
                <p className="text-[15px] leading-snug text-ios-secundario">
                  {conCamara ? (
                    <>
                      <strong className="font-semibold text-ios-etiqueta">Acostado</strong>, en un soporte del parabrisas, con la cámara viendo la calle. Conéctalo al cargador.
                    </>
                  ) : (
                    <>
                      En un <strong className="font-semibold text-ios-etiqueta">soporte firme</strong> (no en el asiento ni en la mano). Conéctalo al cargador: el GPS gasta batería.
                    </>
                  )}
                </p>
                <Pregunta titulo="¿En qué vas?">
                  <Opciones opciones={VEHICULOS} valor={vehiculo} onCambio={setVehiculo} />
                </Pregunta>
                <Pregunta titulo="¿Dónde va el celular?">
                  <Opciones opciones={soportes} valor={soporte} onCambio={setSoporte} />
                </Pregunta>
              </Paso>

              {puedeCamara && (
                <Paso n={2} titulo="Revisa la cámara" listo={conCamara && revisada}>
                  {voluntario && <p className="text-[14px] text-ios-secundario">Entraste como voluntario. ¡Gracias por apoyar a Reporta Cajeme!</p>}
                  <PasoCamara ajustes={camara} cambiar={cambiarCamara} estado={detector} />
                </Paso>
              )}

              <Paso n={puedeCamara ? 3 : 2} titulo="Maneja">
                <p className="text-[15px] leading-snug text-ios-secundario">
                  Toca <strong className="font-semibold text-ios-etiqueta">Empezar a medir</strong> y acepta los permisos. Maneja normal: no tienes que tocar nada. Ya estacionado,
                  toca <strong className="font-semibold text-ios-etiqueta">Terminar</strong>.
                </p>
                {interruptorPrueba}
              </Paso>

              {botonEmpezar}
            </>
          )}

          {puedeCamara && <InstalarApp />}
          {equipo && <HerramientasEquipo ajustes={camara} cambiar={cambiarCamara} estado={detector} />}
        </>
      )}

      {fase === "midiendo" && (
        <>
          {stream && detector.detector ? (
            // Modo app: la cámara llena la pantalla; encima van los contadores y Terminar
            <CamaraBaches
              ref={control}
              completa
              stream={stream}
              detector={detector.detector}
              alturaM={camara.alturaCm / 100}
              fovLargo={camara.fov}
              abajoRespaldo={camara.abajo}
              sesion={sesion.current}
              plataforma={plataforma()}
              prueba={esPrueba ? nota.trim() || "Recorrido de prueba" : null}
              onBaches={setBaches}
            >
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-10">
                {[error, avisoBuzon, pausa, sinCandado && "La pantalla se puede apagar y la cámara se detendría: en Ajustes pon el bloqueo automático en “Nunca”."]
                  .filter((t): t is string => !!t)
                  .map((t) => (
                    <p key={t} className="mx-auto mb-2 max-w-md rounded-2xl bg-[#c93400]/90 px-3 py-2 text-center text-[13px] font-medium text-white">
                      {t}
                    </p>
                  ))}
                <div className="mx-auto flex max-w-3xl items-end justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {NIVELES_BACHE.map((n) => (
                      <span
                        key={n.clave}
                        aria-label={`${n.nombre}s`}
                        className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-[17px] font-semibold tabular-nums text-white backdrop-blur-sm"
                      >
                        <span className="h-3 w-3 rounded-full" style={{ background: n.color }} />
                        {vistos.filter((b) => nivelBache(b.area_m2)?.clave === n.clave).length}
                      </span>
                    ))}
                    <span className="rounded-full bg-black/60 px-3 py-1.5 text-[14px] font-medium tabular-nums text-white/90 backdrop-blur-sm">
                      {kmMedidos.toFixed(1)} km{esPrueba ? " · prueba" : enElMapa > 0 ? ` · ${enElMapa} en el mapa` : ""}
                    </span>
                  </div>
                  <BotonTerminar onTerminar={terminar} />
                </div>
              </div>
            </CamaraBaches>
          ) : (
            <>
              <div className="rounded-3xl bg-white px-5 py-6 text-center">
                <p className="flex items-center justify-center gap-2 text-[15px] font-medium text-ios-verde">
                  <Pulso />
                  Midiendo
                </p>
                <p className="mt-1 text-[64px] font-bold leading-none tracking-tight tabular-nums">
                  {kmMedidos.toFixed(1)}
                  <span className="ml-1 text-[28px] font-semibold text-ios-secundario">km</span>
                </p>
                <p className="mt-2 text-[15px] text-ios-secundario">Puedes seguir manejando. No necesitas tocar nada.</p>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <Dato titulo="Velocidad" valor={estado?.vel_kmh != null ? `${estado.vel_kmh} km/h` : "—"} />
                <Dato titulo="Enviado" valor={`${kmEnviados.toFixed(1)} km`} />
                <Dato titulo="GPS" valor={estado?.gps_ok ? "Bien" : "Buscando…"} color={estado?.gps_ok ? "#34c759" : "#ff9500"} />
              </div>
              {estado && estado.hz > 0 && estado.hz < 30 && (
                <Aviso>Tu celular lee pocos datos por segundo ({estado.hz}); los resultados serán menos precisos.</Aviso>
              )}
              {pausa && <Aviso>{pausa}</Aviso>}
              <Bloque sinRelleno nota="Los tramos aparecen unos minutos después: por privacidad se esperan unos 250 m antes de guardarlos.">
                <MiniMapa tramos={tramos} />
              </Bloque>
              <button onClick={terminar} className="boton boton-peligro h-14 w-full text-[18px]">
                Terminar (ya estacionado)
              </button>
            </>
          )}
        </>
      )}

      {fase === "terminado" && (
        <>
          {stream ? (
            <ResumenBaches baches={vistos} km={estado ? estado.distancia_m / 1000 : resumen.km} prueba={esPrueba} />
          ) : (
            <div className="rounded-3xl bg-white px-5 py-6 text-center">
              <p className="text-[15px] font-medium text-ios-verde">¡Gracias!</p>
              <p className="mt-1 text-[22px] font-bold leading-tight">Mediste {resumen.km.toFixed(1)} km de calles de Cajeme</p>
            </div>
          )}
          {tramos.length > 0 ? (
            <>
              <Bloque titulo={stream ? "Estado de las calles" : undefined} sinRelleno>
                <MiniMapa tramos={tramos} />
              </Bloque>
              <div className="grid grid-cols-3 gap-2.5">
                <Dato titulo="Buena" valor={pct(resumen.buena, resumen.km)} color={COLOR_CLASE.buena} />
                <Dato titulo="Regular" valor={pct(resumen.regular, resumen.km)} color={COLOR_CLASE.regular} />
                <Dato titulo="Mala" valor={pct(resumen.mala, resumen.km)} color={COLOR_CLASE.mala} />
              </div>
              <p className="px-4 text-[15px] text-ios-secundario">{resumen.golpes} golpes fuertes detectados (baches, topes o vados).</p>
              {estado && <NoMedido estado={estado} medidoKm={resumen.km} />}
            </>
          ) : (
            !stream && (
              <>
                <p className="px-4 text-[15px] text-ios-secundario">
                  No quedaron tramos para guardar. Pasa con recorridos de más de 1 km, a más de 15 km/h y sin muchas paradas.
                </p>
                {estado && <NoMedido estado={estado} medidoKm={0} />}
              </>
            )
          )}
          {avisoBuzon && tarjetaBuzon}
          <p className="px-4 text-center text-[15px] text-ios-secundario">
            {pendientesEnvio > 0 || buzon.pendientes > 0
              ? `Enviando ${[pendientesEnvio > 0 && `${pendientesEnvio} tramos`, buzon.pendientes > 0 && `${buzon.pendientes} baches`].filter(Boolean).join(" y ")}… deja la app abierta un momento.`
              : "✓ Todo enviado."}
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <Link href="/" className="boton boton-tenue">
              Ver el mapa
            </Link>
            <button onClick={() => setFase("inicio")} className="boton boton-gris">
              Medir otro
            </button>
          </div>
        </>
      )}

      {error && (
        <p role="alert" className="rounded-2xl bg-ios-rojo/10 px-4 py-3 text-[15px] text-ios-rojo">
          {error}
        </p>
      )}
    </Pagina>
  );
}

/** Para voluntarios y equipo: entrar con el código o la contraseña sin salir de esta página (después regresa aquí) */
function EntrarEquipo({ error }: { error: string | null }) {
  const [abrio, setAbierto] = useState(false);
  // Si regresó con error (contraseña incorrecta), el formulario queda abierto
  const abierto = abrio || !!error;
  return (
    <section className="rounded-3xl bg-white p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ios-azul/12 text-ios-azul" aria-hidden>
          <svg width="20" height="18" viewBox="0 0 20 18">
            <path d="M2 5.5h3.5L7.5 3h5l2 2.5H18v10H2z" stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinejoin="round" />
            <circle cx="10" cy="10.2" r="3" stroke="currentColor" strokeWidth="1.7" fill="none" />
          </svg>
        </span>
        <p className="min-w-0 flex-1 text-[15px] leading-snug">
          <strong className="font-semibold">¿Eres del equipo o voluntario?</strong>
          <span className="block text-ios-secundario">Entra para buscar baches con la cámara.</span>
        </p>
        {!abierto && (
          <button onClick={() => setAbierto(true)} className="boton boton-tenue min-h-9 shrink-0 rounded-full px-4 text-[15px]">
            Entrar
          </button>
        )}
      </div>
      {abierto && (
        <form action="/medir/entrar" method="post" className="mt-3 space-y-2.5">
          <input type="hidden" name="volver" value="/medir" />
          <label className="sr-only" htmlFor="clave-equipo">
            Código de voluntario o contraseña del equipo
          </label>
          <input
            id="clave-equipo"
            name="clave"
            type="password"
            required
            autoFocus={!error}
            autoComplete="current-password"
            placeholder="Contraseña del panel o código de voluntario"
            className="campo"
          />
          <p className="text-[13px] leading-snug text-ios-secundario">
            Equipo: la misma contraseña con la que entras al panel. Voluntarios: el código que te dio el equipo.
          </p>
          {error && <p className="text-[14px] text-ios-rojo">{error}</p>}
          <button className="boton boton-principal h-12 w-full">Entrar</button>
        </form>
      )}
      <Link href="/apoyar" className="mt-3 block text-[14px] text-ios-azul">
        ¿No tienes código? Así puedes apoyar →
      </Link>
    </section>
  );
}

/** Terminar con dos toques, para no cortar el recorrido con un toque sin querer */
function BotonTerminar({ onTerminar }: { onTerminar: () => void }) {
  const [seguro, setSeguro] = useState(false);
  useEffect(() => {
    if (!seguro) return;
    const t = setTimeout(() => setSeguro(false), 5000);
    return () => clearTimeout(t);
  }, [seguro]);
  return (
    <button
      onClick={() => (seguro ? onTerminar() : setSeguro(true))}
      className={`shrink-0 rounded-full px-5 py-3 text-[16px] font-semibold text-white shadow-lg transition-colors ${seguro ? "bg-[#b42318]" : "bg-ios-rojo"}`}
    >
      {seguro ? "¿Terminar? Toca otra vez" : "Terminar"}
    </button>
  );
}

type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Invita a instalar "Medir baches" en la pantalla de inicio (abre directo aquí, como una app) */
function InstalarApp() {
  const [tipo, setTipo] = useState<null | "android" | "ios" | "otro">(null);
  const [evento, setEvento] = useState<EventoInstalar | null>(null);
  const [pasos, setPasos] = useState(false);
  useEffect(() => {
    const instalada =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (instalada || leer("rc_medir_app_cerrado")) return;
    setTipo(/iphone|ipad|ipod/i.test(navigator.userAgent) ? "ios" : "otro");
    const alPoder = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoInstalar);
      setTipo("android");
    };
    window.addEventListener("beforeinstallprompt", alPoder);
    return () => window.removeEventListener("beforeinstallprompt", alPoder);
  }, []);
  if (!tipo) return null;
  const cerrar = () => {
    guardar("rc_medir_app_cerrado", "1");
    setTipo(null);
  };
  return (
    <section className="rounded-3xl bg-white p-4">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/medir-192.png" alt="" className="h-12 w-12 shrink-0 rounded-xl" />
        <p className="min-w-0 flex-1 text-[15px] leading-snug">
          <strong className="font-semibold">Instálala como app</strong>
          <span className="block text-ios-secundario">Un ícono “Medir baches” en tu pantalla de inicio: la abres y mides.</span>
        </p>
        <button
          onClick={async () => {
            if (tipo === "android" && evento) {
              await evento.prompt();
              if ((await evento.userChoice).outcome === "accepted") setTipo(null);
            } else setPasos((p) => !p);
          }}
          className="boton boton-tenue min-h-9 shrink-0 rounded-full px-4 text-[15px]"
        >
          {tipo === "android" ? "Instalar" : "Cómo"}
        </button>
      </div>
      {pasos && (
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[15px] leading-snug text-ios-secundario">
          {tipo === "ios" ? (
            <>
              <li>
                Toca <strong className="text-ios-etiqueta">Compartir</strong> (el cuadrito con la flecha hacia arriba).
              </li>
              <li>
                Elige <strong className="text-ios-etiqueta">Agregar a inicio</strong> y luego <strong className="text-ios-etiqueta">Agregar</strong>.
              </li>
            </>
          ) : (
            <>
              <li>
                Toca el menú <strong className="text-ios-etiqueta">⋮</strong> del navegador.
              </li>
              <li>
                Elige <strong className="text-ios-etiqueta">Instalar app</strong> o <strong className="text-ios-etiqueta">Agregar a la pantalla principal</strong>.
              </li>
            </>
          )}
          <li>Ábrela desde el ícono. La primera vez entra con tu contraseña o código.</li>
        </ol>
      )}
      <button onClick={cerrar} className="mt-2 text-[13px] text-ios-secundario">
        Ya la tengo / no gracias
      </button>
    </section>
  );
}

/** Tarjeta de un paso numerado; se marca con palomita cuando ya está listo */
function Paso({ n, titulo, listo = false, children }: { n: number; titulo: string; listo?: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-4" aria-label={`Paso ${n}: ${titulo}`}>
      <div className="flex items-center gap-3">
        <span
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[15px] font-bold text-white ${listo ? "bg-ios-verde" : "bg-ios-azul"}`}
          aria-hidden
        >
          {listo ? <Palomita /> : n}
        </span>
        <h2 className="text-[20px] font-semibold tracking-tight">{titulo}</h2>
        {listo && <span className="sr-only">(listo)</span>}
      </div>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function Pregunta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[13px] font-medium uppercase tracking-wide text-ios-secundario">{titulo}</p>
      {children}
    </div>
  );
}

function Pulso() {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ios-verde opacity-60 motion-reduce:hidden" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-ios-verde" />
    </span>
  );
}

/** Cuántos baches de cada tamaño: chico (verde), mediano (amarillo), grande (rojo) */
function Contadores({ baches }: { baches: BacheSubido[] }) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {NIVELES_BACHE.map((n) => (
        <div key={n.clave} className="rounded-2xl bg-white px-2 py-3 text-center">
          <div className="text-[30px] font-bold leading-none tabular-nums">{baches.filter((b) => nivelBache(b.area_m2)?.clave === n.clave).length}</div>
          <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[13px] font-medium text-ios-secundario">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: n.color }} />
            {n.nombre}s
          </div>
        </div>
      ))}
    </div>
  );
}

/** Lo que encontró la cámara en el recorrido, de los más grandes a los más chicos */
function ResumenBaches({ baches, km, prueba }: { baches: BacheSubido[]; km: number; prueba: boolean }) {
  const nuevos = baches.filter((b) => b.nuevo).length;
  const yaEstaban = baches.filter((b) => b.enviado && !b.nuevo && !b.prueba && b.publicado !== false).length;
  const noSubidos = baches.filter((b) => b.publicado === false).length;
  const ordenados = [...baches].sort((a, b) => (b.area_m2 ?? -1) - (a.area_m2 ?? -1));
  const resumen = prueba
    ? "Recorrido de prueba: se guardaron para revisarlos y no se publicaron en el mapa."
    : [nuevos > 0 && `${nuevos} nuevos en el mapa`, yaEstaban > 0 && `${yaEstaban} ya estaban reportados (se sumó tu pasada)`, noSubidos > 0 && `${noSubidos} no se pudieron medir`]
        .filter(Boolean)
        .join(" · ");
  return (
    <>
      <div className="rounded-3xl bg-white px-5 py-6 text-center">
        <p className="text-[15px] font-medium text-ios-verde">¡Listo!</p>
        <p className="mt-1 text-[56px] font-bold leading-none tracking-tight tabular-nums">{baches.length}</p>
        <p className="mt-1 text-[19px] font-semibold">{baches.length === 1 ? "bache encontrado" : "baches encontrados"}</p>
        <p className="mt-1 text-[15px] text-ios-secundario">
          en {km.toFixed(1)} km{prueba ? " · recorrido de prueba" : ""}
        </p>
      </div>
      <Contadores baches={baches} />
      {baches.length > 0 && (
        <Bloque
          titulo="Lo que encontró la cámara"
          sinRelleno
          nota={
            <>
              {resumen && <span className="block">{resumen}</span>}
              Chico: {NIVELES_BACHE[0].rango} · Mediano: {NIVELES_BACHE[1].rango} · Grande: {NIVELES_BACHE[2].rango}.
            </>
          }
        >
          {ordenados.slice(0, 40).map((b, i) => {
            const n = nivelBache(b.area_m2);
            const [texto, clase] = !b.enviado
              ? ["Enviando…", "bg-ios-relleno text-ios-secundario"]
              : b.prueba
                ? ["Prueba", "bg-ios-naranja/15 text-[#c93400]"]
                : b.publicado === false
                  ? ["No se subió", "bg-ios-relleno text-ios-secundario"]
                  : b.nuevo
                    ? ["Nuevo", "bg-ios-verde/15 text-[#248a3d]"]
                    : ["Ya estaba", "bg-ios-azul/12 text-ios-azul"];
            return (
              <a
                key={i}
                href={`https://www.google.com/maps?q=${b.lat.toFixed(6)},${b.lng.toFixed(6)}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 border-b border-ios-separador px-4 py-3 last:border-0"
              >
                <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: n?.color ?? "#d1d1d6" }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-medium">
                    {n ? `Bache ${n.nombre.toLowerCase()}` : "Bache sin medir"}
                    {b.area_m2 != null && <span className="font-normal text-ios-secundario"> · {b.area_m2.toFixed(2)} m²</span>}
                  </span>
                  {b.calle && <span className="block truncate text-[13px] text-ios-secundario">{b.calle}</span>}
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${clase}`}>{texto}</span>
              </a>
            );
          })}
        </Bloque>
      )}
    </>
  );
}

/** Selección de una opción con píldoras */
function Opciones<T extends string>({ opciones, valor, onCambio }: { opciones: [T, string][]; valor: T; onCambio: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {opciones.map(([v, t]) => (
        <button
          key={v}
          aria-pressed={valor === v}
          onClick={() => onCambio(v)}
          className={`rounded-full px-3.5 py-2 text-[15px] transition ${valor === v ? "bg-ios-azul font-semibold text-white" : "bg-ios-relleno"}`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl bg-ios-naranja/12 px-4 py-3 text-[15px] text-[#c93400]">{children}</p>;
}

/** Por qué una parte del recorrido no quedó medida */
function NoMedido({ estado, medidoKm }: { estado: EstadoMedicion; medidoKm: number }) {
  const d = estado.descartes;
  const km = (m: number) => `${(m / 1000).toFixed(1)} km`;
  const filas = [
    d.privacidad_m > 0 && `${km(d.privacidad_m)} recortados por privacidad (inicio, final y paradas de más de 2 min)`,
    d.lento_m > 0 && `${km(d.lento_m)} a vuelta de rueda o detenido`,
    d.rapido_m > 0 && `${km(d.rapido_m)} a más de 80 km/h`,
    d.gps_debil_s >= 30 && `${Math.round(d.gps_debil_s / 60) || 1} min con señal de GPS débil`,
    d.cortes > 0 && `${d.cortes} ${d.cortes === 1 ? "pausa" : "pausas"} por cambiar de app o apagar la pantalla`,
  ].filter(Boolean);
  if (filas.length === 0) return null;
  return (
    <div className="rounded-2xl bg-white px-4 py-3.5 text-[15px] text-ios-secundario">
      <p className="font-semibold text-ios-etiqueta">
        Recorriste {km(estado.distancia_m)} y se midieron {medidoKm.toFixed(1)} km. Lo que no se midió:
      </p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {filas.map((f) => (
          <li key={String(f)}>{f}</li>
        ))}
      </ul>
    </div>
  );
}

const pct = (a: number, t: number) => (t > 0 ? `${Math.round((a / t) * 100)}%` : "—");

function Dato({ titulo, valor, color }: { titulo: string; valor: string; color?: string }) {
  return (
    <div className="rounded-2xl bg-white px-3 py-3">
      <div className="flex items-center gap-1.5 text-[13px] text-ios-secundario">
        {color && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
        {titulo}
      </div>
      <div className="mt-0.5 text-[20px] font-semibold tabular-nums">{valor}</div>
    </div>
  );
}

/** Dibujo simple del recorrido medido, coloreado por estado */
function MiniMapa({ tramos }: { tramos: Tramo[] }) {
  const pts = tramos.flatMap((t) => t.puntos);
  if (pts.length < 2) {
    return <div className="grid h-48 place-items-center text-[15px] text-ios-terciario">El recorrido aparecerá aquí</div>;
  }
  const lats = pts.map((p) => p[0]);
  const lngs = pts.map((p) => p[1]);
  const [la0, la1, lo0, lo1] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const k = Math.cos((((la0 + la1) / 2) * Math.PI) / 180);
  const s = Math.min(300 / Math.max((lo1 - lo0) * k, 1e-6), 180 / Math.max(la1 - la0, 1e-6));
  const xy = ([lat, lng]: [number, number]) => [10 + (lng - lo0) * k * s, 190 - (lat - la0) * s] as const;
  return (
    <svg viewBox="0 0 320 200" role="img" aria-label="Recorrido coloreado por estado de la calle" className="w-full bg-white">
      {tramos.map((t, i) => (
        <polyline
          key={i}
          points={t.puntos.map((p) => xy(p).join(",")).join(" ")}
          fill="none"
          stroke={COLOR_CLASE[clasificar(t.rms)]}
          strokeWidth={5}
          strokeLinecap="round"
        />
      ))}
      {tramos.flatMap((t, i) =>
        t.golpes.map((g, j) => {
          const [x, y] = xy(g);
          return <circle key={`${i}-${j}`} cx={x} cy={y} r={3.5} fill="#111827" />;
        }),
      )}
    </svg>
  );
}
