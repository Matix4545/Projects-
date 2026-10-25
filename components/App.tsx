"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  INFO_PIN,
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
import { Equis } from "./HojaInferior";
import { SelectorFondo } from "./SelectorFondo";
import { esFondo, type Fondo } from "@/lib/fondos";
import type { MedicionTramo } from "@/lib/rugosidad";
import { topSecciones, type PropsSeccion, type SeccionesGeoJSON } from "@/lib/secciones";
import { TarjetaTramo } from "./TarjetaTramo";
import { FILTROS_INICIALES, Filtros, filtrarPins, type FiltrosMapa } from "./Filtros";
import { FlujoReporte, type EstadoTramo, type OrigenUbicacion } from "./FlujoReporte";
import { Leyenda } from "./Leyenda";
import type { Capas } from "./Mapa";
import { PanelPin } from "./PanelPin";
import { PanelZona } from "./PanelZona";

// Leaflet necesita "window", así que el mapa solo se carga en el navegador
const Mapa = dynamic(() => import("./Mapa"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center bg-ios-fondo text-ios-secundario">Cargando mapa…</div>,
});

type Vista =
  | { tipo: "nada" }
  | { tipo: "zona"; id: number; punto: [number, number] }
  | { tipo: "pin"; pin: Pin }
  | { tipo: "reporte"; agua?: boolean };

const RECARGA_MS = 60_000;

