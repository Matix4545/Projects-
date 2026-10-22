"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  INFO_PIN,
  PERIODOS,
  PERIODO_PREDETERMINADO,
  TIPOS_PIN,
  dentroDeCajeme,
  type EstadoAgua,
  type HorasPeriodo,
  type TipoPin,
} from "@/lib/constantes";
import {
  cargarMapa,
  cargarRuta,
  cargarZonasCache,
  type EstadoZona,
  type Pin,
  type Resumen,
  type ZonasGeoJSON,
} from "@/lib/datos";
import { BarraResumen } from "./BarraResumen";
import { FILTROS_INICIALES, Filtros, filtrarPins, type FiltrosMapa } from "./Filtros";
import { FlujoReporte, type EstadoTramo, type OrigenUbicacion } from "./FlujoReporte";
import { Leyenda } from "./Leyenda";
import type { Capas } from "./Mapa";
import { PanelPin } from "./PanelPin";
import { PanelZona } from "./PanelZona";

// Leaflet necesita "window", así que el mapa solo se carga en el navegador
const Mapa = dynamic(() => import("./Mapa"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center bg-gray-100 text-gray-500">Cargando mapa…</div>,
});

type Vista = { tipo: "nada" } | { tipo: "zona"; id: number } | { tipo: "pin"; pin: Pin } | { tipo: "reporte" };

const RECARGA_MS = 60_000;

