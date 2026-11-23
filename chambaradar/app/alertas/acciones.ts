"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { rutaSegura } from "@/lib/sitio";
import { supabaseConfigurado, supabaseSesion } from "@/lib/supabase/servidor";
import type { FiltrosAlerta } from "@/lib/alertas";

/** Guarda la búsqueda actual como alerta. Sin sesión, manda a entrar y regresa. */
export async function crearAlerta(formulario: FormData) {
  const vuelta = rutaSegura(String(formulario.get("vuelta") ?? ""), "/vacantes");
  const separador = vuelta.includes("?") ? "&" : "?";
  if (!supabaseConfigurado()) redirect(`${vuelta}${separador}alerta=error`);

  const sb = await supabaseSesion();
  const { data } = await sb.auth.getUser();
  if (!data.user) redirect(`/entrar?siguiente=${encodeURIComponent(vuelta)}`);

  let filtros: FiltrosAlerta = {};
  try {
    filtros = JSON.parse(String(formulario.get("filtros") ?? "{}"));
  } catch {
    /* filtros vacíos = todas las vacantes */
  }
  const { error } = await sb.rpc("crear_alerta", { p_filtros: filtros });
  if (error) redirect(`${vuelta}${separador}alerta=${error.message.includes("máximo") ? "limite" : "error"}`);
  redirect(`${vuelta}${separador}alerta=creada`);
}

/** Borra una alerta propia (la política de la tabla impide borrar las de otros). */
export async function borrarAlerta(formulario: FormData) {
  const id = String(formulario.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  const sb = await supabaseSesion();
  await sb.from("alertas").delete().eq("id", id);
  revalidatePath("/cuenta");
}
