import type { Metadata } from "next";
import { proveedoresActivos } from "@/lib/pagos";
import { VistaCarrito } from "@/components/VistaCarrito";

export const metadata: Metadata = { title: "Carrito", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Carrito({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { pago } = await searchParams;
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-8 font-titulo text-4xl font-semibold">Tu carrito</h1>
      <VistaCarrito proveedores={proveedoresActivos()} pagoFallido={pago === "fallido"} />
    </div>
  );
}
