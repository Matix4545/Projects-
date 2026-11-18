"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { NIVELES_BACHE, nivelBache } from "@/lib/constantes";
import { COLOR_CLASE, MotorRugosidad, clasificar, resumir, type EstadoMedicion, type Tramo } from "@/lib/rugosidad";
import { HerramientasEquipo, Palomita, PasoCamara, abrirCamara, pedirPermisoOrientacion, revisadaHoy, useAjustesCamara, useDetector } from "./AjustesCamara";
import { CamaraBaches, type BacheSubido, type ControlCamara } from "./CamaraBaches";
import { Interruptor } from "./Interruptor";
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
  // Baches con la cámara: solo para el equipo (entró con la contraseña del panel)
  const [equipo, setEquipo] = useState(false);
  const [camara, cambiarCamara] = useAjustesCamara(vehiculo);
  const detector = useDetector(equipo && camara.activa);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [baches, setBaches] = useState<BacheSubido[]>([]);
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
    fetch("/api/equipo/sesion")
      .then((r) => r.json())
      .then((r: { equipo?: boolean }) => setEquipo(!!r.equipo))
      .catch(() => {});
    return () => limpiar.current();
  }, []);

  // Con la cámara el celular va en el parabrisas (o el tablero): se ajusta solo
  const camaraPrendida = equipo && camara.activa && detector.info !== null;
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
    setError(null);
    try {
      // En iPhone el permiso del acelerómetro se pide dentro del toque
      const DME = (window as unknown as { DeviceMotionEvent?: { requestPermission?: () => Promise<string> } }).DeviceMotionEvent;
      if (!DME) throw new Error("Este navegador no tiene acceso al acelerómetro.");
      if (typeof DME.requestPermission === "function" && (await DME.requestPermission()) !== "granted") {
        throw new Error("Sin permiso de movimiento no se puede medir. Acéptalo e intenta de nuevo.");
      }
      if (!("geolocation" in navigator)) throw new Error("Este navegador no tiene GPS.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar.");
      return;
    }

    // Cámara para los baches (si está activa y el detector ya está listo)
    let video: MediaStream | null = null;
    if (equipo && camara.activa && detector.detector) {
      await pedirPermisoOrientacion();
      try {
        video = await abrirCamara();
      } catch {
        setError("Sin permiso de cámara no se pueden detectar baches. Actívalo en los ajustes del navegador o apaga “Detectar baches”.");
        return;
      }
    }
    setStream(video);
    setBaches([]);

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

    // Pantalla encendida mientras mide
    let candado: { release: () => Promise<void> } | null = null;
    const pedirCandado = async () => {
      try {
        candado =
          (await (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request(
            "screen",
          )) ?? null;
      } catch {
        /* sin bloqueo de pantalla: hay que dejarla encendida */
      }
    };
    await pedirCandado();
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
  const bachesEnviados = baches.filter((b) => b.enviado).length;
  const enElMapa = baches.filter((b) => b.enviado && b.publicado !== false).length;
  const kmMedidos = (estado?.distancia_m ?? 0) / 1000;
  // Con cámara: el equipo entró, la prendió y hay modelo
  const conCamara = equipo && camara.activa && detector.info !== null;
  const preparando = conCamara && !detector.detector && !detector.error;
  const soportes = conCamara ? SOPORTES.filter(([k]) => k === "parabrisas" || k === "tablero") : SOPORTES;

  return (
    <Pagina
      titulo="Medir recorrido"
      ancho="max-w-md"
      accion={<span className="rounded-full bg-ios-naranja/15 px-2.5 py-1 text-xs font-semibold text-[#c93400]">En prueba</span>}
      subtitulo={
        conCamara
          ? "Maneja normal: tu celular encuentra los baches, los mide y los sube al mapa solo."
          : "Tu celular mide qué tan maltratadas están las calles mientras manejas. Es anónimo: no guardamos dónde empieza ni dónde termina tu viaje."
      }
    >
      {fase === "inicio" && (
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

          {equipo && (
            <Paso n={2} titulo="Revisa la cámara" listo={conCamara && revisadaHoy(camara)}>
              <PasoCamara ajustes={camara} cambiar={cambiarCamara} estado={detector} />
            </Paso>
          )}

          <Paso n={equipo ? 3 : 2} titulo="Maneja">
            <p className="text-[15px] leading-snug text-ios-secundario">
              Toca <strong className="font-semibold text-ios-etiqueta">Empezar a medir</strong> y acepta los permisos. Maneja normal: no tienes que tocar nada. Ya estacionado, toca{" "}
              <strong className="font-semibold text-ios-etiqueta">Terminar</strong>.
            </p>
            <div className="rounded-2xl bg-ios-fondo">
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
          </Paso>

          <div className="space-y-3">
            <button onClick={empezar} disabled={preparando} className="boton boton-principal h-14 w-full text-[18px] shadow-[0_8px_20px_rgba(0,122,255,0.25)]">
              {preparando ? "Preparando el detector…" : "Empezar a medir"}
            </button>
            {historico > 0 && (
              <p className="text-center text-[15px] text-ios-secundario">
                Con este teléfono llevas <strong className="font-semibold text-ios-etiqueta">{historico.toFixed(1)} km</strong> medidos. ¡Gracias!
              </p>
            )}
            <p className="px-4 text-center text-[13px] text-ios-secundario">Deja esta página abierta. Si cambias de app o se apaga la pantalla, se pausa y sigue al volver.</p>
          </div>

          {equipo && <HerramientasEquipo ajustes={camara} cambiar={cambiarCamara} estado={detector} />}
        </>
      )}

      {fase === "midiendo" && (
        <>
          {stream && detector.detector && (
            <>
              <CamaraBaches
                ref={control}
                stream={stream}
                detector={detector.detector}
                alturaM={camara.alturaCm / 100}
                fovLargo={camara.fov}
                abajoRespaldo={camara.abajo}
                sesion={sesion.current}
                plataforma={plataforma()}
                prueba={esPrueba ? nota.trim() || "Recorrido de prueba" : null}
                onBaches={setBaches}
              />
              <Contadores baches={baches} />
              <p className="px-1 text-center text-[14px] text-ios-secundario">
                {baches.length === 0
                  ? "Los baches que encuentre aparecen aquí."
                  : `${baches.length} ${baches.length === 1 ? "bache" : "baches"} · ${
                      esPrueba ? "se guardan para revisar (prueba)" : enElMapa > 0 ? `${enElMapa} ya en el mapa` : "se suben solos"
                    }`}
              </p>
            </>
          )}
          {stream ? (
            <div className="flex items-center justify-between gap-2 rounded-2xl bg-white px-4 py-3 text-[15px]">
              <span className="flex items-center gap-2 font-medium text-ios-verde">
                <Pulso />
                Midiendo
              </span>
              <span className="font-semibold tabular-nums">{kmMedidos.toFixed(1)} km</span>
              <span className="tabular-nums text-ios-secundario">{estado?.vel_kmh != null ? `${estado.vel_kmh} km/h` : "— km/h"}</span>
              <span className={estado?.gps_ok ? "text-ios-verde" : "text-[#c93400]"}>{estado?.gps_ok ? "GPS bien" : "GPS…"}</span>
            </div>
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
            </>
          )}
          {estado && estado.hz > 0 && estado.hz < 30 && (
            <Aviso>Tu celular lee pocos datos por segundo ({estado.hz}); los resultados serán menos precisos.</Aviso>
          )}
          {pausa && <Aviso>{pausa}</Aviso>}
          {!stream && (
            <Bloque sinRelleno nota="Los tramos aparecen unos minutos después: por privacidad se esperan unos 250 m antes de guardarlos.">
              <MiniMapa tramos={tramos} />
            </Bloque>
          )}
          <button onClick={terminar} className="boton boton-peligro h-14 w-full text-[18px]">
            Terminar (ya estacionado)
          </button>
        </>
      )}

      {fase === "terminado" && (
        <>
          {stream ? (
            <ResumenBaches baches={baches} km={estado ? estado.distancia_m / 1000 : resumen.km} prueba={esPrueba} />
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
          <p className="px-4 text-center text-[15px] text-ios-secundario">
            {pendientesEnvio > 0 || baches.length > bachesEnviados
              ? `Enviando ${[pendientesEnvio > 0 && `${pendientesEnvio} tramos`, baches.length > bachesEnviados && `${baches.length - bachesEnviados} baches`].filter(Boolean).join(" y ")}… deja la página abierta un momento.`
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

/** Cómo va el celular: acostado en el parabrisas, viendo la calle */
function DibujoParabrisas() {
  return (
    <svg viewBox="0 0 320 132" role="img" aria-label="Celular acostado en el parabrisas, viendo la calle" className="block w-full">
      <defs>
        <clipPath id="parabrisas">
          <rect width="320" height="132" rx="18" />
        </clipPath>
        <linearGradient id="cielo" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#cfe3fb" />
          <stop offset="1" stopColor="#eef5fd" />
        </linearGradient>
      </defs>
      <g clipPath="url(#parabrisas)">
        <rect width="320" height="132" fill="url(#cielo)" />
        <rect y="70" width="320" height="62" fill="#e4e1d9" />
        <path d="M44 132 L150 70 L170 70 L276 132 Z" fill="#9a9aa0" />
        <path d="M160 74 V132" stroke="#ffffff" strokeWidth="2.5" strokeDasharray="7 8" />
        <ellipse cx="194" cy="96" rx="9" ry="3.2" fill="#48484a" />
        <path d="M0 0 H320 V9 H0 Z" fill="#2c2c2e" />
        <path d="M0 0 L30 0 L6 132 L0 132 Z" fill="#2c2c2e" />
        <path d="M320 0 L290 0 L314 132 L320 132 Z" fill="#2c2c2e" />
        <rect x="138" y="8" width="44" height="13" rx="5" fill="#3a3a3c" />
        <path d="M0 132 V118 Q160 100 320 118 V132 Z" fill="#3a3a3c" />
        <circle cx="160" cy="79" r="6" fill="#48484a" />
        <rect x="156" y="79" width="8" height="10" fill="#48484a" />
        <rect x="116" y="86" width="88" height="42" rx="8" fill="#1c1c1e" />
        <rect x="121" y="90" width="78" height="34" rx="4" fill="#cfe3fb" />
        <path d="M121 108 H199 V124 H121 Z" fill="#e4e1d9" />
        <path d="M128 124 L157 108 L163 108 L192 124 Z" fill="#9a9aa0" />
        <path d="M136 120 L155 110 L165 110 L184 120 Z" fill="#34c759" fillOpacity="0.55" />
        <ellipse cx="166" cy="116" rx="5" ry="1.8" fill="#facc15" stroke="#1c1c1e" strokeWidth="0.6" />
      </g>
      <rect x="0.5" y="0.5" width="319" height="131" rx="17.5" fill="none" stroke="rgba(0,0,0,0.06)" />
    </svg>
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
