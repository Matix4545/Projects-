"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { dentroDeCajeme, type EstadoAgua } from "@/lib/constantes";
import {
  cargarEstados,
  cargarPins,
  cargarResumen,
  cargarZonas,
  type EstadoZona,
  type Pin,
  type Resumen,
  type ZonasGeoJSON,
} from "@/lib/datos";
import { BarraResumen } from "./BarraResumen";
import { FlujoReporte, type OrigenUbicacion } from "./FlujoReporte";
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

  const [capas, setCapas] = useState<Capas>({ agua: true, bache: true, drenaje: true });
  const [vista, setVista] = useState<Vista>({ tipo: "nada" });
  const [aviso, setAviso] = useState<string | null>(null);

  const [ubicacion, setUbicacion] = useState<[number, number] | null>(null);
  const [origen, setOrigen] = useState<OrigenUbicacion>("buscando");
  const [miUbicacion, setMiUbicacion] = useState<[number, number] | null>(null);
  const eligioEnMapa = useRef(false);
  const [centrarEn, setCentrarEn] = useState<{ punto: [number, number]; zoom: number; n: number } | null>(null);

  const recargar = useCallback(async () => {
    try {
      const [e, p, r] = await Promise.all([cargarEstados(), cargarPins(), cargarResumen()]);
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
    cargarZonas()
      .then(setZonas)
      .catch((err) => {
        console.error(err);
        setErrorCarga(true);
      });
    recargar();
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

  const mapaEstados = useMemo(() => new Map<number, EstadoAgua>(estados.map((e) => [e.id, e.estado])), [estados]);

  const centrar = (punto: [number, number], zoom: number) => setCentrarEn((c) => ({ punto, zoom, n: (c?.n ?? 0) + 1 }));

  function abrirReporte() {
    setVista({ tipo: "reporte" });
    setUbicacion(null);
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

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <div className="absolute inset-0">
        <Mapa
          zonas={zonas}
          estados={mapaEstados}
          pins={pins}
          capas={capas}
          zonaSeleccionada={vista.tipo === "zona" ? vista.id : null}
          pinSeleccionado={vista.tipo === "pin" ? vista.pin.id : null}
          eligiendoUbicacion={reportando}
          ubicacionReporte={reportando ? ubicacion : null}
          miUbicacion={miUbicacion}
          centrarEn={centrarEn}
          onZona={(id) => setVista({ tipo: "zona", id })}
          onPin={(pin) => setVista({ tipo: "pin", pin })}
          onElegirPunto={(lat, lng) => {
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
          <Link href="/acerca" className="text-sm font-semibold text-blue-700 underline">
            Acerca de
          </Link>
        </div>
        <div className="pointer-events-auto mx-auto mt-2 flex max-w-lg gap-2" role="group" aria-label="Capas del mapa">
          {(
            [
              ["agua", "💧 Agua"],
              ["bache", "🕳️ Baches"],
              ["drenaje", "🚧 Drenaje"],
            ] as const
          ).map(([capa, texto]) => (
            <button
              key={capa}
              aria-pressed={capas[capa]}
              onClick={() => setCapas((c) => ({ ...c, [capa]: !c[capa] }))}
              className={`flex-1 rounded-full px-3 py-2 text-sm font-semibold shadow ${
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
          <Leyenda />
          <button
            onClick={abrirReporte}
            className="fixed bottom-12 left-1/2 z-[1000] -translate-x-1/2 whitespace-nowrap rounded-full bg-red-600 px-10 py-4 text-xl font-extrabold text-white shadow-xl active:scale-95"
          >
            + Reportar
          </button>
        </>
      )}

      <BarraResumen resumen={resumen} />

      {vista.tipo === "zona" && (
        <PanelZona zonaId={vista.id} version={version} onCerrar={() => setVista({ tipo: "nada" })} onAviso={setAviso} />
      )}
      {vista.tipo === "pin" && (
        <PanelPin
          key={vista.pin.id}
          pin={vista.pin}
          onCerrar={() => setVista({ tipo: "nada" })}
          onAviso={setAviso}
          onCambio={recargar}
        />
      )}
      {reportando && (
        <FlujoReporte
          ubicacion={ubicacion}
          origen={origen}
          onCerrar={() => setVista({ tipo: "nada" })}
          onEnviado={(mensaje) => {
            setVista({ tipo: "nada" });
            setAviso(mensaje);
            recargar();
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
