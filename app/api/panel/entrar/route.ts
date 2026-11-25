import { entrar } from "@/lib/entrar";

export const runtime = "nodejs";

// POST /api/panel/entrar — desde el formulario de /panel (ver lib/entrar.ts)
export async function POST(req: Request) {
  return entrar(req, "/panel");
}
