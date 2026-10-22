import { sesionPanelValida } from "@/lib/panel";
import { error } from "@/lib/respuestas";
import { supabaseServidor } from "@/lib/supabase/servidor";

// Secciones electorales con su número de reportes: solo para el equipo
export async function GET(req: Request) {
  if (!(await sesionPanelValida())) return error("Necesitas entrar con la contraseña del equipo.", 401);
  const pedido = Number(new URL(req.url).searchParams.get("dias"));
  const dias = Number.isInteger(pedido) && pedido > 0 && pedido <= 3650 ? pedido : 30;
  const { data, error: err } = await supabaseServidor().rpc("secciones_mapa", { p_dias: dias });
  if (err) {
    console.error("secciones_mapa:", err.message);
    return error("No se pudieron cargar las secciones. ¿Ya corriste los .sql y el importador?", 500);
  }
  return Response.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
