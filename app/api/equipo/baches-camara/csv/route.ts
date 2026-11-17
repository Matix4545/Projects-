import { nivelBache } from "@/lib/constantes";
import { sesionPanelValida } from "@/lib/panel";
import { supabaseServidor } from "@/lib/supabase/servidor";

export const runtime = "nodejs";

// CSV con cada bache que detectó la cámara (una fila por recorrido que lo vio): para revisar
// medidas contra cinta métrica, comparar modelos o calibraciones
const COLUMNAS = [
  "id",
  "fecha",
  "sesion",
  "pin_id",
  "lat",
  "lng",
  "calle",
  "rumbo",
  "precision_m",
  "ajuste_m",
  "area_m2",
  "nivel",
  "area_sd_m2",
  "largo_m",
  "ancho_m",
  "confianza",
  "confianza_max",
  "cuadros",
  "medidas",
  "distancia_m",
  "altura_m",
  "fov",
  "plataforma",
  "modelo",
  "foto_ruta",
] as const;

function celda(v: unknown) {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(v);
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  if (!(await sesionPanelValida())) return new Response("No autorizado", { status: 401 });
  const pedido = Number(new URL(req.url).searchParams.get("dias"));
  const dias = Number.isInteger(pedido) && pedido > 0 && pedido <= 3650 ? pedido : 3650;
  const { data, error } = await supabaseServidor().rpc("exportar_detecciones_bache", { p_dias: dias });
  if (error) {
    console.error("exportar_detecciones_bache:", error.message);
    return new Response("Error al generar el archivo. ¿Ya corriste los .sql?", { status: 500 });
  }
  const filas = (data as Record<string, unknown>[]).map((f) =>
    COLUMNAS.map((c) => celda(c === "nivel" ? nivelBache(f.area_m2 as number | null)?.clave : f[c])).join(","),
  );
  const csv = "﻿" + [COLUMNAS.join(","), ...filas].join("\r\n");
  const hoy = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="baches-camara-cajeme-${hoy}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
