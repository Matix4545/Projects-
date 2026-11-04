"use client";
import { TIENDA } from "@/lib/config";
import { convertir, formatear, formatearCobro, paisPorCodigo } from "@/lib/dinero";
import { useTienda } from "./Tienda";

/** Precio en la moneda de cobro y, debajo, el aproximado en la moneda del país elegido. */
export function Precio({
  cantidad,
  antes,
  grande = false,
  className = "",
}: {
  cantidad: number;
  antes?: number;
  grande?: boolean;
  className?: string;
}) {
  const { paisCodigo, tasas, listo } = useTienda();
  const pais = paisPorCodigo(paisCodigo);
  const local = pais.moneda !== TIENDA.monedaCobro && cantidad > 0 && listo ? convertir(cantidad, pais, tasas) : NaN;

  if (cantidad === 0) {
    return <span className={`inline-block font-bold text-salvia ${grande ? "text-3xl" : "text-lg"} ${className}`}>Gratis</span>;
  }
  return (
    <span className={`inline-flex flex-col ${className}`}>
      <span className="flex items-baseline gap-2">
        <span className={`font-bold ${grande ? "text-3xl" : "text-lg"}`}>{formatearCobro(cantidad)}</span>
        {antes && antes > cantidad ? (
          <span className="text-sm text-suave line-through">{formatearCobro(antes)}</span>
        ) : null}
      </span>
      {Number.isFinite(local) ? (
        <span className="text-xs text-suave">
          ≈ {formatear(local, pais.moneda, pais.decimales, "es-" + pais.codigo)} en {pais.nombre}
        </span>
      ) : null}
    </span>
  );
}
