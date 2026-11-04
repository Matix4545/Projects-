"use client";
import Link from "next/link";
import { useState } from "react";
import { LICENCIAS, TIENDA } from "@/lib/config";
import { lineas as calcularLineas, total as calcularTotal } from "@/lib/precios";
import type { Proveedor } from "@/lib/pagos/tipos";
import { DibujoPlano } from "./DibujoPlano";
import { Precio } from "./Precio";
import { useTienda } from "./Tienda";

const BOTONES: Record<Proveedor, { texto: string; detalle: string }> = {
  mp: { texto: "Pagar con Mercado Pago", detalle: "Tarjeta de crédito o débito, OXXO, SPEI, saldo y meses" },
  stripe: { texto: "Pagar con tarjeta", detalle: "Visa, Mastercard o Amex de cualquier país" },
  demo: { texto: "Simular pago (modo demo)", detalle: "Solo para probar: aún no configuras Mercado Pago ni Stripe" },
};

export function VistaCarrito({ proveedores, pagoFallido }: { proveedores: Proveedor[]; pagoFallido: boolean }) {
  const { carrito, quitar, listo } = useTienda();
  const [enviando, setEnviando] = useState<Proveedor | null>(null);
  const [error, setError] = useState(pagoFallido ? "El pago no se completó. Puedes intentarlo de nuevo con otra forma de pago." : "");

  const lineas = calcularLineas(carrito).filter((l) => l.precio > 0);
  const total = calcularTotal(lineas);

  async function pagar(proveedor: Proveedor) {
    setEnviando(proveedor);
    setError("");
    try {
      const r = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proveedor, articulos: lineas.map((l) => ({ slug: l.patron.slug, licencia: l.licencia })) }),
      });
      const datos = (await r.json()) as { url?: string; error?: string };
      if (!r.ok || !datos.url) throw new Error(datos.error ?? "No pudimos iniciar el pago");
      window.location.href = datos.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos iniciar el pago");
      setEnviando(null);
    }
  }

  if (!listo) return <div className="h-64" aria-busy />;

  if (!lineas.length) {
    return (
      <div className="rounded-3xl border border-borde bg-tarjeta px-6 py-16 text-center">
        <p className="font-titulo text-2xl">Tu carrito está vacío</p>
        <p className="mt-2 text-suave">Encuentra tu próximo proyecto en el catálogo.</p>
        <Link href="/patrones" className="boton boton-principal mt-6">Ver patrones</Link>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <ul className="divide-y divide-borde rounded-3xl border border-borde bg-tarjeta">
        {lineas.map((l) => (
          <li key={`${l.patron.slug}-${l.licencia}`} className="flex gap-4 p-4">
            <Link href={`/patrones/${l.patron.slug}`} className="w-20 shrink-0 rounded-xl p-1" style={{ backgroundColor: l.patron.color }}>
              <DibujoPlano dibujo={l.patron.dibujo} className="w-full" titulo={l.patron.tipo} />
            </Link>
            <div className="min-w-0 flex-1">
              <Link href={`/patrones/${l.patron.slug}`} className="font-titulo text-xl font-semibold hover:underline">
                {l.patron.nombre}
              </Link>
              <p className="text-sm text-suave">{l.patron.tipo}</p>
              <p className="mt-1 text-sm">
                Licencia <strong>{LICENCIAS[l.licencia].nombre.toLowerCase()}</strong>
              </p>
              <button onClick={() => quitar(l.patron.slug, l.licencia)} className="mt-2 text-sm text-suave underline hover:text-acento-oscuro">
                Quitar
              </button>
            </div>
            <Precio cantidad={l.precio} className="text-right" />
          </li>
        ))}
      </ul>

      <aside className="h-fit space-y-4 rounded-3xl border border-borde bg-tarjeta p-6 lg:sticky lg:top-28">
        <div className="flex items-start justify-between">
          <span className="text-lg font-semibold">Total</span>
          <Precio cantidad={total} grande className="text-right" />
        </div>
        <p className="text-xs text-suave">
          Se cobra en {TIENDA.monedaCobro}. Si pagas desde otro país, tu banco hace la conversión. Recibirás tus archivos al instante.
        </p>
        {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p> : null}
        {proveedores.length ? (
          <div className="space-y-3">
            {proveedores.map((p, i) => (
              <button
                key={p}
                onClick={() => pagar(p)}
                disabled={enviando !== null}
                className={`boton w-full flex-col !gap-0.5 ${i === 0 ? "boton-principal" : "boton-secundario"}`}
              >
                <span>{enviando === p ? "Abriendo pago…" : BOTONES[p].texto}</span>
                <span className="text-xs font-normal opacity-80">{BOTONES[p].detalle}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-xl bg-crema p-4 text-sm">
            <p className="font-semibold">Los pagos en línea aún no están activos.</p>
            {TIENDA.whatsapp ? (
              <a href={`https://wa.me/${TIENDA.whatsapp}`} className="boton boton-principal mt-3 w-full">Comprar por WhatsApp</a>
            ) : (
              <p className="mt-1">Escríbenos a {TIENDA.correo} para comprar.</p>
            )}
          </div>
        )}
        <p className="text-center text-xs text-suave">Al comprar aceptas los <Link href="/licencia" className="underline">términos de uso</Link>.</p>
      </aside>
    </div>
  );
}
