import { LARGO_MAX_TRAMO, dentroDeCajeme } from "@/lib/constantes";
import { obtenerIdentidad } from "@/lib/identidad";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { distanciaM, largoM, limpiarTrazo, type Punto } from "@/lib/tramos";

// GET /api/ruta?de=lat,lng&a=lat,lng → tramo de calle entre dos puntos, siguiendo las calles.
// Usa OpenRouteService si hay ORS_API_KEY; si no, el servidor público de rutas de OpenStreetMap (FOSSGIS).
// Si el servicio falla o da un rodeo raro, devuelve la línea recta para que siempre se pueda reportar.

const TIEMPO_MAX_MS = 5000;
// Rutas al día por conexión: un vecino marca pocas calles; esto evita que alguien agote
// la cuota del servicio de rutas (las rutas repetidas salen de la caché y no cuentan)
const RUTAS_DIA_IP = 200;
const AGENTE = `ReportaCajeme/1.0 (${process.env.NEXT_PUBLIC_CONTACTO ?? "proyecto ciudadano"})`;

function leerPunto(texto: string | null): Punto | null {
  const [lat, lng] = (texto ?? "").split(",").map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !dentroDeCajeme(lat, lng)) return null;
  // Redondeo a ~1 m: puntos casi iguales comparten caché
  return [Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5];
}

/** Coordenadas GeoJSON [lng, lat] → [lat, lng] */
const voltear = (coords: [number, number][]): Punto[] => coords.map(([lng, lat]) => [lat, lng]);

async function rutaOrs(de: Punto, a: Punto, clave: string): Promise<Punto[]> {
  const url = new URL("https://api.openrouteservice.org/v2/directions/foot-walking");
  url.searchParams.set("start", `${de[1]},${de[0]}`);
  url.searchParams.set("end", `${a[1]},${a[0]}`);
  const res = await fetch(url, {
    headers: { Authorization: clave, Accept: "application/geo+json" },
    signal: AbortSignal.timeout(TIEMPO_MAX_MS),
  });
  if (!res.ok) throw new Error(`ORS ${res.status}`);
  const datos = await res.json();
  return voltear(datos.features[0].geometry.coordinates);
}

async function rutaOsrm(de: Punto, a: Punto): Promise<Punto[]> {
  const url = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${de[1]},${de[0]};${a[1]},${a[0]}?overview=full&geometries=geojson`;
  const res = await fetch(url, { headers: { "User-Agent": AGENTE }, signal: AbortSignal.timeout(TIEMPO_MAX_MS) });
  if (!res.ok) throw new Error(`OSRM ${res.status}`);
  const datos = await res.json();
  if (datos.code !== "Ok") throw new Error(`OSRM ${datos.code}`);
  return voltear(datos.routes[0].geometry.coordinates);
}

export async function GET(req: Request) {
  const busqueda = new URL(req.url).searchParams;
  const de = leerPunto(busqueda.get("de"));
  const a = leerPunto(busqueda.get("a"));
  if (!de || !a) return Response.json({ error: "Puntos fuera de Cajeme." }, { status: 400 });

  const recta = distanciaM(de, a);
  if (recta > LARGO_MAX_TRAMO) {
    return Response.json({ error: "El tramo es muy largo (máximo 3 km). Márcalo por partes." }, { status: 400 });
  }

  const { ipHash } = await obtenerIdentidad();
  const { data: hayCupo, error: errCupo } = await supabaseServidor().rpc("consumir_cupo_ip", {
    p_ip_hash: `${ipHash}:ruta`,
    p_max: RUTAS_DIA_IP,
  });
  // Sin cupo (o sin base de datos) se devuelve la línea recta: se puede reportar igual
  if (errCupo || !hayCupo) return Response.json({ puntos: [de, a], ajustada: false }, { headers: { "Cache-Control": "no-store" } });

  let puntos: Punto[] = [de, a];
  let ajustada = false;
  try {
    const clave = process.env.ORS_API_KEY;
    const ruta = limpiarTrazo(clave ? await rutaOrs(de, a, clave) : await rutaOsrm(de, a));
    // Se descarta si da un rodeo (p. ej. a otra cuadra) o trae demasiados puntos
    if (ruta.length >= 2 && ruta.length <= 500 && largoM(ruta) <= recta * 1.8 + 80) {
      // La ruta empieza y termina sobre la calle más cercana a donde tocó la persona
      puntos = ruta;
      ajustada = true;
    }
  } catch (err) {
    console.error("ruta:", err instanceof Error ? err.message : err);
  }

  return Response.json(
    { puntos, ajustada },
    // Una ruta entre los mismos puntos no cambia: se guarda un día en la caché de Vercel
    { headers: { "Cache-Control": ajustada ? "public, max-age=3600, s-maxage=86400" : "no-store" } },
  );
}