export function App() {
  const [zonas, setZonas] = useState<ZonasGeoJSON | null>(null);
  const [estados, setEstados] = useState<EstadoZona[]>([]);
  const [pins, setPins] = useState<Pin[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [errorCarga, setErrorCarga] = useState(false);
  const [version, setVersion] = useState(0);
  // Periodo para pintar las colonias: siempre abre en 7 días; 24 h / 72 h solo durante la visita
  const [horas, setHoras] = useState<HorasPeriodo>(PERIODO_PREDETERMINADO);
  const horasRef = useRef<HorasPeriodo>(PERIODO_PREDETERMINADO);

  const [capas, setCapas] = useState<Capas>(() => ({ agua: true, ...(Object.fromEntries(TIPOS_PIN.map((t) => [t, true])) as Record<TipoPin, boolean>) }));
  const [filtros, setFiltros] = useState<FiltrosMapa>(FILTROS_INICIALES);
  // Modo equipo: quien entró con la contraseña del panel ve días sin resolver, filtros, calor y notas
  const [equipo, setEquipo] = useState(false);
  // Enlace "/?pin=123" (desde estadísticas): se abre cuando llegan los reportes
  const pinEnlace = useRef<number | null>(null);
  // Secciones electorales (solo equipo)
  const [verSecciones, setVerSecciones] = useState(false);
  const [secciones, setSecciones] = useState<SeccionesGeoJSON | null>(null);
  const [errorSecciones, setErrorSecciones] = useState<string | null>(null);
  // Rugosidad medida con celulares (solo equipo)
  const [verRugosidad, setVerRugosidad] = useState(false);
  const [rugosidad, setRugosidad] = useState<(GeoJSON.FeatureCollection & { km?: number; sesiones?: number }) | null>(null);
  const [errorRugosidad, setErrorRugosidad] = useState<string | null>(null);
  const [infoTramo, setInfoTramo] = useState<MedicionTramo[] | null>(null);
  const [infoSeccion, setInfoSeccion] = useState<PropsSeccion | null | "fuera">(null);
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

  // Fondo del mapa elegido (se recuerda en este teléfono)
  const [fondo, setFondo] = useState<Fondo>("mapa");
  const cambiarFondo = (f: Fondo) => {
    setFondo(f);
    try {
      localStorage.setItem("rc_fondo", f);
    } catch {
      /* sin almacenamiento */
    }
  };

  useEffect(() => {
    // Ya no se recuerda el periodo entre visitas: todos entran viendo 7 días
    try {
      localStorage.removeItem("rc_periodo");
      const guardado = localStorage.getItem("rc_fondo");
      if (esFondo(guardado)) setFondo(guardado);
    } catch {
      /* sin almacenamiento */
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

  // El público siempre ve la vista normal (pendientes + arreglados de la última semana)
  // Secciones: se recargan al cambiar el periodo y con cada actualización del mapa
  const diasSecciones = filtros.dias || 3650;
  useEffect(() => {
    if (!equipo || !verSecciones) return;
    let vigente = true;
    fetch(`/api/equipo/secciones?dias=${diasSecciones}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!vigente) return;
        if (r.ok && d.type === "FeatureCollection") {
          setSecciones(d);
          setErrorSecciones(d.features.length ? null : "Aún no hay secciones cargadas. Corre el importador de secciones.");
        } else setErrorSecciones(d.error ?? "No se pudieron cargar las secciones.");
      })
      .catch(() => vigente && setErrorSecciones("Sin conexión."));
    return () => {
      vigente = false;
    };
  }, [equipo, verSecciones, diasSecciones, version]);
  useEffect(() => {
    if (!equipo || !verRugosidad) return;
    let vigente = true;
    fetch(`/api/equipo/rugosidad?dias=${filtros.dias || 3650}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!vigente) return;
        if (r.ok && d.type === "FeatureCollection") {
          setRugosidad(d);
          setErrorRugosidad(d.features.length ? null : "Aún no hay recorridos medidos en este periodo.");
        } else setErrorRugosidad(d.error ?? "No se pudo cargar la rugosidad.");
      })
      .catch(() => vigente && setErrorRugosidad("Sin conexión."));
    return () => {
      vigente = false;
    };
  }, [equipo, verRugosidad, filtros.dias, version]);

  const top5 = useMemo(() => (secciones ? topSecciones(secciones, 5) : []), [secciones]);

  const pinsFiltrados = useMemo(() => filtrarPins(pins, equipo ? filtros : FILTROS_INICIALES), [pins, filtros, equipo]);
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

  /** Desde el panel de una colonia: abre el reporte de agua con ese punto ya elegido */
  function reportarAguaEn(punto: [number, number]) {
    setVista({ tipo: "reporte", agua: true });
    setModoLinea(false);
    setExtremos([]);
    setTramo(null);
    setErrorTramo(null);
    eligioEnMapa.current = true;
    setUbicacion(punto);
    setOrigen("mapa");
  }

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
          fondo={fondo}
          vistaCalor={equipo && filtros.vista === "calor" && !reportando}
          puntosFinos={equipo}
          secciones={equipo && verSecciones && !reportando ? secciones : null}
          onSeccion={(s) => setInfoSeccion(s ?? "fuera")}
          rugosidad={equipo && verRugosidad && !reportando ? rugosidad : null}
          onTramo={(m) => {
            setInfoTramo(m);
            setInfoSeccion(null);
          }}
          zonaSeleccionada={vista.tipo === "zona" ? vista.id : null}
          pinSeleccionado={vista.tipo === "pin" ? vista.pin.id : null}
          eligiendoUbicacion={reportando}
          ubicacionReporte={reportando && !modoLinea ? ubicacion : null}
          tramoReporte={dibujandoLinea ? { extremos, puntos: tramo?.puntos ?? null } : null}
          miUbicacion={miUbicacion}
          centrarEn={centrarEn}
          onZona={(id, punto) => setVista({ tipo: "zona", id, punto })}
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
        <div className="material pointer-events-auto mx-auto flex max-w-lg items-center justify-between gap-3 rounded-[18px] py-2 pl-4 pr-2">
          <div className="min-w-0">
            <h1 className="text-[17px] font-semibold leading-tight tracking-tight">
              Reporta <span className="text-ios-azul">Cajeme</span>
            </h1>
            <p className="truncate text-xs leading-tight text-ios-secundario">Proyecto ciudadano · No es del gobierno</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {equipo && (
              <Link
                href="/estadisticas"
                className="flex h-8 items-center gap-1 rounded-full bg-ios-etiqueta px-3 text-[13px] font-semibold text-white"
                title="Estadísticas (solo equipo)"
              >
                <Candado /> Equipo
              </Link>
            )}
            <Link href="/acerca" aria-label="Acerca de" className="grid h-8 w-8 place-items-center rounded-full bg-ios-relleno text-ios-azul">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                <circle cx="8" cy="4.2" r="1.3" fill="currentColor" />
                <path d="M8 7v5.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </Link>
          </div>
        </div>
        <div
          className="sin-barra pointer-events-auto -mx-3 mt-2 flex max-w-lg gap-1.5 overflow-x-auto px-3 pb-2 pt-0.5 sm:mx-auto sm:px-0"
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
              className={`chip ${capas[capa] ? "shadow-md" : "material"}`}
            >
              {texto}
            </button>
          ))}
        </div>
        <div className="pointer-events-none mx-auto flex max-w-lg justify-end">
          <div className="pointer-events-auto">
            <SelectorFondo fondo={fondo} onCambio={cambiarFondo} />
          </div>
        </div>
        {errorCarga && (
          <p className="material pointer-events-auto mx-auto mt-1 max-w-lg rounded-2xl px-4 py-2.5 text-sm font-medium text-ios-rojo">
            No se pudieron cargar los datos. Revisa tu conexión; reintentaremos en un momento.
          </p>
        )}
      </div>

      {vista.tipo === "nada" && (
        <>
          <Leyenda horas={horas} />
          {equipo && (
            <Filtros
              filtros={filtros}
              onCambio={setFiltros}
              total={totalFiltrados}
              secciones={{
                activas: verSecciones,
                onCambio: (v) => {
                  setVerSecciones(v);
                  setInfoSeccion(null);
                },
                top: top5,
                error: errorSecciones,
              }}
              rugosidad={{
                activa: verRugosidad,
                onCambio: (v) => {
                  setVerRugosidad(v);
                  setInfoTramo(null);
                },
                resumen: rugosidad ? { km: rugosidad.km ?? 0, sesiones: rugosidad.sesiones ?? 0 } : null,
                error: errorRugosidad,
              }}
            />
          )}
          {equipo && verRugosidad && infoTramo && <TarjetaTramo mediciones={infoTramo} onCerrar={() => setInfoTramo(null)} />}
          {equipo && verSecciones && infoSeccion && !infoTramo && (
            <div className="material fixed inset-x-3 top-32 z-[1002] mx-auto flex max-w-sm items-start justify-between gap-3 rounded-2xl px-4 py-3 text-sm">
              {infoSeccion === "fuera" ? (
                <span>Ese punto no está en ninguna sección de Cajeme.</span>
              ) : (
                <span>
                  🗳️ <strong>Sección {infoSeccion.seccion}</strong>
                  {infoSeccion.distrito_local ? ` · Distrito local ${infoSeccion.distrito_local}` : ""}
                  <br />
                  {infoSeccion.total.toLocaleString("es-MX")} reportes {filtros.dias ? `en ${filtros.dias} días` : "en total"} (
                  {infoSeccion.puntos} con ubicación · {infoSeccion.agua} de agua)
                </span>
              )}
              <button onClick={() => setInfoSeccion(null)} aria-label="Cerrar" className="cerrar">
                <Equis />
              </button>
            </div>
          )}
          <button
            onClick={abrirReporte}
            className="boton boton-principal fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom))] left-1/2 z-[1000] h-14 -translate-x-1/2 whitespace-nowrap rounded-full px-8 text-[18px] shadow-[0_8px_24px_rgba(0,122,255,0.4)]"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <path d="M9 2v14M2 9h14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
            </svg>
            Reportar
          </button>
        </>
      )}

      <BarraResumen
        resumen={resumen}
        horas={horas}
        onHoras={(h) => {
          horasRef.current = h;
          setHoras(h);
          recargar();
        }}
      />

      {vista.tipo === "zona" && (
        <PanelZona
          zonaId={vista.id}
          horas={horas}
          version={version}
          onCerrar={() => setVista({ tipo: "nada" })}
          onAviso={setAviso}
          onReportarAgua={() => reportarAguaEn(vista.punto)}
        />
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
          pasoInicial={vista.agua ? "agua" : "tipo"}
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
          className="material-oscuro velo fixed inset-x-4 top-[calc(7rem+env(safe-area-inset-top))] z-[2000] mx-auto max-w-md rounded-2xl px-4 py-3 text-center text-[15px] font-medium shadow-2xl"
        >
          {aviso}
        </div>
      )}
    </main>
  );
}

function Candado() {
  return (
    <svg width="11" height="13" viewBox="0 0 11 13" aria-hidden>
      <rect x="0.5" y="5.5" width="10" height="7" rx="2" fill="currentColor" />
      <path d="M2.8 5.5V4a2.7 2.7 0 0 1 5.4 0v1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  );
}
