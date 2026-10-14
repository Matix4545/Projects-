import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Avisa al administrador (notificación en su celular con la app ntfy)
 * cada vez que el total de reportes cruza un múltiplo de AVISAR_CADA (100 por defecto).
 * Si NTFY_TOPIC no está configurado, no hace nada. Nunca lanza errores.
 */
export async function avisarSiHayHito(db: SupabaseClient) {
  const tema = process.env.NTFY_TOPIC?.trim();
  if (!tema) return;
  const cada = Number(process.env.AVISAR_CADA) || 100;

  try {
    const { data: hito, error } = await db.rpc("reclamar_hito", { p_cada: cada });
    if (error) throw error;
    if (!hito) return;

    const { data: resumen } = await db.rpc("resumen_24h");
    const sitio = process.env.NEXT_PUBLIC_SITE_URL
      || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined);

    const res = await fetch("https://ntfy.sh/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: tema,
        title: `Reporta Cajeme: ¡${Number(hito).toLocaleString("es-MX")} reportes!`,
        message: resumen
          ? `Últimas 24 h: ${resumen.reportes} reportes · ${resumen.colonias_afectadas} colonias afectadas`
          : "Se alcanzó un nuevo hito de reportes.",
        tags: ["tada"],
        ...(sitio ? { click: sitio } : {}),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.error("ntfy respondió", res.status);
  } catch (e) {
    console.error("No se pudo enviar el aviso de hito:", e);
  }
}
