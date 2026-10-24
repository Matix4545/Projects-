"use client";

import { useEffect, useRef, useState } from "react";
import { COLOR_CLASE, MotorRugosidad, clasificar, resumir, type EstadoMedicion, type Tramo } from "@/lib/rugosidad";
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
    return () => limpiar.current();
  }, []);

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
    };
    setEstado(motor.current.estado());
    setFase("midiendo");
  }

  async function terminar() {
    limpiar.current();
    limpiar.current = () => {};
    setError(null);
    setFase("terminado");
    await liberarYEnviar(true);
    // Un reintento más si quedó algo sin enviar
    if (cola.current.length) setTimeout(enviarCola, 5000);
  }

  const resumen = resumir(tramos);
  const kmMedidos = (estado?.distancia_m ?? 0) / 1000;

  return (
    <Pagina
      titulo="Medir recorrido"
      ancho="max-w-md"
      accion={<span className="rounded-full bg-ios-naranja/15 px-2.5 py-1 text-xs font-semibold text-[#c93400]">En prueba</span>}
      subtitulo="Tu celular mide qué tan maltratadas están las calles mientras manejas. Es anónimo: no guardamos dónde empieza ni dónde termina tu viaje, ni dónde te detienes."
    >
      {fase === "inicio" && (
        <>
          <Bloque titulo="¿En qué vas a manejar?">
            <Opciones opciones={VEHICULOS} valor={vehiculo} onCambio={setVehiculo} />
          </Bloque>
          <Bloque titulo="¿Dónde va el celular?">
            <Opciones opciones={SOPORTES} valor={soporte} onCambio={setSoporte} />
          </Bloque>
          <Bloque titulo="Antes de empezar" sinRelleno>
            {[
              <>Pon el celular en un <strong className="font-semibold">soporte firme</strong> (no en el asiento ni en la mano).</>,
              <>Conéctalo al <strong className="font-semibold">cargador</strong>: medir con GPS gasta batería.</>,
              <>Toca <strong className="font-semibold">Empezar a medir</strong> y acepta ubicación y movimiento.</>,
              <>Maneja normal y <strong className="font-semibold">deja esta página abierta</strong>. Se envía sola cada 5 minutos.</>,
              <>Al terminar tu día, ya estacionado, toca <strong className="font-semibold">Terminar</strong>.</>,
            ].map((texto, n) => (
              <div key={n} className="flex gap-3 px-4 py-3 text-[15px] leading-snug">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ios-azul text-[13px] font-semibold text-white">{n + 1}</span>
                <span>{texto}</span>
              </div>
            ))}
          </Bloque>
          <Bloque
            sinRelleno
            nota={esPrueba ? "Para calibrar: misma calle, mismo carril, velocidad constante. No pongas datos personales." : undefined}
          >
            <div className="flex items-center justify-between px-4 py-2.5 text-[16px]">
              Recorrido de prueba
              <Interruptor etiqueta="Recorrido de prueba" activo={esPrueba} onCambio={setEsPrueba} />
            </div>
            {esPrueba && (
              <div className="px-4 py-2.5">
                <input
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  maxLength={60}
                  placeholder="Ej. Calle 300 a 40 km/h, carril derecho"
                  className="w-full bg-transparent text-[16px] outline-none placeholder:text-ios-terciario"
                />
              </div>
            )}
          </Bloque>
          <div className="space-y-3">
            <button onClick={empezar} className="boton boton-principal h-14 w-full text-[18px]">
              Empezar a medir
            </button>
            {historico > 0 && (
              <p className="text-center text-[15px] text-ios-secundario">
                Con este teléfono llevas <strong className="font-semibold text-ios-etiqueta">{historico.toFixed(1)} km</strong> medidos. ¡Gracias!
              </p>
            )}
            <p className="px-4 text-center text-[13px] text-ios-secundario">
              Si cambias a otra app (WhatsApp, Uber, Maps) o se apaga la pantalla, la medición se pausa y sigue al volver.
            </p>
          </div>
        </>
      )}

      {fase === "midiendo" && (
        <>
          <div className="rounded-3xl bg-white px-5 py-6 text-center">
            <p className="flex items-center justify-center gap-2 text-[15px] font-medium text-ios-verde">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ios-verde opacity-60 motion-reduce:hidden" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-ios-verde" />
              </span>
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

      {fase === "terminado" && (
        <>
          <div className="rounded-3xl bg-white px-5 py-6 text-center">
            <p className="text-[15px] font-medium text-ios-verde">¡Gracias!</p>
            <p className="mt-1 text-[22px] font-bold leading-tight">Mediste {resumen.km.toFixed(1)} km de calles de Cajeme</p>
          </div>
          {tramos.length > 0 ? (
            <>
              <Bloque sinRelleno>
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
            <>
              <p className="px-4 text-[15px] text-ios-secundario">
                No quedaron tramos para guardar. Pasa con recorridos de más de 1 km, a más de 15 km/h y sin muchas paradas.
              </p>
              {estado && <NoMedido estado={estado} medidoKm={0} />}
            </>
          )}
          <p className="px-4 text-[15px] text-ios-secundario">
            {pendientesEnvio > 0 ? `Enviando ${pendientesEnvio} tramos… deja la página abierta un momento.` : "✓ Todo enviado."}
          </p>
          <button onClick={() => setFase("inicio")} className="boton boton-tenue w-full">
            Medir otro recorrido
          </button>
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
