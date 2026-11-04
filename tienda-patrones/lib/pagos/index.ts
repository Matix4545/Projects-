import "server-only";
import { crearReferencia, leerReferencia } from "../firma";
import type { Articulo, Linea } from "../precios";
import { secreto } from "../secreto";
import { urlSitio } from "../config";
import { consultarPago, crearPreferencia, mercadoPagoConfigurado } from "./mercadopago";
import { consultarSesion, crearSesion, stripeConfigurado } from "./stripe";
import type { Proveedor, ResultadoPago } from "./tipos";

export type { Proveedor, ResultadoPago };

/**
 * Modo demo: simula el pago para que puedas probar la tienda completa.
 * Solo existe si NO hay ningún proveedor real configurado, y en producción
 * únicamente si pones MODO_DEMO=1 a propósito.
 */
export function demoActivo(): boolean {
  if (mercadoPagoConfigurado() || stripeConfigurado()) return false;
  return process.env.NODE_ENV !== "production" || process.env.MODO_DEMO === "1";
}

export function proveedoresActivos(): Proveedor[] {
  const lista: Proveedor[] = [];
  if (mercadoPagoConfigurado()) lista.push("mp");
  if (stripeConfigurado()) lista.push("stripe");
  if (demoActivo()) lista.push("demo");
  return lista;
}

export async function iniciarPago(proveedor: Proveedor, articulos: Articulo[], lineas: Linea[]): Promise<string> {
  const ref = crearReferencia(secreto(), articulos);
  if (proveedor === "mp" && mercadoPagoConfigurado()) return crearPreferencia(lineas, ref);
  if (proveedor === "stripe" && stripeConfigurado()) return crearSesion(lineas, ref);
  if (proveedor === "demo" && demoActivo()) return `${urlSitio()}/gracias?proveedor=demo&ref=${encodeURIComponent(ref)}`;
  throw new Error("Forma de pago no disponible");
}

/** Consulta el pago con el proveedor y devuelve qué patrones ampara (si la referencia es nuestra). */
export async function verificarPago(params: Record<string, string | undefined>): Promise<{
  resultado: ResultadoPago;
  articulos: Articulo[] | null;
}> {
  let resultado: ResultadoPago = { estado: "invalido" };
  if (params.proveedor === "mp" && mercadoPagoConfigurado()) {
    const id = params.payment_id ?? params.collection_id;
    if (id) resultado = await consultarPago(id);
  } else if (params.proveedor === "stripe" && stripeConfigurado()) {
    if (params.session_id) resultado = await consultarSesion(params.session_id);
  } else if (params.proveedor === "demo" && demoActivo() && params.ref) {
    resultado = {
      estado: "aprobado",
      id: "demo",
      referencia: params.ref,
      correo: null,
      total: null,
      moneda: null,
      liga: `${urlSitio()}/gracias?proveedor=demo&ref=${encodeURIComponent(params.ref)}`,
    };
  }
  const articulos = resultado.estado === "invalido" ? null : leerReferencia(secreto(), resultado.referencia);
  return { resultado, articulos };
}
