"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseSesion } from "@/lib/supabase/servidor";

const CAMPOS = ["empresa", "puesto", "categoria", "modalidad", "ubicacion", "sueldo_min", "sueldo_max", "periodo", "horario", "descripcion", "contacto_whatsapp", "contacto_correo", "contacto_url"];

/** FormData → objeto para las funciones de la base (que validan todo de nuevo). */
export async function datosDelFormulario(f: FormData): Promise<Record<string, string>> {
  return Object.fromEntries(CAMPOS.map((c) => [c, String(f.get(c) ?? "").trim()]));
}

function errorEnUrl(ruta: string, mensaje: string) {
  return `${ruta}?error=${encodeURIComponent(mensaje.replace(/^.*?:\s*/, "").slice(0, 140))}`;
}

/** Un negocio manda su vacante a revisión. */
export async function enviarVacante(f: FormData) {
  const sb = await supabaseSesion();
  const { data } = await sb.auth.getUser();
  if (!data.user) redirect("/entrar?siguiente=/publicar");
  const { error } = await sb.rpc("enviar_publicacion", { p_datos: await datosDelFormulario(f) });
  if (error) redirect(errorEnUrl("/publicar", error.message));
  revalidatePath("/publicar");
  redirect("/publicar?enviada=1");
}
