import { sesionPanelValida } from "@/lib/panel";
import { error } from "@/lib/respuestas";
import { supabaseServidor } from "@/lib/supabase/servidor";

// Tramos de rugosidad medidos y golpes: por ahora solo para el equipo
export async function GET(req: Request) {
  if (!(await sesionPanelValida())) return error("Necesitas entrar con la contraseña del equipo.", 401);
  const pedido = Number(new URL(req.url).searchParams.get("dias"));
  const dias = Number.isInteger(pedido) && pedido > 0 && pedido <= 3650 ? pedido : 30;
  const { data, error: err } = await supabaseServidor().rpc("rugosidad_equipo", { p_dias: dias });
  if (err) {
    console.error("rugosidad_equipo:", err.message);
    return error("No se pudo cargar la rugosidad. ¿Ya corriste los .sql?", 500);
  }
  return Response.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
