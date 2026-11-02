// Función programada de Netlify: cada 30 minutos revisa un turno de empresas
// (48 turnos al día), así cada corrida dura pocos segundos y en 24 horas se
// revisan todas. Necesita las variables NEXT_PUBLIC_SUPABASE_URL,
// NEXT_PUBLIC_SUPABASE_ANON_KEY y CHAMBARADAR_CLAVE.

import empresas from "../../data/empresas.json";
import { guardarEnSupabase, recolectar, turnoDeEmpresas } from "../../lib/recolector.ts";
import type { Empresa } from "../../lib/tipos.ts";

const TURNOS = 48;

export default async () => {
  const ahora = new Date();
  const turno = Math.floor((ahora.getUTCHours() * 60 + ahora.getUTCMinutes()) / 30);
  const lista = turnoDeEmpresas(empresas as Empresa[], turno, TURNOS);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clavePublica = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const claveApp = process.env.CHAMBARADAR_CLAVE;
  if (!url || !clavePublica || !claveApp) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY o CHAMBARADAR_CLAVE");
    return;
  }

  const r = await recolectar(lista, { ahora, paralelo: 6 });
  const { guardadas, cerradas } = await guardarEnSupabase(r, { url, clavePublica, claveApp, ahora });
  console.log(
    `Turno ${turno}/${TURNOS}: ${lista.length} empresas, ${guardadas} vacantes guardadas, ${cerradas} cerradas` +
      (r.fallidas.length ? `, fallaron: ${r.fallidas.map((f) => `${f.slug} (${f.error})`).join("; ")}` : ""),
  );
};

export const config = { schedule: "*/30 * * * *" };
