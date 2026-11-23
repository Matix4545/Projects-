import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { esBot } from "@/lib/estadisticas";
import { leerGeo } from "@/lib/geo";

/** Guarda un correo para "5 vacantes remotas en dólares cada semana" (components/CapturaCorreo.tsx). */
export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Solo desde el propio sitio y desde navegadores de verdad
  const host = request.headers.get("host") ?? "";
  const origen = request.headers.get("origin");
  if (origen && new URL(origen).host !== host) return NextResponse.json({ error: "origen" }, { status: 403 });
  if (esBot(request.headers.get("user-agent") ?? "")) return NextResponse.json({ error: "bot" }, { status: 403 });

  let d: { correo?: unknown; origen?: unknown };
  try {
    d = await request.json();
  } catch {
    return NextResponse.json({ error: "cuerpo" }, { status: 400 });
  }
  const correo = String(d.correo ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo) || correo.length > 120) return NextResponse.json({ error: "correo" }, { status: 400 });
  const deDonde = String(d.origen ?? "").slice(0, 80);
  const pais = leerGeo(request.headers.get("x-nf-geo"))?.country?.code ?? "";

  // Sin base (modo local): se acepta sin guardar, para poder probar la página
  if (!url || !anon) return NextResponse.json({ ok: true, estado: "local" });
  const sb = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await sb.rpc("suscribir_correo", { p_correo: correo, p_origen: deDonde, p_pais: pais });
  if (error) return NextResponse.json({ error: "guardar" }, { status: 500 });
  return NextResponse.json({ ok: true, estado: data });
}
