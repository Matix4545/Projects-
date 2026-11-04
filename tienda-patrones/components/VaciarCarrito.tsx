"use client";
import { useEffect } from "react";
import { useTienda } from "./Tienda";

/** Vacía el carrito una vez que el pago fue aprobado. */
export function VaciarCarrito() {
  const { vaciar, listo } = useTienda();
  useEffect(() => {
    if (listo) vaciar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo]);
  return null;
}
