import Link from "next/link";
import { CORREO_CONTACTO, FACEBOOK } from "@/lib/legal";
import type { Usuario } from "@/lib/supabase/servidor";

export function IconoFacebook({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.32l-.53 3.5h-2.8V24C19.62 23.1 24 18.1 24 12.07" />
    </svg>
  );
}

export function Logo({ claro = false }: { claro?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight" aria-label="ChambaRadar, inicio">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icono.svg" alt="" width={32} height={32} className="rounded-lg" />
      <span className={`text-lg ${claro ? "text-white" : "text-tinta"}`}>
        Chamba<span className="text-radar">Radar</span>
      </span>
    </Link>
  );
}

/**
 * Encabezado. Con `buscador`, el buscador ocupa el centro (escritorio) o una
 * segunda fila (celular), como en el listado de vacantes.
 */
export function Encabezado({ usuario, oscuro = false, buscador }: { usuario: Usuario | null; oscuro?: boolean; buscador?: React.ReactNode }) {
  const enlace = oscuro ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-tinta";
  return (
    <header className={oscuro ? "bg-noche" : "sticky top-0 z-40 border-b border-borde bg-white/95 backdrop-blur"}>
      <div className="contenedor flex h-16 items-center gap-4">
        <Logo claro={oscuro} />
        {buscador ? <div className="hidden flex-1 md:block">{buscador}</div> : <div className="flex-1" />}
        <nav className="flex items-center gap-2 text-sm font-medium sm:gap-3">
          <Link href="/vacantes" className={`hidden px-2 lg:inline ${enlace}`}>
            Vacantes
          </Link>
          <Link href="/empresas" className={`hidden px-2 lg:inline ${enlace}`}>
            Empresas
          </Link>
          <Link href="/publicar" className={`hidden px-2 lg:inline ${enlace}`}>
            Publica tu vacante
          </Link>
          {usuario?.esAdmin && (
            <Link href="/panel" className="hidden rounded-full bg-radar-claro px-4 py-2 font-semibold text-radar-oscuro hover:bg-blue-100 lg:inline">
              Panel de captura
            </Link>
          )}
          {usuario ? (
            <Link href="/cuenta" className={`rounded-full border px-4 py-2 font-semibold ${oscuro ? "border-white/20 text-white hover:bg-white/10" : "border-borde text-tinta hover:bg-slate-50"}`}>
              Mi cuenta
            </Link>
          ) : (
            <Link href="/entrar" className={`rounded-full px-4 py-2 font-semibold ${oscuro ? "bg-white text-noche hover:bg-slate-200" : "bg-noche text-white hover:bg-slate-700"}`}>
              Entrar
            </Link>
          )}
          {/* Menú (celular y tablet) sin JavaScript */}
          <details className="relative lg:hidden">
            <summary
              className={`flex size-9 cursor-pointer list-none items-center justify-center rounded-full border ${oscuro ? "border-white/20 text-white" : "border-borde text-tinta"}`}
              aria-label="Menú"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </summary>
            <div className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-2xl border border-borde bg-white py-2 text-tinta shadow-xl">
              {[
                ...(usuario?.esAdmin ? [["/panel", "Panel de captura"]] : []),
                ["/vacantes", "Vacantes"],
                ["/empezar", "Elegir mi área"],
                ["/empresas", "Empresas"],
                ["/cv", "Haz tu CV gratis"],
                ["/publicar", "Publica tu vacante"],
                ["/precios", "Precios"],
                [usuario ? "/cuenta" : "/entrar", usuario ? "Mi cuenta y alertas" : "Entrar"],
              ].map(([href, texto]) => (
                <Link key={href} href={href} className="block px-4 py-2.5 hover:bg-slate-50">
                  {texto}
                </Link>
              ))}
              <a href={FACEBOOK} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 border-t border-borde px-4 py-2.5 text-[#1877f2] hover:bg-slate-50">
                <IconoFacebook className="size-4" /> Síguenos en Facebook
              </a>
            </div>
          </details>
        </nav>
      </div>
      {buscador && <div className="contenedor pb-3 md:hidden">{buscador}</div>}
    </header>
  );
}

export function Pie() {
  return (
    <footer className="mt-20 bg-noche text-slate-400">
      <div className="contenedor grid gap-8 py-12 sm:grid-cols-3">
        <div className="space-y-3">
          <Logo claro />
          <p className="text-sm">Vacantes en México, LATAM y home office, sacadas directo de las páginas de empleo de las empresas.</p>
          <a href={FACEBOOK} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm hover:text-white" aria-label="ChambaRadar en Facebook">
            <IconoFacebook className="size-5" /> Síguenos en Facebook
          </a>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-semibold text-white">Explora</p>
          <Link href="/vacantes" className="block hover:text-white">Todas las vacantes</Link>
          <Link href="/vacantes?donde=mx" className="block hover:text-white">Empleos en México</Link>
          <Link href="/vacantes?donde=sonora" className="block hover:text-white">Empleos en Sonora</Link>
          <Link href="/obregon" className="block hover:text-white">Empleos en Cd. Obregón</Link>
          <Link href="/vacantes?donde=remoto" className="block hover:text-white">Home office</Link>
          <Link href="/cv" className="block hover:text-white">Haz tu CV gratis</Link>
          <Link href="/empresas" className="block hover:text-white">Empresas que contratan</Link>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-semibold text-white">ChambaRadar</p>
          <Link href="/publicar" className="block hover:text-white">Publica tu vacante gratis</Link>
          <Link href="/precios" className="block hover:text-white">Precios</Link>
          <Link href="/privacidad" className="block hover:text-white">Aviso de privacidad</Link>
          <Link href="/terminos" className="block hover:text-white">Términos y condiciones</Link>
          <a href={`mailto:${CORREO_CONTACTO}`} className="block break-all hover:text-white">Contacto: {CORREO_CONTACTO}</a>
        </div>
      </div>
      <p className="contenedor border-t border-white/10 py-6 text-xs">© {new Date().getFullYear()} ChambaRadar. Hecho en México.</p>
    </footer>
  );
}
