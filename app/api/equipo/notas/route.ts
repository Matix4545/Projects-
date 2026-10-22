import { z } from "zod";
import { sesionPanelValida } from "@/lib/panel";
import { error, ok } from "@/lib/respuestas";
import { supabaseServidor } from "@/lib/supabase/servidor";

// Notas privadas del equipo sobre un reporte. Todo exige la sesión del panel.
export const runtime = "nodejs";

const SIN_ACCESO = () => error("Necesitas entrar con la contraseña del equipo.", 401);
const id = (v: string | null) => {
  const n = Number(v);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};

export async function GET(req: Request) {
  if (!(await sesionPanelValida())) return SIN_ACCESO();
  const pinId = id(new URL(req.url).searchParams.get("pin"));
  if (!pinId) return error("Reporte no válido.");
  const { data, error: err } = await supabaseServidor()
    .from("notas_pin")
    .select("id, texto, autor, creado_en")
    .eq("pin_id", pinId)
    .order("creado_en", { ascending: true });
  if (err) return error("No se pudieron cargar las notas.", 500);
  return ok({ notas: data });
}

const Nota = z.object({
  pin_id: z.number().int().positive(),
  texto: z.string().trim().min(1).max(500),
  autor: z.string().trim().max(40).optional(),
});

export async function POST(req: Request) {
  if (!(await sesionPanelValida())) return SIN_ACCESO();
  const r = Nota.safeParse(await req.json().catch(() => null));
  if (!r.success) return error("Escribe la nota (máximo 500 caracteres).");
  const { data, error: err } = await supabaseServidor()
    .from("notas_pin")
    .insert({ pin_id: r.data.pin_id, texto: r.data.texto, autor: r.data.autor || null })
    .select("id, texto, autor, creado_en")
    .single();
  if (err) return error(err.code === "23503" ? "Ese reporte ya no existe." : "No se pudo guardar la nota.", 500);
  return ok({ nota: data });
}

export async function DELETE(req: Request) {
  if (!(await sesionPanelValida())) return SIN_ACCESO();
  const notaId = id(new URL(req.url).searchParams.get("id"));
  if (!notaId) return error("Nota no válida.");
  const { error: err } = await supabaseServidor().from("notas_pin").delete().eq("id", notaId);
  if (err) return error("No se pudo borrar la nota.", 500);
  return ok({});
}
