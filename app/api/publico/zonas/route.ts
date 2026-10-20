import { cargarZonas } from "@/lib/datos";

// Polígonos de las colonias a través de la caché de Vercel: casi nunca cambian,
// así que Supabase solo se consulta una vez por hora aunque entren miles de personas.
export async function GET() {
  try {
    return Response.json(await cargarZonas(), {
      headers: { "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (err) {
    console.error("zonas:", err);
    return Response.json({ error: "No se pudieron cargar las colonias." }, { status: 502 });
  }
}
