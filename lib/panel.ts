import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const COOKIE_PANEL = "rc_panel";
/**
 * Aviso visible para el navegador (no es la sesión): le dice al mapa que pregunte si hay modo equipo.
 * La seguridad la da COOKIE_PANEL, que el navegador no puede leer.
 */
export const COOKIE_AVISO_EQUIPO = "rc_equipo";

/** El panel solo existe si se configuró una contraseña de al menos 10 caracteres. */
export function panelConfigurado() {
  return (process.env.PANEL_CLAVE?.length ?? 0) >= 10 && !!process.env.HASH_SECRET;
}

/** Token de sesión: depende de la contraseña, así que al cambiarla se cierran todas las sesiones. */
export function tokenPanel() {
  return createHmac("sha256", process.env.HASH_SECRET!).update(`panel:${process.env.PANEL_CLAVE}`).digest("hex");
}

function iguales(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function claveCorrecta(clave: string) {
  return panelConfigurado() && iguales(clave, process.env.PANEL_CLAVE!);
}

export async function sesionPanelValida() {
  if (!panelConfigurado()) return false;
  const valor = (await cookies()).get(COOKIE_PANEL)?.value;
  return !!valor && iguales(valor, tokenPanel());
}

/** Periodos permitidos en el reporte */
export function diasValidos(valor: unknown) {
  const n = Number(valor);
  return [7, 30, 90].includes(n) ? n : 30;
}
