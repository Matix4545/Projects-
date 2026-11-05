"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { TIENDA } from "@/lib/config";
import { SelectorPais } from "./SelectorPais";
import { useTienda } from "./Tienda";
import { Logo } from "./Logo";

const ENLACES = [
  { href: "/patrones", texto: "Patrones" },
  { href: "/patrones?precio=gratis", texto: "Gratis" },
  { href: "/aprende", texto: "Aprende" },
  { href: "/medidas", texto: "Tabla de medidas" },
  { href: "/como-imprimir", texto: "Cómo imprimir" },
  { href: "/preguntas", texto: "Ayuda" },
];

export function Encabezado() {
  const { carrito, listo } = useTienda();
  const [abierto, setAbierto] = useState(false);
  const ruta = usePathname();
  useEffect(() => setAbierto(false), [ruta]);

  return (
    <header className="sticky top-0 z-40 border-b border-borde bg-fondo/90 backdrop-blur">
      <div className="bg-tinta px-4 py-1.5 text-center text-xs text-white sm:text-sm">
        Descarga inmediata · PDF Carta, A4, plotter y DXF · Paga con tarjeta, OXXO o transferencia
      </div>
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <button
          className="-ml-1 rounded-md p-1.5 md:hidden"
          onClick={() => setAbierto((v) => !v)}
          aria-label={abierto ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={abierto}
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
            {abierto ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
        <Link href="/" className="flex items-center gap-2" aria-label={`${TIENDA.nombre}, inicio`}>
          <Logo className="h-8 w-8" />
          <span className="font-titulo text-2xl font-semibold tracking-tight">{TIENDA.nombre}</span>
        </Link>
        <nav className="ml-6 hidden gap-5 text-[15px] md:flex">
          {ENLACES.map((e) => (
            <Link key={e.href} href={e.href} className="text-suave hover:text-tinta">
              {e.texto}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <SelectorPais className="hidden text-suave lg:inline-flex" />
          <Link
            href="/carrito"
            className="relative flex items-center gap-1.5 rounded-full px-3 py-2 hover:bg-crema"
            aria-label={`Carrito, ${carrito.length} patrones`}
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8z" />
              <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
            </svg>
            {listo && carrito.length > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-acento px-1 text-xs font-bold text-white">
                {carrito.length}
              </span>
            ) : null}
          </Link>
        </div>
      </div>
      {abierto ? (
        <nav className="border-t border-borde px-4 pb-4 md:hidden">
          {ENLACES.map((e) => (
            <Link key={e.href} href={e.href} className="block border-b border-borde py-3 text-lg">
              {e.texto}
            </Link>
          ))}
          <SelectorPais className="mt-3 flex text-suave" />
        </nav>
      ) : null}
    </header>
  );
}
