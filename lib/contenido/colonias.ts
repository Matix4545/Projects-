import "server-only";
// Datos para las páginas públicas de colonias (/colonias y /colonias/<nombre>).
// Si la base de datos aún no tiene el SQL nuevo (colonias_publicas / colonia_publica), se arma lo
// mismo con las funciones anteriores para que las páginas funcionen desde el primer despliegue.
import { unstable_cache } from "next/cache";
import type { EstadoAgua, TipoPin } from "@/lib/constantes";
import type { DetalleZona, EstadoZona, ZonasGeoJSON } from "@/lib/datos";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { asignarSlugs, type ConSlug } from "./slug";

export type ColoniaResumen = ConSlug<{
  id: number;
  nombre: string;
  fuente: "osm" | "h3" | "oficial";
  /** Estado del agua en 7 días (null = sin reportes) */
  estado: EstadoAgua | null;
  agua_7d: number;
  /** Reportes con punto pendientes */
  activos: number;
  /** Reportes desde el inicio (null si la base de datos no tiene el SQL nuevo) */
  total: number | null;
  ultimo: string | null;
}>;

export type ColoniaDetalle = {
  zona: DetalleZona;
  por_tipo: Partial<Record<TipoPin, number>>;
  arreglados: number;
  recientes: { id: number; tipo: TipoPin; subtipo: string; confirmaciones: number; creado_en: string }[];
  total: number | null;
};

async function leerLista(): Promise<ColoniaResumen[]> {
  const sb = supabaseServidor();
  const { data, error } = await sb.rpc("colonias_publicas");
  if (!error && Array.isArray(data)) return asignarSlugs(data as Omit<ColoniaResumen, "slug">[]);

  // SQL anterior: nombres de zonas_geojson (sin la geometría) y colores de estado_zonas
  const [zonas, estados] = await Promise.all([sb.rpc("zonas_geojson"), sb.rpc("estado_zonas", { p_horas: 168 })]);
  if (zonas.error) throw new Error(zonas.error.message);
  const porId = new Map(((estados.data as EstadoZona[] | null) ?? []).map((e) => [e.id, e]));
  return asignarSlugs(
    (zonas.data as ZonasGeoJSON).features
      .filter((f) => f.properties.fuente !== "h3")
      .map((f) => ({
        id: f.properties.id,
        nombre: f.properties.nombre,
        fuente: f.properties.fuente,
        estado: porId.get(f.properties.id)?.estado ?? null,
        agua_7d: porId.get(f.properties.id)?.total ?? 0,
        activos: 0,
        total: null,
        ultimo: null,
      })),
  );
}

/** Todas las colonias con slug. Se guarda 10 minutos: cada página no vuelve a pedir la lista. */
export const listaColonias = unstable_cache(leerLista, ["colonias-publicas-v1"], { revalidate: 600 });

/** Lista sin tronar el build ni la página si Supabase no responde */
export async function listaColoniasSegura(): Promise<ColoniaResumen[]> {
  try {
    return await listaColonias();
  } catch (err) {
    console.error("colonias_publicas:", err instanceof Error ? err.message : err);
    return [];
  }
}

export async function detalleColonia(id: number): Promise<ColoniaDetalle | null> {
  const sb = supabaseServidor();
  const { data, error } = await sb.rpc("colonia_publica", { p_id: id });
  if (!error) return (data as ColoniaDetalle | null) ?? null;

  const anterior = await sb.rpc("detalle_zona", { p_id: id, p_horas: 168 });
  if (anterior.error) throw new Error(anterior.error.message);
  const zona = anterior.data as DetalleZona | null;
  return zona ? { zona, por_tipo: {}, arreglados: 0, recientes: [], total: null } : null;
}

/** ¿Vale la pena que Google la indexe? Solo si algún vecino ya reportó algo ahí. */
export const tieneReportes = (c: ColoniaResumen) => (c.total ?? 0) > 0 || c.agua_7d > 0 || c.activos > 0 || c.ultimo !== null;
