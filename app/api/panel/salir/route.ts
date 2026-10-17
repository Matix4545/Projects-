import { NextResponse } from "next/server";
import { COOKIE_PANEL } from "@/lib/panel";

export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL("/panel", req.url), 303);
  res.cookies.delete(COOKIE_PANEL);
  return res;
}
