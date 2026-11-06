"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { datosDelFormulario } from "@/app/publicar/acciones";
import { supabaseSesion } from "@/lib/supabase/servidor";

/** El administrador captura una vacante (p. ej. de un cartel) y la publica de una vez. */
export async function capturarVacante(f: FormData) {
  const sb = await supabaseSesion();
  const { error } = await sb.rpc("capturar_publicacion", { p_datos: await datosDelFormulario(f) });
  if (error) redirect(`/panel?error=${encodeURIComponent(error.message.slice(0, 140))}`);
  revalidatePath("/panel");
  revalidatePath("/vacantes");
  redirect("/panel?publicada=1");
}

/** Aprobar, rechazar o retirar una publicación. */
export async function revisarVacante(f: FormData) {
  const id = String(f.get("id") ?? "");
  const accion = String(f.get("accion") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id) || !["aprobar", "rechazar", "retirar"].includes(accion)) return;
  const sb = await supabaseSesion();
  const { error } = await sb.rpc("revisar_publicacion", { p_id: id, p_accion: accion });
  if (error) redirect(`/panel?error=${encodeURIComponent(error.message.slice(0, 140))}`);
  revalidatePath("/panel");
  revalidatePath("/vacantes");
}
