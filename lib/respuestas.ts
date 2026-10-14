import { NextResponse } from "next/server";

export function error(mensaje: string, estado = 400) {
  return NextResponse.json({ ok: false, error: mensaje }, { status: estado });
}

export function ok(datos: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: true, ...datos });
}
