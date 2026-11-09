import Link from "next/link";
import { garantiaDias } from "@/lib/planes";

// Bloque de confianza: lo primero que se pregunta quien llega de un anuncio es
// "¿esto es una estafa?". Va arriba del listado y dentro del muro de pago.

export const TEXTO_CONFIANZA = "No cobramos por contratarte ni pedimos datos bancarios: aplicas gratis en la página oficial de la empresa. Pagas solo por la herramienta que las encuentra.";

export function textoGarantia(): string | null {
  const d = garantiaDias();
  return d ? `Si en ${d} días no te sirve, te devolvemos tu dinero.` : null;
}

function Escudo({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

/** `compacto`: una sola línea con el enlace a la guía (dentro del paywall). Si no, la tarjeta completa. */
export function Confianza({ compacto = false }: { compacto?: boolean }) {
  const garantia = textoGarantia();
  if (compacto) {
    return (
      <p className="flex gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs leading-snug text-emerald-900">
        <Escudo className="mt-0.5 size-4 shrink-0 text-emerald-700" />
        <span>
          {TEXTO_CONFIANZA}
          {garantia && <strong> {garantia}</strong>}{" "}
          <Link href="/guias/estafas-trabajo-desde-casa" className="font-semibold underline">
            Cómo detectar estafas
          </Link>
        </span>
      </p>
    );
  }
  return (
    <div className="flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950 sm:p-5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-emerald-700">
        <Escudo />
      </span>
      <div className="space-y-1.5">
        <p className="font-semibold leading-snug">{TEXTO_CONFIANZA}</p>
        {garantia && <p className="font-semibold">✓ {garantia}</p>}
        <p className="text-emerald-800">
          Ninguna empresa seria cobra por darte trabajo.{" "}
          <Link href="/guias/estafas-trabajo-desde-casa" className="font-semibold underline">
            Guía: cómo detectar estafas de trabajo desde casa
          </Link>
        </p>
      </div>
    </div>
  );
}
