"use client";

import L from "leaflet";
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import { SUBTIPOS_PELIGROSOS } from "@/lib/constantes";
import type { Pin } from "@/lib/datos";

/** Mapa de calor: dónde se concentran los reportes. Pesan más los peligrosos y los más confirmados. */
export function CapaCalor({ pins }: { pins: Pin[] }) {
  const mapa = useMap();
  const capa = useRef<L.HeatLayer | null>(null);
  const pinsRef = useRef(pins);
  pinsRef.current = pins;

  useEffect(() => {
    let cancelado = false;
    // leaflet.heat se registra sobre la "L" global
    (window as unknown as { L: typeof L }).L = L;
    import("leaflet.heat").then(() => {
      if (cancelado) return;
      capa.current = L.heatLayer([], {
        radius: 20,
        blur: 16,
        // Intensidad completa desde zoom 13; al alejar se atenúa un poco (zoom 12: ½, zoom 11: ¼).
        maxZoom: 13,
        // Hacen falta ~2–3 reportes encimados para llegar al rojo oscuro: un reporte solo se ve
        // amarillo/naranja y el rojo queda para donde de verdad se amontonan.
        max: 2,
        minOpacity: 0.35,
        gradient: { 0.15: "#fde047", 0.4: "#f97316", 0.7: "#dc2626", 1: "#7f1d1d" },
      }).addTo(mapa);
      capa.current.setLatLngs(puntos(pinsRef.current));
    });
    return () => {
      cancelado = true;
      capa.current?.remove();
      capa.current = null;
    };
  }, [mapa]);

  useEffect(() => {
    capa.current?.setLatLngs(puntos(pins));
  }, [pins]);

  return null;
}

function puntos(pins: Pin[]): L.HeatLatLngTuple[] {
  return pins.map((p) => {
    const peso = p.estado === "arreglado" ? 0.2 : Math.min(1, (SUBTIPOS_PELIGROSOS.has(p.subtipo) ? 0.7 : 0.4) + p.confirmaciones * 0.1);
    return [p.lat, p.lng, peso];
  });
}
