import { sesionPanelValida } from "@/lib/panel";
import { supabaseServidor } from "@/lib/supabase/servidor";

export const runtime = "nodejs";

// CSV con todos los tramos medidos y sus datos de calibración, para analizarlos en Excel,
// R o Python (por ejemplo, para convertir a IRI cuando haya tramos de referencia)
const COLUMNAS = [
  "id",
  "fecha",
  "sesion",
  "vehiculo",
  "soporte",
  "plataforma",
  "nota",
  "largo_m",
  "vel_kmh",
  "vel_sd",
  "rms",
  "rms_baja",
  "p95",
  "n_golpes",
  "hz",
  "lat",
  "lng",
  "trazo",
] as const;

function celda(v: unknown) {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(v);
  let s = String(v);
  // Evita que Excel interprete una nota como fórmula (=, +, -, @)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  if (!(await sesionPanelValida())) return new Response("No autorizado", { status: 401 });
  const pedido = Number(new URL(req.url).searchParams.get("dias"));
  const dias = Number.isInteger(pedido) && pedido > 0 && pedido <= 3650 ? pedido : 3650;

  const { data, error } = await supabaseServidor().rpc("exportar_rugosidad", { p_dias: dias });
  if (error) {
    console.error("exportar_rugosidad:", error.message);
    return new Response("Error al generar el archivo. ¿Ya corriste los .sql?", { status: 500 });
  }
  const filas = (data as Record<string, unknown>[]).map((f) => COLUMNAS.map((c) => celda(f[c])).join(","));
  const csv = "﻿" + [COLUMNAS.join(","), ...filas].join("\r\n");
  const hoy = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rugosidad-cajeme-${hoy}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
