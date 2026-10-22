"use client";

import "leaflet/dist/leaflet.css";
import L, { type LeafletMouseEvent, type PathOptions } from "leaflet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, GeoJSON, MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { CENTRO_OBREGON, COLOR_ARREGLADO, COLOR_ESTADO, INFO_PIN, SUBTIPOS_PELIGROSOS, type EstadoAgua, type TipoPin } from "@/lib/constantes";
import type { Pin, ZonasGeoJSON } from "@/lib/datos";
import { seccionEn, type PropsSeccion, type SeccionesGeoJSON } from "@/lib/secciones";
import { CapaCalor } from "./CapaCalor";

export type Capas = Record<"agua" | TipoPin, boolean>;

type Props = {
  zonas: ZonasGeoJSON | null;
  estados: Map<number, EstadoAgua>;
  pins: Pin[];
  capas: Capas;
  /** Mapa de calor en lugar de puntos y líneas */
  vistaCalor: boolean;
  /** Puntos más chicos al alejar el mapa (por ahora solo en modo equipo) */
  puntosFinos: boolean;
  /** Secciones electorales (solo equipo); null = capa apagada */
  secciones: SeccionesGeoJSON | null;
  onSeccion: (s: PropsSeccion | null) => void;
  zonaSeleccionada: number | null;
  pinSeleccionado: number | null;
  /** Modo "elige un punto": los toques en el mapa mueven el marcador del reporte */
  eligiendoUbicacion: boolean;
  ubicacionReporte: [number, number] | null;
  /** Calle que se está marcando: extremos tocados y tramo que sigue la calle */
  tramoReporte: { extremos: [number, number][]; puntos: [number, number][] | null } | null;
  miUbicacion: [number, number] | null;
  centrarEn: { punto: [number, number]; zoom: number; n: number } | null;
  onZona: (id: number) => void;
  onPin: (pin: Pin) => void;
  onElegirPunto: (lat: number, lng: number) => void;
  onFondo: () => void;
};

const URL_MOSAICOS = process.env.NEXT_PUBLIC_TILES_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const iconoReporte = L.divIcon({
  className: "",
  html: '<div class="marcador-reporte"><span></span></div>',
  iconSize: [36, 46],
  iconAnchor: [18, 44],
});

// En canvas, tolerancia extra para poder tocar las líneas de calles con el dedo
const RENDERIZADOR = L.canvas({ tolerance: 8 });

const RADIO_BACHE: Record<string, number> = { chico: 6, mediano: 8, grande: 10, peligroso: 11 };

/** Mueve el mapa cuando el padre lo pide; deja el punto en la mitad de arriba (abajo va el panel). */
function Centrador({ centrarEn }: { centrarEn: Props["centrarEn"] }) {
  const mapa = useMap();
  useEffect(() => {
    if (!centrarEn) return;
    mapa.setView(centrarEn.punto, Math.max(mapa.getZoom(), centrarEn.zoom), { animate: false });
    mapa.panBy([0, mapa.getSize().y * 0.22], { animate: true });
  }, [centrarEn, mapa]);
  return null;
}

/** Avisa el zoom actual para ajustar el tamaño de los puntos */
function ObservarZoom({ onZoom }: { onZoom: (z: number) => void }) {
  useMapEvents({ zoomend: (e) => onZoom(e.target.getZoom()) });
  return null;
}

// Alejado los puntos se amontonan: se dibujan más chicos y con borde fino
const escalaPunto = (zoom: number) => (zoom <= 13 ? 0.65 : zoom === 14 ? 0.8 : 1);

function Clics({ onClick }: { onClick: (e: LeafletMouseEvent) => void }) {
  useMapEvents({ click: onClick });
  return null;
}

