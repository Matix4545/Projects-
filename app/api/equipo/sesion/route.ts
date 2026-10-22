import { sesionPanelValida } from "@/lib/panel";

// El mapa pregunta aquí si quien lo ve es del equipo (entró con la contraseña del panel)
export async function GET() {
  return Response.json({ equipo: await sesionPanelValida() }, { headers: { "Cache-Control": "private, no-store" } });
}
