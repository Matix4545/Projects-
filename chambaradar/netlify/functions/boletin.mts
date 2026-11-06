// Función programada de Netlify: cada martes manda el boletín "5 vacantes
// remotas en dólares" a quien dejó su correo (tabla suscriptores). La base
// solo entrega a cada persona una vez cada 6 días y no repite vacantes en 30.
// Necesita: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, CHAMBARADAR_CLAVE,
// NEXT_PUBLIC_SITE_URL, RESEND_API_KEY y CORREO_REMITENTE.

import { createClient } from "@supabase/supabase-js";
import { correoDeBoletin, type Suscriptor, type VacanteBoletin } from "../../lib/boletin.ts";
import { correoConfigurado, enviarLote } from "../../lib/correo.ts";
import { RESPONSABLE } from "../../lib/legal.ts";
import { pesosPor } from "../../lib/monedas.ts";
import { PLANES } from "../../lib/planes.ts";

export default async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clavePublica = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const claveApp = process.env.CHAMBARADAR_CLAVE;
  const sitio = (process.env.NEXT_PUBLIC_SITE_URL || "https://chambaradar.com").replace(/\/$/, "");
  if (!url || !clavePublica || !claveApp) return console.error("Faltan variables de Supabase o CHAMBARADAR_CLAVE");
  if (!correoConfigurado()) return console.log("Boletín en pausa: falta RESEND_API_KEY o CORREO_REMITENTE");

  const sb = createClient(url, clavePublica, { auth: { persistSession: false } });
  const { data: s, error: e1 } = await sb.rpc("boletin_suscriptores", { p_clave: claveApp, p_limite: 100 });
  if (e1) return console.error(`Error leyendo suscriptores: ${e1.message}`);
  const suscriptores = (s ?? []) as Suscriptor[];
  if (suscriptores.length === 0) return console.log("Sin suscriptores pendientes esta semana");

  const { data: v, error: e2 } = await sb.rpc("boletin_vacantes", { p_clave: claveApp, p_pais: "MX", p_n: 5 });
  if (e2) return console.error(`Error leyendo vacantes: ${e2.message}`);
  const vacantes = (v ?? []) as VacanteBoletin[];
  if (vacantes.length === 0) return console.log("No hay vacantes en dólares para mandar; se intenta la próxima semana");

  const [tasaUsd, resumen] = await Promise.all([pesosPor("USD"), sb.rpc("resumen_vacantes")]);
  const opciones = { sitio, responsable: RESPONSABLE, tasaUsd, precioSemana: `$${PLANES.find((p) => p.id === "semana")!.precio}`, totalRemotas: (resumen.data as { remotas?: number } | null)?.remotas };
  const correos = suscriptores.map((x) => correoDeBoletin(x, vacantes, opciones));
  const envio = await enviarLote(correos);
  if (!envio.ok) return console.error(`No se enviaron ${correos.length} boletines: ${envio.error}`);

  const { error: e3 } = await sb.rpc("marcar_boletin_enviado", { p_clave: claveApp, p_ids: suscriptores.map((x) => x.id), p_vacantes: vacantes.map((x) => x.id) });
  if (e3) return console.error(`Boletines enviados, pero no se marcaron: ${e3.message}`);
  console.log(`Enviados ${correos.length} boletines con ${vacantes.length} vacantes`);
};

// Martes 9:00 de Hermosillo (16:00 UTC). Si hay más de 100 suscriptores, la siguiente hora manda el resto.
export const config = { schedule: "0 16,17,18 * * 2" };
