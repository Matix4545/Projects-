"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

// Medición: píxel de Meta (Facebook/Instagram) y Microsoft Clarity (grabaciones
// y mapas de calor). Solo se activan si existen NEXT_PUBLIC_META_PIXEL_ID /
// NEXT_PUBLIC_CLARITY_ID y la persona acepta las cookies en el aviso. Si rechaza,
// no se carga nada de Meta ni de Microsoft.
//
// Eventos que se mandan a Meta:
//   PageView          · cada página
//   ViewContent       · listado de vacantes y landing /remoto-dolares
//   ClickLocked       · (personalizado) tocó "Aplicar" en una vacante bloqueada
//   InitiateCheckout  · clic en "Pagar" / "Desbloquear" (botones con data-meta)
//   Lead              · dejó su correo (components/CapturaCorreo.tsx)
//   Purchase          · solo cuando Stripe confirmó el pago (app/cuenta lee la base y
//                       pone data-compra); mismo event_id que el servidor (lib/meta.ts)

const PIXEL = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "";
const CLARITY = process.env.NEXT_PUBLIC_CLARITY_ID ?? "";
const LLAVE = "cr_cookies"; // "si" | "no"

type Fbq = ((...args: unknown[]) => void) & { callMethod?: unknown; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown };
type Clarity = ((...args: unknown[]) => void) & { q?: unknown[] };
declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
    clarity?: Clarity;
  }
}

function leerLocal(llave: string): string | null {
  try {
    return localStorage.getItem(llave);
  } catch {
    return null;
  }
}
function guardarLocal(llave: string, valor: string) {
  try {
    localStorage.setItem(llave, valor);
  } catch {
    /* sin almacenamiento */
  }
}

function cargarPixel() {
  if (!PIXEL || window.fbq) return;
  const fbq: Fbq = function (...args: unknown[]) {
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

function cargarClarity() {
  if (!CLARITY || window.clarity) return;
  const c: Clarity = function (...args: unknown[]) {
    (c.q = c.q || []).push(args);
  } as Clarity;
  window.clarity = c;
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.clarity.ms/tag/${encodeURIComponent(CLARITY)}`;
  document.head.appendChild(s);
  c("consent");
}

/** Manda un evento estándar a Meta solo si el píxel está activo (aceptó cookies). */
export function eventoMeta(nombre: string, datos?: Record<string, unknown>, opciones?: { eventID?: string }) {
  if (typeof window === "undefined" || !window.fbq) return;
  if (opciones) window.fbq("track", nombre, datos ?? {}, opciones);
  else window.fbq("track", nombre, datos);
}

/** Evento personalizado (no estándar), p. ej. ClickLocked. */
export function eventoMetaPersonalizado(nombre: string, datos?: Record<string, unknown>) {
  if (typeof window !== "undefined" && window.fbq) window.fbq("trackCustom", nombre, datos);
}

/** Etiqueta en Clarity (para filtrar grabaciones: "clic_bloqueado", "fue_a_pagar"…). */
function etiquetaClarity(nombre: string, valor: string) {
  try {
    window.clarity?.("set", nombre, valor);
  } catch {
    /* nada */
  }
}

export function MetaPixel() {
  const ruta = usePathname();
  const params = useSearchParams();
  const [decision, setDecision] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (PIXEL || CLARITY) setDecision(leerLocal(LLAVE));
  }, []);

  // Página vista, listados y compra confirmada
  useEffect(() => {
    if (decision !== "si") return;
    cargarPixel();
    cargarClarity();
    window.fbq?.("track", "PageView");
    if (ruta === "/vacantes") window.fbq?.("track", "ViewContent", { content_type: "vacantes", content_name: params.get("donde") || params.get("categoria") || "todas" });
    if (ruta === "/remoto-dolares") window.fbq?.("track", "ViewContent", { content_type: "vacantes", content_name: "remoto-dolares" });
    if (ruta === "/cuenta") {
      // La página solo pone data-compra cuando la base ya tiene el pago que confirmó Stripe
      const el = document.querySelector<HTMLElement>("[data-compra]");
      const sesion = el?.dataset.compra;
      if (el && sesion && leerLocal(`cr_compra_${sesion}`) !== "1") {
        guardarLocal(`cr_compra_${sesion}`, "1"); // no contar dos veces si recarga
        eventoMeta("Purchase", { currency: el.dataset.moneda || "MXN", value: Number(el.dataset.valor || 0), content_name: el.dataset.plan || "" }, { eventID: sesion });
        etiquetaClarity("compra", el.dataset.plan || "si");
      }
    }
  }, [decision, ruta, params]);

  // Clics: "Aplicar" con candado = ClickLocked; botones con data-meta = el evento que digan
  useEffect(() => {
    if (decision !== "si") return;
    const alClic = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-evento='aplicar_bloqueada'], [data-meta]");
      if (!el) return;
      if (el.dataset.evento === "aplicar_bloqueada") {
        eventoMetaPersonalizado("ClickLocked", { content_type: "vacante", content_ids: el.dataset.vacante ? [el.dataset.vacante] : undefined, ruta: location.pathname });
        etiquetaClarity("clic_bloqueado", "si");
      } else if (el.dataset.meta) {
        eventoMeta(el.dataset.meta, el.dataset.metaValor ? { currency: "MXN", value: Number(el.dataset.metaValor) } : undefined);
        if (el.dataset.meta === "InitiateCheckout") etiquetaClarity("fue_a_pagar", el.dataset.metaValor || "si");
      }
    };
    document.addEventListener("click", alClic, true);
    return () => document.removeEventListener("click", alClic, true);
  }, [decision]);

  if ((!PIXEL && !CLARITY) || decision === undefined || decision) return null;

  const decidir = (valor: "si" | "no") => {
    guardarLocal(LLAVE, valor);
    setDecision(valor);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4" role="dialog" aria-label="Aviso de cookies">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-borde bg-white p-4 shadow-2xl sm:flex-row sm:items-center">
        <p className="flex-1 text-sm text-slate-600">
          Usamos cookies de Meta (Facebook/Instagram) para medir nuestros anuncios{CLARITY ? " y de Microsoft Clarity para ver qué partes del sitio se usan" : ""}. Son opcionales.{" "}
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
