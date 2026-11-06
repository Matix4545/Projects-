// Envío de correos con Resend (resend.com). Solo se usa en el servidor.
// Necesita RESEND_API_KEY y CORREO_REMITENTE (p. ej. "ChambaRadar <alertas@tudominio.com>",
// con el dominio verificado en Resend).

import type { Correo } from "./alertas.ts";

export function correoConfigurado(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.CORREO_REMITENTE);
}

/**
 * Manda hasta 100 correos en una sola llamada (API de lotes de Resend).
 * Devuelve true si Resend los aceptó todos.
 */
export async function enviarLote(correos: Correo[]): Promise<{ ok: boolean; error?: string }> {
  if (correos.length === 0) return { ok: true };
  if (correos.length > 100) throw new Error("Máximo 100 correos por lote");
  const r = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify(
      correos.map((c) => ({
        from: process.env.CORREO_REMITENTE,
        to: [c.para],
        subject: c.asunto,
        html: c.html,
        text: c.texto,
        headers: { "List-Unsubscribe": `<${c.bajaUnClic}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      })),
    ),
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) return { ok: false, error: `Resend respondió ${r.status}: ${(await r.text()).slice(0, 300)}` };
  return { ok: true };
}

/** Un solo correo transaccional (p. ej. "tu pago está listo"). Devuelve true si Resend lo aceptó. */
export async function enviarUno(c: { para: string; asunto: string; html: string; texto: string }): Promise<boolean> {
  if (!correoConfigurado()) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: process.env.CORREO_REMITENTE, to: [c.para], subject: c.asunto, html: c.html, text: c.texto }),
      signal: AbortSignal.timeout(15_000),
    });
    return r.ok;
  } catch {
    return false;
  }
}
