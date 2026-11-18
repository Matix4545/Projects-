import { sesionPanelValida } from "@/lib/panel";
import { sesionVoluntarioValida } from "@/lib/voluntarios";

// El mapa y /medir preguntan aquí quién es: equipo (contraseña del panel) o voluntario (código).
// El voluntario solo puede medir baches con la cámara.
export async function GET() {
  const equipo = await sesionPanelValida();
  const voluntario = !equipo && (await sesionVoluntarioValida());
  return Response.json({ equipo, voluntario }, { headers: { "Cache-Control": "private, no-store" } });
}
