// Función en segundo plano de Netlify (hasta 15 minutos): recolecta un turno
// de empresas y lo guarda en Supabase. La dispara la función programada
// recolectar.mts cada 30 minutos (48 turnos al día). Necesita
// NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY y CHAMBARADAR_CLAVE.

import empresas from "../../data/empresas.json";
import { guardarEnSupabase, recolectar, turnoDeEmpresas } from "../../lib/recolector.ts";
import type { Empresa } from "../../lib/tipos.ts";

export const TURNOS = 48;

export default async (request: Request) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clavePublica = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const claveApp = process.env.CHAMBARADAR_CLAVE;
  if (!url || !clavePublica || !claveApp) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY o CHAMBARADAR_CLAVE");
    return;
  }
  // Solo la función programada (que conoce la clave de la app) puede dispararla
  if (request.headers.get("x-chambaradar-clave") !== claveApp) {
    console.error("Disparo sin clave: se ignora");
    return;
  }

  const ahora = new Date();
  const turno = Number(new URL(request.url).searchParams.get("turno") ?? Math.floor((ahora.getUTCHours() * 60 + ahora.getUTCMinutes()) / 30)) % TURNOS;
  const lista = turnoDeEmpresas(empresas as Empresa[], turno, TURNOS);
  const r = await recolectar(lista, { ahora, paralelo: 6 });
  const { guardadas, cerradas } = await guardarEnSupabase(r, { url, clavePublica, claveApp, ahora });
  console.log(
    `Turno ${turno}/${TURNOS}: ${lista.length} empresas, ${guardadas} vacantes guardadas, ${cerradas} cerradas` +
      (r.fallidas.length ? `, fallaron: ${r.fallidas.map((f) => `${f.slug} (${f.error})`).join("; ")}` : ""),
  );
};
