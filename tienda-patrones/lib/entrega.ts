import "server-only";
// Entrega de un pedido pagado: lo registra (una sola vez) y manda el correo con la liga de descarga.
import { TIENDA } from "./config";
import type { Articulo } from "./precios";
import { lineas } from "./precios";
import type { ResultadoPago } from "./pagos/tipos";
import { registrarPedido } from "./supabase";

function escapar(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

async function enviarCorreo(para: string, asunto: string, html: string): Promise<void> {
  const llave = process.env.RESEND_API_KEY;
  const de = process.env.CORREO_REMITENTE; // ej. "Trazo <pedidos@tudominio.com>"
  if (!llave || !de) return;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${llave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: de, to: [para], subject: asunto, html, reply_to: TIENDA.correo }),
  });
  if (!r.ok) console.error("No se pudo enviar el correo", r.status, await r.text().catch(() => ""));
}

export async function entregarPedido(pago: ResultadoPago, articulos: Articulo[] | null): Promise<void> {
  if (pago.estado !== "aprobado" || !articulos || pago.id === "demo" || !pago.referencia) return;
  const nuevo = await registrarPedido({
    id: pago.id,
    proveedor: pago.id.split(":")[0],
    correo: pago.correo,
    referencia: pago.referencia,
    total: pago.total,
    moneda: pago.moneda,
  });
  if (!nuevo || !pago.correo) return;

  const lista = lineas(articulos)
    .map((l) => `<li><strong>${escapar(l.patron.nombre)}</strong> · ${escapar(l.patron.tipo)} (licencia ${l.licencia})</li>`)
    .join("");
  const html = `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#2b2420">
    <h1 style="font-size:22px">¡Gracias por tu compra!</h1>
    <p>Tus patrones ya están listos para descargar:</p>
    <ul>${lista}</ul>
    <p style="margin:28px 0">
      <a href="${escapar(pago.liga)}" style="background:#c2552d;color:#fff;padding:14px 22px;border-radius:999px;text-decoration:none;font-weight:bold">Descargar mis patrones</a>
    </p>
    <p style="font-size:13px;color:#6b5f57">Guarda este correo: la liga funciona siempre, por si necesitas volver a descargar.
    Antes de imprimir, revisa que el cuadro de prueba mida exactamente 5 cm.</p>
    <p style="font-size:13px;color:#6b5f57">¿Dudas? Responde a este correo.<br>${escapar(TIENDA.nombre)}</p>
  </div>`;
  await enviarCorreo(pago.correo, `Tus patrones de ${TIENDA.nombre} están listos`, html);
}
