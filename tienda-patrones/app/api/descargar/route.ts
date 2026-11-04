import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { FORMATOS, TIENDA, type Formato } from "@/lib/config";
import { buscarPatron } from "@/lib/catalogo";
import { leerTokenDescarga } from "@/lib/firma";
import { secreto } from "@/lib/secreto";
import { ligaFirmada, supabaseConfigurado } from "@/lib/supabase";

// Descarga de archivos de patrones.
//  - Comprados:  /api/descargar?t=<token firmado>   (el token lo genera /gracias)
//  - Gratis:     /api/descargar?gratis=<slug>&f=<formato>
// Los archivos viven en un bucket PRIVADO de Supabase: patrones/<slug>/<formato>.<ext>
// En tu computadora (sin Supabase) se leen de la carpeta archivos-privados/.

export const dynamic = "force-dynamic";

function aviso(mensaje: string, estado = 404) {
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Descarga · ${TIENDA.nombre}</title>
  <body style="font-family:system-ui,sans-serif;background:#fbf7f2;color:#2b2420;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px">
  <div style="max-width:420px;text-align:center"><h1 style="font-size:22px">${mensaje}</h1>
  <p>Escríbenos a <a href="mailto:${TIENDA.correo}">${TIENDA.correo}</a> y te lo mandamos.</p>
  <p><a href="/">← Ir a la tienda</a></p></div></body>`;
  return new NextResponse(html, { status: estado, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  let slug: string | undefined;
  let formato: string | undefined;

  if (q.get("t")) {
    const d = leerTokenDescarga(secreto(), q.get("t"));
    if (!d) return aviso("Esta liga de descarga ya venció", 403);
    slug = d.slug;
    formato = d.formato;
  } else if (q.get("gratis")) {
    const p = buscarPatron(q.get("gratis")!);
    if (!p || p.precio !== 0) return aviso("Este patrón no es gratuito", 403);
    slug = p.slug;
    formato = q.get("f") ?? "";
  }

  const patron = slug ? buscarPatron(slug) : undefined;
  if (!patron || !formato || !(formato in FORMATOS) || !patron.formatos.includes(formato as Formato)) {
    return aviso("No encontramos ese archivo");
  }

  const { ext } = FORMATOS[formato as Formato];
  const ruta = `${patron.slug}/${formato}.${ext}`;
  const nombre = `${TIENDA.nombre}-${patron.nombre}-${formato}.${ext}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-");

  if (supabaseConfigurado()) {
    const liga = await ligaFirmada(ruta, nombre);
    return liga ? NextResponse.redirect(liga, 302) : aviso("Este archivo todavía no está disponible");
  }

  // Sin Supabase: archivos locales (útil para probar en tu computadora)
  try {
    const archivo = await readFile(path.join(process.cwd(), "archivos-privados", ruta));
    return new NextResponse(new Uint8Array(archivo), {
      headers: {
        "Content-Type": ext === "pdf" ? "application/pdf" : "application/octet-stream",
        "Content-Disposition": `attachment; filename="${nombre}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return aviso("Este archivo todavía no está disponible");
  }
}
