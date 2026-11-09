// Función programada de Netlify: cada hora manda las alertas por correo que
// tienen vacantes nuevas. La base solo entrega cada alerta una vez cada 20 horas,
// así que cada persona recibe máximo un correo al día por alerta.
// Necesita: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, CHAMBARADAR_CLAVE,
// NEXT_PUBLIC_SITE_URL, RESEND_API_KEY y CORREO_REMITENTE.

import { createClient } from "@supabase/supabase-js";
import { correoDeAlerta, type AlertaPorEnviar } from "../../lib/alertas.ts";
import { correoConfigurado, enviarLote } from "../../lib/correo.ts";
import { RESPONSABLE } from "../../lib/legal.ts";
import { pagosActivos } from "../../lib/planes.ts";

export default async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clavePublica = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const claveApp = process.env.CHAMBARADAR_CLAVE;
  const sitio = (process.env.NEXT_PUBLIC_SITE_URL || "https://chambaradar.com").replace(/\/$/, "");
  if (!url || !clavePublica || !claveApp) return console.error("Faltan variables de Supabase o CHAMBARADAR_CLAVE");
  // Sin proveedor de correo no se toca nada: las alertas esperan hasta que se configure
  if (!correoConfigurado()) return console.log("Alertas en pausa: falta RESEND_API_KEY o CORREO_REMITENTE");

  const sb = createClient(url, clavePublica, { auth: { persistSession: false } });
  const inicio = new Date();
  const { data, error } = await sb.rpc("alertas_por_enviar", { p_clave: claveApp, p_limite: 100 });
  if (error) return console.error(`Error leyendo alertas: ${error.message}`);
  const alertas = (data ?? []) as AlertaPorEnviar[];
  if (alertas.length === 0) return console.log("Sin alertas con vacantes nuevas");

  const correos = alertas.map((a) => correoDeAlerta(a, { sitio, responsable: RESPONSABLE, pagosActivos: pagosActivos() }));
  const envio = await enviarLote(correos);
  if (!envio.ok) return console.error(`No se enviaron ${correos.length} alertas: ${envio.error}`);

  // Solo si Resend los aceptó: las próximas "nuevas" cuentan desde que empezó esta corrida
  const { error: e2 } = await sb.rpc("marcar_alertas_enviadas", { p_clave: claveApp, p_ids: alertas.map((a) => a.id), p_hasta: inicio.toISOString() });
  if (e2) return console.error(`Correos enviados, pero no se marcaron: ${e2.message}`);
  console.log(`Enviadas ${correos.length} alertas`);
};

export const config = { schedule: "17 * * * *" };
