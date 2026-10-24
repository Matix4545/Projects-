import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Página estilo iOS: barra superior translúcida con "‹ Mapa", título grande y fondo gris agrupado.
 * El contenido va en bloques blancos (<Bloque>).
 */
export function Pagina({
  titulo,
  subtitulo,
  volver = { href: "/", texto: "Mapa" },
  accion,
  ancho = "max-w-2xl",
  children,
}: {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  volver?: { href: string; texto: string };
  /** Botón o enlace a la derecha de la barra */
  accion?: ReactNode;
  ancho?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-ios-fondo pb-16 print:bg-white">
      <nav className="material sticky top-0 z-10 print:hidden !shadow-[0_0.5px_0_rgba(0,0,0,0.15)] pt-[env(safe-area-inset-top)]">
        <div className={`mx-auto flex h-11 items-center justify-between px-2 ${ancho}`}>
          <Link href={volver.href} className="flex items-center gap-1 px-2 text-[17px] text-ios-azul">
            <svg width="12" height="20" viewBox="0 0 12 20" aria-hidden>
              <path d="M10 2L2 10l8 8" stroke="currentColor" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {volver.texto}
          </Link>
          <div className="px-2">{accion}</div>
        </div>
      </nav>
      <main className={`mx-auto px-4 ${ancho}`}>
        <header className="px-1 pb-4 pt-3">
          <h1 className="text-[34px] font-bold leading-tight tracking-tight">{titulo}</h1>
          {subtitulo && <p className="mt-1 text-[15px] text-ios-secundario">{subtitulo}</p>}
        </header>
        <div className="space-y-6">{children}</div>
      </main>
    </div>
  );
}

/** Bloque blanco con título de grupo arriba y nota abajo (como en Ajustes) */
export function Bloque({
  titulo,
  nota,
  id,
  sinRelleno = false,
  children,
}: {
  titulo?: ReactNode;
  nota?: ReactNode;
  id?: string;
  /** Sin margen interno: para listas que ya traen el suyo */
  sinRelleno?: boolean;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-16">
      {titulo && <h2 className="titulo-grupo">{titulo}</h2>}
      <div className={`overflow-hidden rounded-2xl bg-white ${sinRelleno ? "" : "px-4 py-3.5"}`}>{children}</div>
      {nota && <div className="nota-grupo">{nota}</div>}
    </section>
  );
}
