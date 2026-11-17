import { sesionPanelValida } from "@/lib/panel";
import { supabaseServidor } from "@/lib/supabase/servidor";

export const runtime = "nodejs";

// CSV: cada medida de referencia contra lo que midió la cámara a menos de 10 m
const COLUMNAS = ["id", "fecha", "nota", "referencia", "area_ref", "area_camara", "error_pct", "detecciones", "dist_m", "largo_m", "ancho_m", "precision_m", "calle", "lat", "lng"] as const;

function celda(v: unknown) {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(v);
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  if (!(await sesionPanelValida())) return new Response("No autorizado", { status: 401 });
  const { data, error } = await supabaseServidor().rpc("comparar_referencias", { p_dias: 3650 });
  if (error) {
    console.error("comparar_referencias:", error.message);
    return new Response("Error al generar el archivo. ¿Ya corriste los .sql?", { status: 500 });
  }
  const filas = ((data as { filas: Record<string, unknown>[] }).filas ?? []).map((f) => COLUMNAS.map((c) => celda(f[c])).join(","));
  const csv = "﻿" + [COLUMNAS.join(","), ...filas].join("\r\n");
  const hoy = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="precision-camara-cajeme-${hoy}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
