import { ETIQUETAS } from "@/lib/constantes";
import { diasValidos, sesionPanelValida } from "@/lib/panel";
import { supabaseServidor } from "@/lib/supabase/servidor";

export const runtime = "nodejs";

type Fila = {
  fecha: string;
  tipo: string;
  detalle: string;
  colonia: string | null;
  lat: number | null;
  lng: number | null;
  comentario: string | null;
  confirmaciones: number | null;
  estado: string | null;
};

function celda(v: unknown) {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(v);
  let s = String(v);
  // Evita que Excel interprete un comentario como fórmula (=, +, -, @)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  if (!(await sesionPanelValida())) return new Response("No autorizado", { status: 401 });
  const dias = diasValidos(new URL(req.url).searchParams.get("dias"));

  const { data, error } = await supabaseServidor().rpc("exportar_reportes", { p_dias: dias });
  if (error) return new Response("Error al generar el archivo", { status: 500 });

  const filas = (data as Fila[]).map((f) =>
    [
      new Date(f.fecha).toLocaleString("es-MX", { timeZone: "America/Hermosillo" }),
      ETIQUETAS[f.tipo] ?? (f.tipo === "agua" ? "Agua" : f.tipo),
      ETIQUETAS[f.detalle] ?? f.detalle,
      f.colonia,
      f.lat,
      f.lng,
      f.comentario,
      f.confirmaciones,
      f.estado === "arreglado" ? "Arreglado" : f.estado === "activo" ? "Activo" : "",
    ]
      .map(celda)
      .join(","),
  );
  const encabezado = "Fecha,Tipo,Detalle,Colonia,Latitud,Longitud,Comentario,Confirmaciones,Estado";
  // El BOM hace que Excel abra bien los acentos
  const csv = "﻿" + [encabezado, ...filas].join("\r\n");
  const hoy = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reporta-cajeme-${dias}dias-${hoy}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
