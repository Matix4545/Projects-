// Lectura de datos públicos (navegador) y envíos a las rutas /api.
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type { EstadoAgua, TipoPin } from "./constantes";
import { supabaseNavegador } from "./supabase/navegador";

export type ZonasGeoJSON = FeatureCollection<Polygon | MultiPolygon, { id: number; nombre: string; fuente: "osm" | "h3" | "oficial" }>;

export type EstadoZona = { id: number; estado: EstadoAgua; total: number };

export type Pin = {
  id: number;
  tipo: TipoPin;
  subtipo: string;
  lat: number;
  lng: number;
  foto: string | null;
  comentario: string | null;
  confirmaciones: number;
  votos_arreglado: number;
  estado: "activo" | "arreglado";
  creado_en: string;
  arreglado_en: string | null;
  colonia: string | null;
  /** Tramo de calle [[lat, lng], ...] en calles cerradas / con baches */
  trazo?: [number, number][] | null;
};

export type DetalleZona = {
  id: number;
  nombre: string;
  fuente: "osm" | "h3" | "oficial";
  estado: EstadoAgua | null;
  horas?: number;
  conteo_periodo?: Partial<Record<EstadoAgua, number>>;
  detalles_sucia?: Record<string, number>;
  conteo_24h: Partial<Record<EstadoAgua, number>>;
  conteo_7d: Partial<Record<EstadoAgua, number>>;
  detalles_sucia_24h: Record<string, number>;
  ultimo_reporte: string | null;
  comentarios: { id: number; estado: EstadoAgua; texto: string; creado_en: string }[];
};

export type Resumen = { reportes: number; colonias_afectadas: number; horas?: number };

async function rpc<T>(nombre: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabaseNavegador().rpc(nombre, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const cargarZonas = () => rpc<ZonasGeoJSON>("zonas_geojson");
/**
 * Llama a la versión con periodo; si la base de datos aún no tiene el SQL nuevo,
 * usa la versión anterior de 24 h para que la app no se rompa.
 */
async function conPeriodo<T>(nueva: () => Promise<T>, anterior: () => Promise<T>): Promise<T> {
  try {
    return await nueva();
  } catch {
    return anterior();
  }
}

export const cargarEstados = (horas: number) =>
  conPeriodo(() => rpc<EstadoZona[]>("estado_zonas", { p_horas: horas }), () => rpc<EstadoZona[]>("estado_zonas"));
export const cargarPins = () => rpc<Pin[]>("pins_publicos");
export const cargarResumen = (horas: number) =>
  conPeriodo(() => rpc<Resumen>("resumen", { p_horas: horas }), () => rpc<Resumen>("resumen_24h"));
export const cargarDetalleZona = (id: number, horas: number) =>
  conPeriodo(
    () => rpc<DetalleZona | null>("detalle_zona", { p_id: id, p_horas: horas }),
    () => rpc<DetalleZona | null>("detalle_zona", { p_id: id }),
  );
export type DatosMapa = { estados: EstadoZona[]; pins: Pin[]; resumen: Resumen };
/** Lectura directa de Supabase (la usa la ruta /api/publico/mapa). */
export async function leerMapa(horas: number): Promise<DatosMapa> {
  const [estados, pins, resumen] = await Promise.all([cargarEstados(horas), cargarPins(), cargarResumen(horas)]);
  return { estados, pins, resumen };
}

/** Lee por la caché de Vercel (/api/publico/...); si falla, va directo a Supabase. */
async function desdeCache<T>(ruta: string, directo: () => Promise<T>): Promise<T> {
  try {
    const res = await fetch(ruta);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch {
    return directo();
  }
}
/** Datos del mapa. "fresco" se salta la caché (tras enviar un reporte o voto, para verlo de inmediato). */
export const cargarMapa = (horas: number, fresco = false) =>
  desdeCache(`/api/publico/mapa?horas=${horas}${fresco ? `&t=${Date.now()}` : ""}`, () => leerMapa(horas));
export const cargarZonasCache = () => desdeCache("/api/publico/zonas", cargarZonas);

/** Tramo de calle entre dos puntos, siguiendo las calles (o recto si el servicio de rutas falló). */
export async function cargarRuta(
  de: [number, number],
  a: [number, number],
): Promise<{ puntos: [number, number][]; ajustada: boolean } | { error: string }> {
  try {
    const res = await fetch(`/api/ruta?de=${de.join(",")}&a=${a.join(",")}`);
    const datos = await res.json();
    if (res.ok && Array.isArray(datos.puntos)) return datos;
    if (typeof datos.error === "string") return { error: datos.error };
  } catch {
    /* sin conexión: línea recta */
  }
  return { puntos: [de, a], ajustada: false };
}

export const zonaDePunto = (lat: number, lng: number) =>
  rpc<{ id: number; nombre: string } | null>("zona_de_punto", { p_lat: lat, p_lng: lng });

type RespuestaApi<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** POST a una ruta /api. Siempre devuelve {ok, error?} aunque falle la red. */
export async function enviar<T = object>(url: string, cuerpo: object | FormData): Promise<RespuestaApi<T>> {
  try {
    const esForm = cuerpo instanceof FormData;
    const res = await fetch(url, {
      method: "POST",
      body: esForm ? cuerpo : JSON.stringify(cuerpo),
      headers: esForm ? undefined : { "Content-Type": "application/json" },
    });
    const datos = await res.json().catch(() => null);
    if (!datos) return { ok: false, error: "Respuesta inesperada del servidor. Intenta de nuevo." };
    return datos;
  } catch {
    return { ok: false, error: "Sin conexión. Revisa tu internet e intenta de nuevo." };
  }
}
