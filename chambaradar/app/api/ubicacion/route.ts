import { NextResponse, type NextRequest } from "next/server";
import { dentroDeSonora, esDeSonora, leerGeo } from "@/lib/geo";
import { zonaDeGeo } from "@/lib/estadisticas";
import { COOKIE_LOCAL, DIAS_VERIFICADO, marcaSonora, marcaValida } from "@/lib/ubicacion";

/** Diagnóstico: qué ubicación detecta el sitio para quien abre esta dirección (solo la suya, nada se guarda). */
export function GET(request: NextRequest) {
  const g = leerGeo(request.headers.get("x-nf-geo"));
  return NextResponse.json(
    {
      pais: g?.country?.code ?? null,
      estado: g?.subdivision?.name ?? g?.subdivision?.code ?? null,
      ciudad: g?.city ?? null,
      zona: zonaDeGeo(g),
      gratis_por_ip: esDeSonora(g),
      verificado_con_gps: marcaValida(request.cookies.get(COOKIE_LOCAL)?.value),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

/**
 * Verificación con el GPS: recibe { lat, lon, precision } del navegador. Si el
 * punto está en Sonora, deja una cookie firmada por 30 días. Las coordenadas
 * no se guardan en ningún lado.
 */
export async function POST(request: NextRequest) {
  const origen = request.headers.get("origin");
  if (origen && new URL(origen).host !== request.headers.get("host")) return NextResponse.json({ ok: false }, { status: 403 });
  let d: { lat?: unknown; lon?: unknown; precision?: unknown };
  try {
    d = await request.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: "datos" }, { status: 400 });
  }
  const lat = Number(d.lat);
  const lon = Number(d.lon);
  const precision = Number(d.precision);
  // Más de 25 km de margen no alcanza para saber de qué lado de la frontera está
  if (!Number.isFinite(precision) || precision > 25_000) return NextResponse.json({ ok: false, motivo: "precision" });
  if (!dentroDeSonora(lat, lon)) return NextResponse.json({ ok: false, motivo: "fuera" });

  const r = NextResponse.json({ ok: true });
  r.cookies.set(COOKIE_LOCAL, marcaSonora(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DIAS_VERIFICADO * 86_400,
  });
  return r;
}
