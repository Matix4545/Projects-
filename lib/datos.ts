// Lectura de datos públicos (navegador) y envíos a las rutas /api.
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type { EstadoAgua, TipoPin } from "./constantes";
import { supabaseNavegador } from "./supabase/navegador";

export type ZonasGeoJSON = FeatureCollection<Polygon | MultiPolygon, { id: number; nombre: string; fuente: "osm" | "h3" }>;

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
};

export type DetalleZona = {
  id: number;
  nombre: string;
  fuente: "osm" | "h3";
  estado: EstadoAgua | null;
  conteo_24h: Partial<Record<EstadoAgua, number>>;
  conteo_7d: Partial<Record<EstadoAgua, number>>;
  detalles_sucia_24h: Record<string, number>;
  ultimo_reporte: string | null;
  comentarios: { id: number; estado: EstadoAgua; texto: string; creado_en: string }[];
};

export type Resumen = { reportes: number; colonias_afectadas: number };

async function rpc<T>(nombre: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabaseNavegador().rpc(nombre, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const cargarZonas = () => rpc<ZonasGeoJSON>("zonas_geojson");
export const cargarEstados = () => rpc<EstadoZona[]>("estado_zonas");
export const cargarPins = () => rpc<Pin[]>("pins_publicos");
export const cargarResumen = () => rpc<Resumen>("resumen_24h");
export const cargarDetalleZona = (id: number) => rpc<DetalleZona | null>("detalle_zona", { p_id: id });
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
