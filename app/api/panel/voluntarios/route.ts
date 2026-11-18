import { NextResponse } from "next/server";
import { sesionPanelValida } from "@/lib/panel";
import { nuevoCodigoVoluntarios, quitarCodigoVoluntarios } from "@/lib/voluntarios";

export const runtime = "nodejs";

// POST /api/panel/voluntarios — crear/cambiar ("nuevo") o desactivar ("quitar") el código de voluntarios.
// Solo el equipo. Regresa al panel, a la sección de voluntarios.
export async function POST(req: Request) {
  const regresar = NextResponse.redirect(new URL("/panel#voluntarios", req.url), 303);
  if (!(await sesionPanelValida())) return NextResponse.redirect(new URL("/panel", req.url), 303);
  const accion = (await req.formData().catch(() => null))?.get("accion");
  if (accion === "nuevo") await nuevoCodigoVoluntarios();
  else if (accion === "quitar") await quitarCodigoVoluntarios();
  return regresar;
}
