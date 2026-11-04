"use client";
import Link from "next/link";
import { useState } from "react";
import { FORMATOS, LICENCIAS, TIENDA, type Formato, type Licencia } from "@/lib/config";
import { formatearCobro } from "@/lib/dinero";
import { Precio } from "./Precio";
import { useTienda } from "./Tienda";

export function ComprarPatron({
  slug,
  precio,
  precioAntes,
  formatos,
}: {
  slug: string;
  precio: number;
  precioAntes?: number;
  formatos: Formato[];
}) {
  const { carrito, agregar, listo } = useTienda();
  const enCarrito = carrito.find((a) => a.slug === slug);
  const gratis = precio === 0;
  const [licencia, setLicencia] = useState<Licencia>(enCarrito?.licencia ?? "personal");
  const [agregado, setAgregado] = useState(false);
  const lleno = !enCarrito && carrito.length >= TIENDA.maxArticulos;

  const total = precio + LICENCIAS[licencia].extra;

  if (gratis) {
    return (
      <div className="space-y-6">
        <Precio cantidad={0} grande />
        <div className="rounded-2xl border border-borde bg-tarjeta p-5">
          <h2 className="font-semibold">Descarga gratis</h2>
          <p className="mt-1 text-sm text-suave">Sin registro. Para uso personal.</p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {formatos.map((f) => (
              <li key={f}>
                <a
                  href={`/api/descargar?gratis=${slug}&f=${f}`}
                  className="flex items-center gap-2 rounded-xl border border-borde px-3 py-2.5 text-sm font-medium hover:border-tinta"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-acento" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" />
                  </svg>
                  {FORMATOS[f].nombre}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl bg-crema p-5 text-sm">
          <p>
            <strong>¿Vas a vender lo que coses?</strong> Agrega la licencia emprendedora por{" "}
            {formatearCobro(LICENCIAS.emprendedora.extra)}.
          </p>
          <button
            className="boton boton-secundario mt-3"
            disabled={!listo || lleno}
            onClick={() => {
              agregar(slug, "emprendedora");
              setAgregado(true);
            }}
          >
            {agregado || enCarrito ? "En el carrito ✓" : "Agregar licencia al carrito"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Precio cantidad={total} antes={licencia === "personal" ? precioAntes : undefined} grande />
      <fieldset>
        <legend className="mb-2 font-semibold">Licencia</legend>
        <div className="grid gap-2">
          {(Object.keys(LICENCIAS) as Licencia[]).map((l) => (
            <label
              key={l}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 ${licencia === l ? "border-tinta bg-tarjeta" : "border-borde"}`}
            >
              <input
                type="radio"
                name="licencia"
                className="mt-1 accent-[var(--color-acento)]"
                checked={licencia === l}
                onChange={() => setLicencia(l)}
              />
              <span className="flex-1">
                <span className="flex items-center justify-between gap-2 font-semibold">
                  {LICENCIAS[l].nombre}
                  <span className="text-sm font-medium text-suave">
                    {LICENCIAS[l].extra ? `+ ${formatearCobro(LICENCIAS[l].extra)}` : "Incluida"}
                  </span>
                </span>
                <span className="block text-sm text-suave">{LICENCIAS[l].resumen}</span>
              </span>
            </label>
          ))}
        </div>
        <Link href="/licencia" className="mt-2 inline-block text-xs text-suave underline">
          ¿Qué permite cada licencia?
        </Link>
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <button
          className="boton boton-principal flex-1"
          disabled={!listo || lleno}
          onClick={() => {
            agregar(slug, licencia);
            setAgregado(true);
          }}
        >
          {enCarrito && enCarrito.licencia === licencia ? "En el carrito ✓" : enCarrito ? "Cambiar licencia" : "Agregar al carrito"}
        </button>
        {agregado || enCarrito ? (
          <Link href="/carrito" className="boton boton-secundario flex-1">
            Ir a pagar
          </Link>
        ) : null}
      </div>
      {lleno ? <p className="text-sm text-acento-oscuro">Máximo {TIENDA.maxArticulos} patrones por compra.</p> : null}
      <p className="flex items-center gap-2 text-sm text-suave">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-salvia" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
        Pago seguro · Descarga inmediata · Sin envío
      </p>
    </div>
  );
}
