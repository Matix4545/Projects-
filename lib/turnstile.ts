import "server-only";

/** Verifica con Cloudflare que el token de Turnstile sea válido y no se haya usado. */
export async function verificarTurnstile(token: unknown, ip: string | null): Promise<boolean> {
  const secreto = process.env.TURNSTILE_SECRET_KEY;
  if (!secreto) {
    console.error("Falta TURNSTILE_SECRET_KEY");
    return false;
  }
  if (typeof token !== "string" || token.length === 0 || token.length > 2048) return false;

  const cuerpo = new URLSearchParams({ secret: secreto, response: token });
  if (ip) cuerpo.set("remoteip", ip);

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: cuerpo,
      cache: "no-store",
    });
    const datos = (await res.json()) as { success?: boolean; "error-codes"?: string[]; hostname?: string };
    if (datos.success !== true) {
      // Aparece en Vercel → Logs. "invalid-input-secret" = TURNSTILE_SECRET_KEY incorrecta
      console.error("Turnstile rechazó el token:", datos["error-codes"], datos.hostname);
    }
    return datos.success === true;
  } catch (e) {
    console.error("Error verificando Turnstile", e);
    return false;
  }
}
