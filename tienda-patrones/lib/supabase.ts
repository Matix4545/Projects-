import "server-only";
// Acceso a Supabase con la llave de servicio (solo en el servidor).
// Se usa para: archivos privados de los patrones (Storage) y registro de pedidos.

const URL_SB = process.env.SUPABASE_URL?.replace(/\/$/, "");
const LLAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const BUCKET = process.env.SUPABASE_BUCKET || "patrones";

export function supabaseConfigurado(): boolean {
  return Boolean(URL_SB && LLAVE);
}

function encabezados(extra: Record<string, string> = {}) {
  return { apikey: LLAVE!, Authorization: `Bearer ${LLAVE}`, ...extra };
}

/** Liga temporal (2 min) para descargar un archivo privado. null si no existe. */
export async function ligaFirmada(ruta: string, nombreDescarga: string): Promise<string | null> {
  if (!supabaseConfigurado()) return null;
  const r = await fetch(`${URL_SB}/storage/v1/object/sign/${BUCKET}/${ruta}`, {
    method: "POST",
    headers: encabezados({ "Content-Type": "application/json" }),
    body: JSON.stringify({ expiresIn: 120 }),
    cache: "no-store",
  });
  if (!r.ok) return null;
  const { signedURL } = (await r.json()) as { signedURL?: string };
  if (!signedURL) return null;
  const separador = signedURL.includes("?") ? "&" : "?";
  return `${URL_SB}/storage/v1${signedURL}${separador}download=${encodeURIComponent(nombreDescarga)}`;
}

export type Pedido = {
  id: string; // "mp:123456" o "stripe:cs_..."
  proveedor: string;
  correo: string | null;
  referencia: string;
  total: number | null;
  moneda: string | null;
};

/**
 * Guarda el pedido si es nuevo. Devuelve true solo la PRIMERA vez que se registra
 * (así el correo de entrega se manda una sola vez aunque lleguen avisos repetidos).
 */
export async function registrarPedido(p: Pedido): Promise<boolean> {
  if (!supabaseConfigurado()) return false;
  const r = await fetch(`${URL_SB}/rest/v1/pedidos?on_conflict=id`, {
    method: "POST",
    headers: encabezados({
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=representation",
    }),
    body: JSON.stringify(p),
    cache: "no-store",
  });
  if (!r.ok) {
    console.error("No se pudo registrar el pedido", r.status, await r.text().catch(() => ""));
    return false;
  }
  const filas = (await r.json()) as unknown[];
  return Array.isArray(filas) && filas.length > 0;
}
