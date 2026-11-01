import { cargarHistorico } from "@/lib/datos";

// Todos los reportes desde el inicio (solo tipo y ubicación) para las burbujas del mapa.
// Cambia poco a poco: 5 minutos en la caché de Vercel.
export async function GET() {
  try {
    return Response.json(await cargarHistorico(), {
      headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=3600" },
    });
  } catch (err) {
    console.error("historico:", err);
    return Response.json({ error: "No se pudo cargar el historial." }, { status: 502 });
  }
}
