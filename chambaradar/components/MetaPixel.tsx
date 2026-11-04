"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

// Píxel de Meta (Facebook/Instagram) para medir y optimizar anuncios.
// Solo se activa si existe NEXT_PUBLIC_META_PIXEL_ID y la persona acepta las
// cookies de publicidad en el aviso. Si rechaza, no se carga nada de Meta.

const PIXEL = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "";
const LLAVE = "cr_cookies"; // "si" | "no"

type Fbq = ((...args: unknown[]) => void) & { callMethod?: unknown; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown };
declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

const LLAVE_PAGO = "cr_pago_valor";

/** sessionStorage con try/catch (modo privado, almacenamiento bloqueado). `undefined` = no hay nada guardado. */
function leerSesion(llave: string): string | undefined {
  try {
    return sessionStorage.getItem(llave) ?? undefined;
  } catch {
    return undefined;
  }
}
function guardarSesion(llave: string, valor: string) {
  try {
    sessionStorage.setItem(llave, valor);
  } catch {
    /* sin almacenamiento: la compra se cuenta sin monto */
  }
}
function borrarSesion(llave: string) {
  try {
    sessionStorage.removeItem(llave);
  } catch {
    /* nada */
  }
}

function leerDecision(): string | null {
  try {
    return localStorage.getItem(LLAVE);
  } catch {
    return null;
  }
}

function cargarPixel() {
  if (window.fbq) return;
  const fbq: Fbq = function (...args: unknown[]) {
    // eslint-disable-next-line prefer-rest-params
    if (fbq.callMethod) (fbq.callMethod as (...a: unknown[]) => void)(...args);
    else fbq.queue!.push(args);
  } as Fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  window.fbq = fbq;
  window._fbq = fbq;
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(s);
  fbq("init", PIXEL);
}

/** Manda un evento a Meta solo si el píxel está activo (aceptó cookies). */
export function eventoMeta(nombre: string, datos?: Record<string, unknown>) {
  if (typeof window !== "undefined" && window.fbq) window.fbq("track", nombre, datos);
}

export function MetaPixel() {
  const ruta = usePathname();
  const params = useSearchParams();
  const [decision, setDecision] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (PIXEL) setDecision(leerDecision());
  }, []);

  // Página vista (y compra al regresar de Stripe)
  useEffect(() => {
    if (decision !== "si") return;
    cargarPixel();
    window.fbq?.("track", "PageView");
    // Listado de vacantes: ViewContent (con la búsqueda, sin datos personales)
    if (ruta === "/vacantes") window.fbq?.("track", "ViewContent", { content_type: "vacantes", content_name: params.get("donde") || params.get("categoria") || "todas" });
    if (ruta === "/cuenta" && params.get("pago") === "ok") {
      // El monto lo guardó el clic en "Pagar" (no se toca Stripe). Se borra para no contar la compra dos veces.
      const valor = leerSesion(LLAVE_PAGO);
      borrarSesion(LLAVE_PAGO);
      if (valor !== undefined) window.fbq?.("track", "Purchase", valor ? { currency: "MXN", value: Number(valor) } : { currency: "MXN" });
    }
  }, [decision, ruta, params]);

  // Clics: "Aplicar" con candado = Lead; botones con data-meta = el evento que digan
  useEffect(() => {
    if (decision !== "si") return;
    const alClic = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-evento='aplicar_bloqueada'], [data-meta]");
      if (!el) return;
      if (el.dataset.evento === "aplicar_bloqueada") eventoMeta("Lead");
      else if (el.dataset.meta) {
        eventoMeta(el.dataset.meta, el.dataset.metaValor ? { currency: "MXN", value: Number(el.dataset.metaValor) } : undefined);
        if (el.dataset.meta === "InitiateCheckout") guardarSesion(LLAVE_PAGO, el.dataset.metaValor ?? "");
      }
    };
    document.addEventListener("click", alClic, true);
    return () => document.removeEventListener("click", alClic, true);
  }, [decision]);

  if (!PIXEL || decision === undefined || decision) return null;

  const decidir = (valor: "si" | "no") => {
    try {
      localStorage.setItem(LLAVE, valor);
    } catch {
      /* sin almacenamiento: se vuelve a preguntar la próxima vez */
    }
    setDecision(valor);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4" role="dialog" aria-label="Aviso de cookies">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-borde bg-white p-4 shadow-2xl sm:flex-row sm:items-center">
        <p className="flex-1 text-sm text-slate-600">
          Usamos cookies de Meta (Facebook/Instagram) para medir nuestros anuncios. Son opcionales.{" "}
          <Link href="/privacidad" className="font-semibold text-radar-oscuro hover:underline">
            Aviso de privacidad
          </Link>
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => decidir("no")} className="boton-secundario flex-1 px-4 py-2 text-sm">
            Rechazar
          </button>
          <button type="button" onClick={() => decidir("si")} className="boton flex-1 px-4 py-2 text-sm">
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
