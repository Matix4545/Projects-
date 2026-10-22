import { NextResponse } from "next/server";
import { COOKIE_AVISO_EQUIPO, COOKIE_PANEL } from "@/lib/panel";

export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL("/panel", req.url), 303);
  res.cookies.delete(COOKIE_PANEL);
  res.cookies.delete(COOKIE_AVISO_EQUIPO);
  return res;
}
