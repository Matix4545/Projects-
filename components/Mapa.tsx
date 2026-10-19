"use client";

import "leaflet/dist/leaflet.css";
import L, { type LeafletMouseEvent, type PathOptions } from "leaflet";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { CircleMarker, GeoJSON, MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { CENTRO_OBREGON, COLOR_ARREGLADO, COLOR_ESTADO, INFO_PIN, SUBTIPOS_PELIGROSOS, type EstadoAgua, type TipoPin } from "@/lib/constantes";
import type { Pin, ZonasGeoJSON } from "@/lib/datos";

export type Capas = Record<"agua" | TipoPin, boolean>;

type Props = {
  zonas: ZonasGeoJSON | null;
  estados: Map<number, EstadoAgua>;
  pins: Pin[];
  capas: Capas;
  zonaSeleccionada: number | null;
  pinSeleccionado: number | null;
  /** Modo "elige un punto": los toques en el mapa mueven el marcador del reporte */
  eligiendoUbicacion: boolean;
  ubicacionReporte: [number, number] | null;
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

function Clics({ onClick }: { onClick: (e: LeafletMouseEvent) => void }) {
  useMapEvents({ click: onClick });
  return null;
}

export default function Mapa(props: Props) {
  const { zonas, estados, pins, capas, eligiendoUbicacion } = props;

  // Las funciones de Leaflet se crean una sola vez; con refs siempre ven los props actuales.
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
      else p.onZona(Number(feature.properties?.id));
    });
  }, []);

  const pinsVisibles = useMemo(() => pins.filter((p) => capas[p.tipo] ?? true), [pins, capas]);

  return (
    <MapContainer
      center={CENTRO_OBREGON}
      zoom={13}
      minZoom={11}
      maxZoom={19}
      zoomControl={false}
      preferCanvas
      className="h-full w-full"
    >
      <TileLayer
        url={URL_MOSAICOS}
        maxZoom={19}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <Centrador centrarEn={props.centrarEn} />
      <Clics
        onClick={(e) => {
          const p = refProps.current;
          if (p.eligiendoUbicacion) p.onElegirPunto(e.latlng.lat, e.latlng.lng);
          else p.onFondo();
        }}
      />

      {capas.agua && zonas && <GeoJSON data={zonas} style={estilo} onEachFeature={alClickZona} />}

      {pinsVisibles.map((pin) => {
        const arreglado = pin.estado === "arreglado";
        const seleccionado = pin.id === props.pinSeleccionado;
        return (
          <CircleMarker
            key={`${pin.id}-${pin.estado}`}
            center={[pin.lat, pin.lng]}
            radius={pin.tipo === "bache" ? (RADIO_BACHE[pin.subtipo] ?? 8) : 8}
            pathOptions={{
              color: seleccionado ? "#111827" : SUBTIPOS_PELIGROSOS.has(pin.subtipo) ? "#dc2626" : "#1f2937",
              weight: seleccionado ? 4 : 2,
              fillColor: arreglado ? COLOR_ARREGLADO : (INFO_PIN[pin.tipo]?.color ?? "#6b7280"),
              fillOpacity: arreglado ? 0.6 : 0.95,
            }}
            eventHandlers={{
              click: (e) => {
                L.DomEvent.stopPropagation(e);
                const p = refProps.current;
                if (p.eligiendoUbicacion) p.onElegirPunto(e.latlng.lat, e.latlng.lng);
                else p.onPin(pin);
              },
            }}
          />
        );
      })}

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
