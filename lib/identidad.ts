import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";

const COOKIE = "rc_dispositivo";
const UN_ANIO = 60 * 60 * 24 * 365;

function hash(valor: string) {
  const secreto = process.env.HASH_SECRET;
  if (!secreto || secreto.length < 16) {
    throw new Error("Falta HASH_SECRET (mínimo 16 caracteres) en las variables de entorno.");
  }
  return createHmac("sha256", secreto).update(valor).digest("hex");
}

/**
 * Identidad anónima de quien envía:
 *  - dispositivo: ID aleatorio guardado en una cookie (se crea si no existe)
 *  - ip: tomada de los encabezados de Vercel
 * Solo se guardan sus HASH; nunca la IP real ni el ID en claro.
 */
export async function obtenerIdentidad() {
  const almacen = await cookies();
  const encabezados = await headers();

  let idDispositivo = almacen.get(COOKIE)?.value;
  if (!idDispositivo || !/^[0-9a-f-]{36}$/.test(idDispositivo)) {
    idDispositivo = randomUUID();
    almacen.set(COOKIE, idDispositivo, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: UN_ANIO,
      path: "/",
    });
  }

  const ip =
    encabezados.get("x-real-ip") ??
    encabezados.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;

  return {
    ip,
    dispositivoHash: hash(`disp:${idDispositivo}`),
    ipHash: hash(`ip:${ip ?? "desconocida"}`),
  };
}