export default function Mapa(props: Props) {
  const { zonas, estados, pins, capas, eligiendoUbicacion } = props;

  // Las funciones de Leaflet se crean una sola vez; con refs siempre ven los props actuales.
  const [zoomReal, setZoom] = useState(13);
  const zoom = props.puntosFinos ? zoomReal : 99;
  const refProps = useRef(props);
  refProps.current = props;

  const estilo = useCallback(
    (feature?: GeoJSON.Feature): PathOptions => {
      const id = Number(feature?.properties?.id);
      const estado = estados.get(id);
      const seleccionada = id === props.zonaSeleccionada;
      if (seleccionada) {
        return {
          color: "#111827",
          weight: 3,
          opacity: 1,
          fillColor: estado ? COLOR_ESTADO[estado] : COLOR_ESTADO.ninguno,
          fillOpacity: estado ? 0.6 : 0.35,
        };
      }
      // Sin reportes: gris transparente con borde gris oscuro, para que se vea cada colonia
      // sin tapar las calles. Con reportes: el color del estado, con borde del mismo tono.
      return estado
        ? { color: COLOR_ESTADO[estado], weight: 1.5, opacity: 0.9, fillColor: COLOR_ESTADO[estado], fillOpacity: 0.45 }
        : { color: "#4b5563", weight: 1, opacity: 0.55, fillColor: COLOR_ESTADO.ninguno, fillOpacity: 0.22 };
    },
    [estados, props.zonaSeleccionada],
  );

  const alClickZona = useCallback((feature: GeoJSON.Feature, capa: L.Layer) => {
    // En computadora, el nombre de la colonia aparece al pasar el mouse
    const nombre = feature.properties?.nombre;
    if (nombre && window.matchMedia("(hover: hover)").matches) {
      (capa as L.Path).bindTooltip(String(nombre), { sticky: true, direction: "top", className: "etiqueta-colonia" });
    }
    capa.on("click", (e: LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e);
      const p = refProps.current;
      if (p.eligiendoUbicacion) p.onElegirPunto(e.latlng.lat, e.latlng.lng);
      // Con las secciones prendidas, tocar el mapa dice en qué sección cae (en vez de abrir la colonia)
      else if (p.secciones) p.onSeccion(seccionEn(e.latlng.lat, e.latlng.lng, p.secciones));
      else p.onZona(Number(feature.properties?.id));
    });
  }, []);

  // Más reportes = morado más intenso; sin reportes, solo el contorno
  const maxSeccion = useMemo(
    () => Math.max(1, ...(props.secciones?.features.map((f) => f.properties.total) ?? [0])),
    [props.secciones],
  );
  const seccionesVersion = useMemo(
    () => `${props.secciones?.features.length ?? 0}-${props.secciones?.features.reduce((s, f) => s + f.properties.total, 0) ?? 0}`,
    [props.secciones],
  );
  const estiloSeccion = useCallback(
    (f?: GeoJSON.Feature): PathOptions => {
      const total = Number(f?.properties?.total ?? 0);
      return {
        color: "#4c1d95",
        weight: 1.2,
        opacity: 0.8,
        dashArray: "4 3",
        fillColor: "#6d28d9",
        fillOpacity: total > 0 ? 0.08 + 0.5 * (total / maxSeccion) : 0,
      };
    },
    [maxSeccion],
  );

  const pinsVisibles = useMemo(() => pins.filter((p) => capas[p.tipo] ?? true), [pins, capas]);
  const calles = useMemo(
    () => (props.vistaCalor ? [] : pinsVisibles.filter((p) => p.trazo && p.trazo.length >= 2)),
    [pinsVisibles, props.vistaCalor],
  );
  const puntos = useMemo(() => (props.vistaCalor ? [] : pinsVisibles.filter((p) => !p.trazo)), [pinsVisibles, props.vistaCalor]);

  const alClickPin = (pin: Pin) => (e: LeafletMouseEvent) => {
    L.DomEvent.stopPropagation(e);
    const p = refProps.current;
    if (p.eligiendoUbicacion) p.onElegirPunto(e.latlng.lat, e.latlng.lng);
    else p.onPin(pin);
  };

  return (
    <MapContainer
      center={CENTRO_OBREGON}
      zoom={13}
      minZoom={11}
      maxZoom={19}
      zoomControl={false}
      preferCanvas
      renderer={RENDERIZADOR}
      className="h-full w-full"
    >
      <TileLayer
        url={URL_MOSAICOS}
        maxZoom={19}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <Centrador centrarEn={props.centrarEn} />
      <ObservarZoom onZoom={setZoom} />
      <Clics
        onClick={(e) => {
          const p = refProps.current;
          if (p.eligiendoUbicacion) p.onElegirPunto(e.latlng.lat, e.latlng.lng);
          else if (p.secciones) p.onSeccion(seccionEn(e.latlng.lat, e.latlng.lng, p.secciones));
          else p.onFondo();
        }}
      />

      {capas.agua && zonas && <GeoJSON data={zonas} style={estilo} onEachFeature={alClickZona} />}

      {/* Secciones electorales: no reciben toques (así no tapan los puntos); la sección se busca por coordenadas */}
      {props.secciones && (
        <GeoJSON
          key={`secciones-${seccionesVersion}-${zoomReal >= 14}`}
          data={props.secciones}
          interactive={false}
          style={estiloSeccion}
          onEachFeature={(f, capa) => {
            if (zoomReal >= 14) {
              capa.bindTooltip(String(f.properties.seccion), { permanent: true, direction: "center", className: "etiqueta-seccion" });
            }
          }}
        />
      )}

      {props.vistaCalor && <CapaCalor pins={pinsVisibles} />}

      {/* Calles cerradas (rojo) y con baches (amarillo): línea con contorno oscuro para que resalte */}
      {calles.map((pin) => {
        const arreglado = pin.estado === "arreglado";
        const seleccionado = pin.id === props.pinSeleccionado;
        const trazo = pin.trazo!;
        return [
          <Polyline
            key={`${pin.id}-${pin.estado}-borde`}
            positions={trazo}
            pathOptions={{ color: "#111827", weight: seleccionado ? 13 : 10, opacity: arreglado ? 0.25 : 0.7, lineCap: "round" }}
            eventHandlers={{ click: alClickPin(pin) }}
          />,
          <Polyline
            key={`${pin.id}-${pin.estado}`}
            positions={trazo}
            pathOptions={{
              color: arreglado ? COLOR_ARREGLADO : (INFO_PIN[pin.tipo]?.color ?? "#6b7280"),
              weight: seleccionado ? 8 : 6,
              opacity: arreglado ? 0.7 : 1,
              dashArray: arreglado ? "8 10" : undefined,
              lineCap: "round",
            }}
            eventHandlers={{ click: alClickPin(pin) }}
          />,
        ];
      })}

      {puntos.map((pin) => {
        const arreglado = pin.estado === "arreglado";
        const seleccionado = pin.id === props.pinSeleccionado;
        return (
          <CircleMarker
            key={`${pin.id}-${pin.estado}`}
            center={[pin.lat, pin.lng]}
            radius={(pin.tipo === "bache" ? (RADIO_BACHE[pin.subtipo] ?? 8) : 8) * (seleccionado ? 1.2 : escalaPunto(zoom))}
            pathOptions={{
              color: seleccionado ? "#111827" : SUBTIPOS_PELIGROSOS.has(pin.subtipo) ? "#dc2626" : "#1f2937",
              weight: seleccionado ? 4 : zoom <= 13 && !SUBTIPOS_PELIGROSOS.has(pin.subtipo) ? 1 : 2,
              fillColor: arreglado ? COLOR_ARREGLADO : (INFO_PIN[pin.tipo]?.color ?? "#6b7280"),
              fillOpacity: arreglado ? 0.6 : 0.95,
            }}
            eventHandlers={{ click: alClickPin(pin) }}
          />
        );
      })}

      {props.tramoReporte?.puntos && (
        <Polyline
          positions={props.tramoReporte.puntos}
          interactive={false}
          pathOptions={{ color: "#1d4ed8", weight: 7, opacity: 0.9, dashArray: "10 8", lineCap: "round" }}
        />
      )}
      {props.tramoReporte?.extremos.map((punto, i) => (
        <CircleMarker
          key={`extremo-${i}`}
          center={punto}
          radius={9}
          interactive={false}
          pathOptions={{ color: "#ffffff", weight: 3, fillColor: i === 0 ? "#16a34a" : "#dc2626", fillOpacity: 1 }}
        />
      ))}

      {props.miUbicacion && (
        <CircleMarker
          center={props.miUbicacion}
          radius={7}
          interactive={false}
          pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }}
        />
      )}

      {props.ubicacionReporte && (
        <Marker
          position={props.ubicacionReporte}
          icon={iconoReporte}
          draggable={eligiendoUbicacion}
          eventHandlers={{
            dragend: (e) => {
              const ll = (e.target as L.Marker).getLatLng();
              refProps.current.onElegirPunto(ll.lat, ll.lng);
            },
          }}
        />
      )}
    </MapContainer>
  );
}
