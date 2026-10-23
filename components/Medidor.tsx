"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { COLOR_CLASE, MotorRugosidad, clasificar, resumir, type EstadoMedicion, type Tramo } from "@/lib/rugosidad";
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
          hz: motor.current?.hz,
          tramos: lote.map(({ puntos, largo_m, vel_kmh, rms, golpes }) => ({ puntos, largo_m, vel_kmh, rms, golpes })),
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
    <main className="mx-auto min-h-dvh max-w-md bg-white px-5 pb-10 pt-6 text-gray-900">
      <div className="flex items-center justify-between text-sm">
        <Link href="/" className="font-semibold text-blue-700 underline">
          ← Mapa
        </Link>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">En prueba</span>
      </div>
      <h1 className="mt-3 text-2xl font-extrabold">Medir mi recorrido</h1>
      <p className="mt-1 text-gray-600">
        Tu celular mide qué tan maltratadas están las calles mientras manejas. Es anónimo: no guardamos dónde empieza ni
        dónde termina tu viaje, ni dónde te detienes.
      </p>

      {fase === "inicio" && (
        <section className="mt-5 space-y-5">
          <div>
            <p className="mb-2 text-sm font-semibold text-gray-500">¿En qué vas a manejar?</p>
            <div className="flex flex-wrap gap-2">
              {VEHICULOS.map(([v, t]) => (
                <button
                  key={v}
                  aria-pressed={vehiculo === v}
                  onClick={() => setVehiculo(v)}
                  className={`rounded-full px-3 py-2 text-sm font-semibold ${vehiculo === v ? "bg-blue-700 text-white" : "bg-gray-100 text-gray-700"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <ol className="list-decimal space-y-1.5 pl-5 text-[15px]">
            <li>
              Pon el celular en un <strong>soporte firme</strong> antes de arrancar (no en el asiento ni en la mano).
            </li>
            <li>
              Conéctalo al <strong>cargador</strong>: medir con GPS gasta batería.
            </li>
            <li>
              Toca <strong>Empezar a medir</strong> y acepta ubicación y movimiento.
            </li>
            <li>
              Maneja normal y <strong>deja esta página abierta</strong>. Se envía sola cada 5 minutos.
            </li>
            <li>
              Al terminar tu día, toca <strong>Terminar</strong> (ya estacionado).
            </li>
          </ol>
          <button onClick={empezar} className="w-full rounded-2xl bg-blue-700 py-4 text-xl font-extrabold text-white active:scale-95">
            Empezar a medir
          </button>
          {historico > 0 && (
            <p className="text-center text-sm text-gray-500">
              Con este teléfono llevas <strong>{historico.toFixed(1)} km</strong> medidos. ¡Gracias!
            </p>
          )}
          <p className="text-xs text-gray-400">
            Si cambias a otra app (WhatsApp, Uber, Maps) o se apaga la pantalla, la medición se pausa y sigue al volver.
          </p>
        </section>
      )}

      {fase === "midiendo" && (
        <section className="mt-5 space-y-4">
          <div className="rounded-2xl bg-blue-700 p-5 text-center text-white">
            <p className="text-sm opacity-80">Midiendo</p>
            <p className="text-5xl font-extrabold tabular-nums">{kmMedidos.toFixed(1)} km</p>
            <p className="mt-1 text-sm opacity-90">Puedes seguir manejando. No necesitas tocar nada.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <Dato titulo="Velocidad" valor={estado?.vel_kmh != null ? `${estado.vel_kmh} km/h` : "—"} />
            <Dato titulo="Enviado" valor={`${kmEnviados.toFixed(1)} km`} />
            <Dato titulo="GPS" valor={estado?.gps_ok ? "✓ Bien" : "Buscando…"} />
          </div>
          {estado && estado.hz > 0 && estado.hz < 30 && (
            <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
              Tu celular lee pocos datos por segundo ({estado.hz}); los resultados serán menos precisos.
            </p>
          )}
          {pausa && <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">{pausa}</p>}
          <MiniMapa tramos={tramos} />
          <p className="text-xs text-gray-400">
            Los tramos aparecen unos minutos después: por privacidad se esperan 300 m antes de guardarlos.
          </p>
          <button onClick={terminar} className="w-full rounded-2xl bg-red-600 py-4 text-lg font-extrabold text-white active:scale-95">
            Terminar (ya estacionado)
          </button>
        </section>
      )}

      {fase === "terminado" && (
        <section className="mt-5 space-y-4">
          <p className="text-xl font-bold">¡Gracias! Mediste {resumen.km.toFixed(1)} km de calles de Cajeme.</p>
          {tramos.length > 0 ? (
            <>
              <MiniMapa tramos={tramos} />
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <Dato titulo="Buena" valor={pct(resumen.buena, resumen.km)} color={COLOR_CLASE.buena} />
                <Dato titulo="Regular" valor={pct(resumen.regular, resumen.km)} color={COLOR_CLASE.regular} />
                <Dato titulo="Mala" valor={pct(resumen.mala, resumen.km)} color={COLOR_CLASE.mala} />
              </div>
              <p className="text-sm text-gray-600">{resumen.golpes} golpes fuertes detectados (baches, topes o vados).</p>
            </>
          ) : (
            <p className="text-gray-600">
              No quedaron tramos para guardar. Pasa con recorridos de más de 1 km, a más de 15 km/h y sin muchas paradas.
            </p>
          )}
          <p className="text-sm text-gray-500">
            {pendientesEnvio > 0 ? `Enviando ${pendientesEnvio} tramos… deja la página abierta un momento.` : "✓ Todo enviado."}
          </p>
          <button onClick={() => setFase("inicio")} className="w-full rounded-2xl bg-gray-100 py-3 font-bold text-gray-800">
            Medir otro recorrido
          </button>
        </section>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
    </main>
  );
}

const pct = (a: number, t: number) => (t > 0 ? `${Math.round((a / t) * 100)}%` : "—");

function Dato({ titulo, valor, color }: { titulo: string; valor: string; color?: string }) {
  return (
    <div className="rounded-xl bg-gray-100 px-2 py-2" style={color ? { borderTop: `4px solid ${color}` } : undefined}>
      <div className="text-xs text-gray-500">{titulo}</div>
      <div className="font-bold tabular-nums">{valor}</div>
    </div>
  );
}

/** Dibujo simple del recorrido medido, coloreado por estado */
function MiniMapa({ tramos }: { tramos: Tramo[] }) {
  const pts = tramos.flatMap((t) => t.puntos);
  if (pts.length < 2) {
    return <div className="grid h-48 place-items-center rounded-xl bg-gray-100 text-sm text-gray-500">El recorrido aparecerá aquí</div>;
  }
  const lats = pts.map((p) => p[0]);
  const lngs = pts.map((p) => p[1]);
  const [la0, la1, lo0, lo1] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const k = Math.cos((((la0 + la1) / 2) * Math.PI) / 180);
  const s = Math.min(300 / Math.max((lo1 - lo0) * k, 1e-6), 180 / Math.max(la1 - la0, 1e-6));
  const xy = ([lat, lng]: [number, number]) => [10 + (lng - lo0) * k * s, 190 - (lat - la0) * s] as const;
  return (
    <svg viewBox="0 0 320 200" role="img" aria-label="Recorrido coloreado por estado de la calle" className="w-full rounded-xl bg-gray-100">
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
