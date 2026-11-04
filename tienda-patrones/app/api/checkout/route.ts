import { NextResponse } from "next/server";
import { z } from "zod";
import { TIENDA } from "@/lib/config";
import { iniciarPago, proveedoresActivos } from "@/lib/pagos";
import { lineas, total, type Articulo } from "@/lib/precios";

const Entrada = z.object({
  proveedor: z.enum(["mp", "stripe", "demo"]),
  articulos: z
    .array(z.object({ slug: z.string().regex(/^[a-z0-9-]{1,60}$/), licencia: z.enum(["personal", "emprendedora"]) }))
    .min(1)
    .max(TIENDA.maxArticulos),
});

export async function POST(req: Request) {
  const datos = Entrada.safeParse(await req.json().catch(() => null));
  if (!datos.success) return NextResponse.json({ error: "Carrito inválido" }, { status: 400 });

  const { proveedor } = datos.data;
  if (!proveedoresActivos().includes(proveedor)) {
    return NextResponse.json({ error: "Esa forma de pago no está disponible" }, { status: 400 });
  }

  // Precios recalculados en el servidor: se ignora cualquier precio del navegador.
  const ls = lineas(datos.data.articulos as Articulo[]).filter((l) => l.precio > 0);
  if (!ls.length || total(ls) <= 0) return NextResponse.json({ error: "No hay nada que cobrar" }, { status: 400 });
  const articulos = ls.map((l) => ({ slug: l.patron.slug, licencia: l.licencia }));

  try {
    const url = await iniciarPago(proveedor, articulos, ls);
    return NextResponse.json({ url });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "No pudimos iniciar el pago. Intenta de nuevo en un momento." }, { status: 502 });
  }
}
