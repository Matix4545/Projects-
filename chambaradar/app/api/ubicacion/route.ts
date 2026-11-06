import { NextResponse, type NextRequest } from "next/server";
import { esDeSonora, leerGeo } from "@/lib/geo";
import { zonaDeGeo } from "@/lib/estadisticas";

/** Diagnóstico: qué ubicación detecta el sitio para quien abre esta dirección (solo la suya, nada se guarda). */
export function GET(request: NextRequest) {
  const g = leerGeo(request.headers.get("x-nf-geo"));
  return NextResponse.json(
    {
      pais: g?.country?.code ?? null,
      estado: g?.subdivision?.name ?? g?.subdivision?.code ?? null,
      ciudad: g?.city ?? null,
      zona: zonaDeGeo(g),
      gratis_por_sonora: esDeSonora(g),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
