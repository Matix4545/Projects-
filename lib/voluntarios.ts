import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { supabaseServidor } from "@/lib/supabase/servidor";

// Voluntarios: personas de confianza que miden baches con la cámara en /medir.
// Entran con un código que el equipo ve y cambia en /panel → Voluntarios (se guarda en la base,
// tabla privada ajustes_equipo). No ven el panel ni datos del equipo: solo pueden subir baches.
// Al cambiar el código se cierran todas las sesiones de voluntario.

export const COOKIE_VOLUNTARIO = "rc_voluntario";
const CLAVE = "codigo_voluntarios";
// Sin 0/O ni 1/I/L para que no se confundan al dictarlo
const LETRAS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** "k7q 29m" → "K7Q29M": sin espacios ni guiones, en mayúsculas */
export const normalizarCodigo = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Código para mostrar: "K7Q-29M" */
export const formatoCodigo = (c: string) => (c.length === 6 ? `${c.slice(0, 3)}-${c.slice(3)}` : c);

export async function codigoVoluntarios(): Promise<string | null> {
  const { data } = await supabaseServidor().from("ajustes_equipo").select("valor").eq("clave", CLAVE).maybeSingle();
  return data?.valor ? normalizarCodigo(data.valor) : null;
}

/** Crea un código nuevo (el anterior deja de servir) y lo devuelve */
export async function nuevoCodigoVoluntarios(): Promise<string> {
  const codigo = Array.from({ length: 6 }, () => LETRAS[randomInt(LETRAS.length)]).join("");
  const { error } = await supabaseServidor()
    .from("ajustes_equipo")
    .upsert({ clave: CLAVE, valor: codigo, actualizado: new Date().toISOString() });
  if (error) throw new Error(error.message);
  return codigo;
}

/** Quita el código: nadie puede entrar como voluntario */
export async function quitarCodigoVoluntarios() {
  await supabaseServidor().from("ajustes_equipo").delete().eq("clave", CLAVE);
}

/** Token de la sesión: depende del código, así que al cambiarlo se cierran las sesiones */
export function tokenVoluntario(codigo: string) {
  return createHmac("sha256", process.env.HASH_SECRET!).update(`voluntario:${codigo}`).digest("hex");
}

function iguales(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Si el texto es el código de voluntarios vigente, el token de sesión; si no, null */
export async function tokenSiCodigoCorrecto(texto: string) {
  if (!process.env.HASH_SECRET) return null;
  const codigo = await codigoVoluntarios();
  const dado = normalizarCodigo(texto);
  return codigo && iguales(dado, codigo) ? tokenVoluntario(codigo) : null;
}

export async function sesionVoluntarioValida() {
  if (!process.env.HASH_SECRET) return false;
  const valor = (await cookies()).get(COOKIE_VOLUNTARIO)?.value;
  if (!valor) return false;
  const codigo = await codigoVoluntarios();
  return !!codigo && iguales(valor, tokenVoluntario(codigo));
}
