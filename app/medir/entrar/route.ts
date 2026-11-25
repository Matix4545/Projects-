import { entrar } from "@/lib/entrar";

export const runtime = "nodejs";

// POST /medir/entrar — desde /medir. Vive bajo /medir para quedar dentro de la app instalada
// "Medir baches" (su alcance es /medir): así en iPhone no se abre afuera y la sesión queda en la app.
export async function POST(req: Request) {
  return entrar(req, "/medir");
}
