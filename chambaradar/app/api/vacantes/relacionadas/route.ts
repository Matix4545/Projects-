import { NextResponse, type NextRequest } from "next/server";
import { accesoLocal, usuarioActual } from "@/lib/supabase/servidor";
import { otrasDeEmpresa } from "@/lib/vacantes";

/** GET /api/vacantes/relacionadas?id=… → otras vacantes de la misma empresa (con el muro de pago aplicado). */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!id || id.length > 200) return NextResponse.json({ total: 0, vacantes: [] }, { status: 400 });
  try {
    const r = await otrasDeEmpresa(id, accesoLocal(await usuarioActual()));
    return NextResponse.json(r, { headers: { "cache-control": "private, no-store" } });
  } catch {
    return NextResponse.json({ total: 0, vacantes: [] }, { status: 500 });
  }
}
