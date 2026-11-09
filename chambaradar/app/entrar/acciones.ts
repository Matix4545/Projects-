"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { rutaSegura, urlSitio } from "@/lib/sitio";
import { supabaseSesion } from "@/lib/supabase/servidor";

/** Manda el enlace mágico al correo. Se usa en /entrar y en la ventana de "Aplicar". */
export async function enviarEnlace(formulario: FormData) {
  const siguiente = rutaSegura(String(formulario.get("siguiente") ?? ""));
  const email = z.email().safeParse(String(formulario.get("email") ?? "").trim().toLowerCase());
  if (!email.success) redirect(`/entrar?error=correo&siguiente=${encodeURIComponent(siguiente)}`);

  const sb = await supabaseSesion();
  const { error } = await sb.auth.signInWithOtp({
    email: email.data,
    options: { emailRedirectTo: `${urlSitio()}/auth/confirmar?siguiente=${encodeURIComponent(siguiente)}` },
  });
  if (error) redirect(`/entrar?error=envio&siguiente=${encodeURIComponent(siguiente)}`);
  redirect(`/entrar?enviado=1&siguiente=${encodeURIComponent(siguiente)}`);
}
