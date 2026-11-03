import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { leerGeo } from "@/lib/geo";
import { dispositivoDe, esBot, limpiarRuta, origenDe, rutaContable, visitanteDelDia, zonaDeGeo, type TipoEvento } from "@/lib/estadisticas";

const TIPOS: TipoEvento[] = ["vista", "aplicar", "aplicar_bloqueada"];
const nada = () => new NextResponse(null, { status: 204 });

/** Recibe una visita o un clic en "Aplicar" desde el navegador (components/Contador.tsx). */
export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const clave = process.env.CHAMBARADAR_CLAVE;
  if (!url || !anon || !clave) return nada();

  // Solo desde el propio sitio y desde navegadores de verdad
  const host = request.headers.get("host") ?? "";
  const origen = request.headers.get("origin");
  if (origen && new URL(origen).host !== host) return nada();
  const ua = request.headers.get("user-agent") ?? "";
  if (esBot(ua)) return nada();

  let d: { tipo?: string; ruta?: string; ref?: string; vacante?: string; empresa?: string };
  try {
    const texto = await request.text();
    if (texto.length > 2000) return nada();
    d = JSON.parse(texto);
  } catch {
    return nada();
  }
  const tipo = TIPOS.find((t) => t === d.tipo);
  if (!tipo || typeof d.ruta !== "string" || !rutaContable(d.ruta)) return nada();

  const { ruta, busqueda } = limpiarRuta(d.ruta);
  const ip = request.headers.get("x-nf-client-connection-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const fecha = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Hermosillo" }).format(new Date());

  const sb = createClient(url, anon, { auth: { persistSession: false } });
  await sb.rpc("registrar_evento", {
    p_clave: clave,
    p_datos: {
      tipo,
      ruta,
      busqueda: tipo === "vista" ? busqueda : null,
      zona: zonaDeGeo(leerGeo(request.headers.get("x-nf-geo"))),
      dispositivo: dispositivoDe(ua),
      origen: origenDe(typeof d.ref === "string" ? d.ref : "", host),
      visitante: await visitanteDelDia(ip, ua, fecha, clave),
      vacante: typeof d.vacante === "string" ? d.vacante.slice(0, 120) : null,
      empresa: tipo === "aplicar" && typeof d.empresa === "string" ? d.empresa.slice(0, 120) : null,
    },
  });
  return nada();
}
