import Link from "next/link";
import { TIENDA } from "@/lib/config";
import { Logo } from "./Logo";

export function Pie() {
  const anio = new Date().getFullYear();
  return (
    <footer className="mt-24 border-t border-borde bg-crema">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <Logo className="h-7 w-7" />
            <span className="font-titulo text-xl font-semibold">{TIENDA.nombre}</span>
          </div>
          <p className="mt-3 text-sm text-suave">{TIENDA.descripcion}</p>
        </div>
        <div>
          <h3 className="font-semibold">Tienda</h3>
          <ul className="mt-3 space-y-2 text-sm text-suave">
            <li><Link href="/patrones" className="hover:text-tinta">Todos los patrones</Link></li>
            <li><Link href="/patrones?precio=gratis" className="hover:text-tinta">Patrones gratis</Link></li>
            <li><Link href="/patrones?categoria=infantil" className="hover:text-tinta">Infantil</Link></li>
            <li><Link href="/carrito" className="hover:text-tinta">Carrito</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="font-semibold">Ayuda</h3>
          <ul className="mt-3 space-y-2 text-sm text-suave">
            <li><Link href="/medidas" className="hover:text-tinta">Tabla de medidas</Link></li>
            <li><Link href="/como-imprimir" className="hover:text-tinta">Cómo imprimir tu patrón</Link></li>
            <li><Link href="/preguntas" className="hover:text-tinta">Preguntas frecuentes</Link></li>
            <li><Link href="/licencia" className="hover:text-tinta">Licencias y términos</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="font-semibold">Contacto</h3>
          <ul className="mt-3 space-y-2 text-sm text-suave">
            <li><a href={`mailto:${TIENDA.correo}`} className="hover:text-tinta">{TIENDA.correo}</a></li>
            {TIENDA.whatsapp ? (
              <li><a href={`https://wa.me/${TIENDA.whatsapp}`} className="hover:text-tinta" rel="noopener">WhatsApp</a></li>
            ) : null}
            {TIENDA.instagram ? (
              <li><a href={`https://instagram.com/${TIENDA.instagram}`} className="hover:text-tinta" rel="noopener">Instagram</a></li>
            ) : null}
          </ul>
        </div>
      </div>
      <div className="border-t border-borde px-4 py-5 text-center text-xs text-suave">
        © {anio} {TIENDA.nombre}. Patrones de uso según su <Link href="/licencia" className="underline">licencia</Link>. Prohibida su reventa o redistribución.
      </div>
    </footer>
  );
}
