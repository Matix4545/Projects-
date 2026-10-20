import { PERIODOS, PERIODO_PREDETERMINADO } from "@/lib/constantes";
import { leerMapa } from "@/lib/datos";

// Colores de colonias, puntos y resumen en una sola respuesta, guardada 15 s en la caché de Vercel.
// Así, con miles de personas viendo el mapa, Supabase recibe unas 4 consultas por minuto.
export async function GET(req: Request) {
  const pedido = Number(new URL(req.url).searchParams.get("horas"));
  const horas = PERIODOS.some((p) => p.horas === pedido) ? pedido : PERIODO_PREDETERMINADO;
  try {
    return Response.json(await leerMapa(horas), {
      headers: { "Cache-Control": "public, max-age=0, s-maxage=15, stale-while-revalidate=60" },
    });
  } catch (err) {
    console.error("mapa:", err);
    return Response.json({ error: "No se pudieron cargar los reportes." }, { status: 502 });
  }
}