export function App() {
  const [zonas, setZonas] = useState<ZonasGeoJSON | null>(null);
  const [estados, setEstados] = useState<EstadoZona[]>([]);
  const [pins, setPins] = useState<Pin[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [errorCarga, setErrorCarga] = useState(false);
  const [version, setVersion] = useState(0);
  // Periodo para pintar las colonias (24 h, 72 h o 7 días); se recuerda en este navegador
  const [horas, setHoras] = useState<HorasPeriodo>(PERIODO_PREDETERMINADO);
  const horasRef = useRef<HorasPeriodo>(PERIODO_PREDETERMINADO);

  const [capas, setCapas] = useState<Capas>(() => ({ agua: true, ...(Object.fromEntries(TIPOS_PIN.map((t) => [t, true])) as Record<TipoPin, boolean>) }));
  const [filtros, setFiltros] = useState<FiltrosMapa>(FILTROS_INICIALES);
  // Modo equipo: quien entró con la contraseña del panel ve días sin resolver, filtros, calor y notas
  const [equipo, setEquipo] = useState(false);
  // Enlace "/?pin=123" (desde estadísticas): se abre cuando llegan los reportes
  const pinEnlace = useRef<number | null>(null);
  const [vista, setVista] = useState<Vista>({ tipo: "nada" });
  const [aviso, setAviso] = useState<string | null>(null);

  const [ubicacion, setUbicacion] = useState<[number, number] | null>(null);
  const [origen, setOrigen] = useState<OrigenUbicacion>("buscando");
  const [miUbicacion, setMiUbicacion] = useState<[number, number] | null>(null);
  const eligioEnMapa = useRef(false);
  // Calles cerradas / con baches: se toca el inicio y el fin, y la línea sigue la calle
  const [modoLinea, setModoLinea] = useState(false);
  const [extremos, setExtremos] = useState<[number, number][]>([]);
  const [tramo, setTramo] = useState<{ puntos: [number, number][]; ajustada: boolean } | null>(null);
  const [errorTramo, setErrorTramo] = useState<string | null>(null);
  const [centrarEn, setCentrarEn] = useState<{ punto: [number, number]; zoom: number; n: number } | null>(null);

  const recargar = useCallback(async (fresco = false) => {
    try {
      const { estados: e, pins: p, resumen: r } = await cargarMapa(horasRef.current, fresco);
      setEstados(e);
      setPins(p);
      setResumen(r);
      setErrorCarga(false);
      setVersion((v) => v + 1);
    } catch (err) {
      console.error(err);
      setErrorCarga(true);
    }
  }, []);

  useEffect(() => {
    try {
      const guardado = Number(localStorage.getItem("rc_periodo"));
      if (PERIODOS.some((p) => p.horas === guardado)) {
        horasRef.current = guardado as HorasPeriodo;
        setHoras(guardado as HorasPeriodo);
      }
    } catch {
      /* sin almacenamiento: se usa el predeterminado */
    }
    cargarZonasCache()
      .then(setZonas)
      .catch((err) => {
        console.error(err);
        setErrorCarga(true);
      });
    recargar();
    const pedido = Number(new URLSearchParams(window.location.search).get("pin"));
    if (Number.isSafeInteger(pedido) && pedido > 0) {
      pinEnlace.current = pedido;
      window.history.replaceState(null, "", window.location.pathname);
    }
    // La cookie "rc_equipo" solo es un aviso; quien decide es el servidor
    if (document.cookie.split("; ").includes("rc_equipo=1")) {
      fetch("/api/equipo/sesion", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => setEquipo(d.equipo === true))
        .catch(() => {});
    }
    const intervalo = setInterval(() => document.visibilityState === "visible" && recargar(), RECARGA_MS);
    const alVolver = () => document.visibilityState === "visible" && recargar();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [recargar]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 4500);
    return () => clearTimeout(t);
  }, [aviso]);

  useEffect(() => {
    if (pinEnlace.current === null || pins.length === 0) return;
    const pin = pins.find((p) => p.id === pinEnlace.current);
    pinEnlace.current = null;
    if (!pin) return;
    setVista({ tipo: "pin", pin });
    setCentrarEn((c) => ({ punto: [pin.lat, pin.lng], zoom: 17, n: (c?.n ?? 0) + 1 }));
  }, [pins]);

  const pinsFiltrados = useMemo(() => (equipo ? filtrarPins(pins, filtros) : pins), [pins, filtros, equipo]);
  const totalFiltrados = useMemo(() => pinsFiltrados.filter((p) => capas[p.tipo]).length, [pinsFiltrados, capas]);

  const mapaEstados = useMemo(() => new Map<number, EstadoAgua>(estados.map((e) => [e.id, e.estado])), [estados]);

  useEffect(() => {
    if (extremos.length !== 2) return;
    let vigente = true;
    cargarRuta(extremos[0], extremos[1]).then((r) => {
      if (!vigente) return;
      if ("error" in r) setErrorTramo(r.error);
      else setTramo(r);
    });
    return () => {
      vigente = false;
    };
  }, [extremos]);

  const centrar = (punto: [number, number], zoom: number) => setCentrarEn((c) => ({ punto, zoom, n: (c?.n ?? 0) + 1 }));

  function abrirReporte() {
    setVista({ tipo: "reporte" });
    setUbicacion(null);
    setModoLinea(false);
    setExtremos([]);
    setTramo(null);
    setErrorTramo(null);
    eligioEnMapa.current = false;
    if (!("geolocation" in navigator)) {
      setOrigen("sin_gps");
      return;
    }
    setOrigen("buscando");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const punto: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        // Si la persona ya tocó el mapa mientras esperábamos, respetamos su elección
        if (eligioEnMapa.current) return;
        // Fuera de Cajeme: no movemos el mapa hasta allá; que toque el lugar del problema
        if (!dentroDeCajeme(punto[0], punto[1])) {
          setOrigen("fuera");
          return;
        }
        setMiUbicacion(punto);
        // GPS muy impreciso (p. ej. solo por antenas): podría caer en otra colonia
        if (pos.coords.accuracy > 500) {
          setOrigen("impreciso");
          centrar(punto, 15);
          return;
        }
        setUbicacion(punto);
        setOrigen("gps");
        centrar(punto, 17);
      },
      () => {
        if (!eligioEnMapa.current) setOrigen("sin_gps");
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  }

  const reportando = vista.tipo === "reporte";
  const dibujandoLinea = reportando && modoLinea;
  const estadoTramo: EstadoTramo = {
    extremos: extremos.length,
    puntos: tramo?.puntos ?? null,
    ajustada: tramo?.ajustada ?? false,
    buscando: extremos.length === 2 && !tramo && !errorTramo,
    error: errorTramo,
  };

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <div className="absolute inset-0">
        <Mapa
          zonas={zonas}
          estados={mapaEstados}
          pins={pinsFiltrados}
          capas={capas}
          vistaCalor={equipo && filtros.vista === "calor" && !reportando}
          puntosFinos={equipo}
          zonaSeleccionada={vista.tipo === "zona" ? vista.id : null}
          pinSeleccionado={vista.tipo === "pin" ? vista.pin.id : null}
          eligiendoUbicacion={reportando}
          ubicacionReporte={reportando && !modoLinea ? ubicacion : null}
          tramoReporte={dibujandoLinea ? { extremos, puntos: tramo?.puntos ?? null } : null}
          miUbicacion={miUbicacion}
          centrarEn={centrarEn}
          onZona={(id) => setVista({ tipo: "zona", id })}
          onPin={(pin) => setVista({ tipo: "pin", pin })}
          onElegirPunto={(lat, lng) => {
            if (dibujandoLinea) {
              // 1er toque: inicio · 2º: fin · 3º: empezar de nuevo
              setExtremos((e) => (e.length >= 2 ? [[lat, lng]] : [...e, [lat, lng]]));
              setTramo(null);
              setErrorTramo(null);
              return;
            }
            eligioEnMapa.current = true;
            setUbicacion([lat, lng]);
            setOrigen("mapa");
          }}
          onFondo={() => setVista({ tipo: "nada" })}
        />
      </div>

      {/* Encabezado y filtros de capa */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto mx-auto flex max-w-lg items-center justify-between rounded-2xl bg-white/95 px-4 py-2 shadow-lg">
          <div>
            <h1 className="text-lg font-extrabold leading-tight text-gray-900">
              Reporta <span className="text-blue-700">Cajeme</span>
            </h1>
            <p className="text-xs leading-tight text-gray-500">Proyecto ciudadano · No es del gobierno</p>
          </div>
          <div className="flex items-center gap-3 text-sm font-semibold">
            {equipo && (
              <Link href="/estadisticas" className="whitespace-nowrap rounded-full bg-gray-900 px-2.5 py-1 text-xs text-white" title="Estadísticas (solo equipo)">
                🔒 Equipo
              </Link>
            )}
            <Link href="/acerca" className="whitespace-nowrap text-blue-700 underline">
              Acerca de
            </Link>
          </div>
        </div>
        <div
          className="sin-barra pointer-events-auto -mx-3 mt-2 flex max-w-lg gap-2 overflow-x-auto px-3 pb-1 sm:mx-auto sm:px-0"
          role="group"
          aria-label="Capas del mapa"
        >
          {[
            ["agua", "💧 Agua"] as const,
            ...TIPOS_PIN.map((t) => [t, `${INFO_PIN[t].emoji} ${INFO_PIN[t].plural}`] as const),
          ].map(([capa, texto]) => (
            <button
              key={capa}
              aria-pressed={capas[capa]}
              onClick={() => setCapas((c) => ({ ...c, [capa]: !c[capa] }))}
              className={`shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold shadow ${
                capas[capa] ? "bg-blue-700 text-white" : "bg-white/95 text-gray-600"
              }`}
            >
              {texto}
            </button>
          ))}
        </div>
        {errorCarga && (
          <p className="pointer-events-auto mx-auto mt-2 max-w-lg rounded-xl bg-red-600 px-3 py-2 text-sm text-white shadow">
            No se pudieron cargar los datos. Revisa tu conexión; reintentaremos en un momento.
          </p>
        )}
      </div>

      {vista.tipo === "nada" && (
        <>
          <Leyenda horas={horas} />
          {equipo && <Filtros filtros={filtros} onCambio={setFiltros} total={totalFiltrados} />}
          <button
            onClick={abrirReporte}
            className="fixed bottom-12 left-1/2 z-[1000] -translate-x-1/2 whitespace-nowrap rounded-full bg-red-600 px-10 py-4 text-xl font-extrabold text-white shadow-xl active:scale-95"
          >
            + Reportar
          </button>
        </>
      )}

      <BarraResumen
        resumen={resumen}
        horas={horas}
        onHoras={(h) => {
          horasRef.current = h;
          setHoras(h);
          try {
            localStorage.setItem("rc_periodo", String(h));
          } catch {
            /* no pasa nada si no se puede guardar */
          }
          recargar();
        }}
      />

      {vista.tipo === "zona" && (
        <PanelZona zonaId={vista.id} horas={horas} version={version} onCerrar={() => setVista({ tipo: "nada" })} onAviso={setAviso} />
      )}
      {vista.tipo === "pin" && (
        <PanelPin
          key={vista.pin.id}
          pin={vista.pin}
          equipo={equipo}
          onCerrar={() => setVista({ tipo: "nada" })}
          onAviso={setAviso}
          onCambio={() => recargar(true)}
        />
      )}
      {reportando && (
        <FlujoReporte
          ubicacion={ubicacion}
          origen={origen}
          tramo={estadoTramo}
          onModoLinea={(linea) => {
            setModoLinea(linea);
            setExtremos([]);
            setTramo(null);
            setErrorTramo(null);
          }}
          onCerrar={() => setVista({ tipo: "nada" })}
          onEnviado={(mensaje) => {
            setVista({ tipo: "nada" });
            setAviso(mensaje);
            recargar(true);
          }}
        />
      )}

      {aviso && (
        <div
          role="status"
          className="fixed inset-x-4 top-28 z-[2000] mx-auto max-w-md rounded-xl bg-gray-900 px-4 py-3 text-center text-sm font-semibold text-white shadow-xl"
        >
          {aviso}
        </div>
      )}
    </main>
  );
}
