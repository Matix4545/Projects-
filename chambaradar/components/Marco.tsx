import Link from "next/link";
import type { Usuario } from "@/lib/supabase/servidor";

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

export function Encabezado({ usuario, oscuro = false }: { usuario: Usuario | null; oscuro?: boolean }) {
  const enlace = oscuro ? "text-slate-300 hover:text-white" : "text-gris hover:text-tinta";
  return (
    <header className={oscuro ? "bg-noche" : "border-b border-borde bg-white"}>
      <div className="contenedor flex h-16 items-center justify-between gap-4">
        <Logo claro={oscuro} />
        <nav className="flex items-center gap-4 text-sm font-medium sm:gap-6">
          <Link href="/vacantes" className={enlace}>
            Vacantes
          </Link>
          <Link href="/empresas" className={`hidden sm:inline ${enlace}`}>
            Empresas
          </Link>
          <Link href="/precios" className={`hidden sm:inline ${enlace}`}>
            Precios
          </Link>
          {usuario ? (
            <Link href="/cuenta" className={enlace}>
              Mi cuenta
            </Link>
          ) : (
            <Link href="/entrar" className="rounded-lg bg-radar px-3 py-1.5 text-white hover:bg-radar-oscuro">
              Entrar
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

export function Pie() {
  return (
    <footer className="mt-20 bg-noche text-slate-400">
      <div className="contenedor grid gap-8 py-12 sm:grid-cols-3">
        <div className="space-y-3">
          <Logo claro />
          <p className="text-sm">Vacantes de México y LATAM sacadas directo de las páginas de empleo de las empresas.</p>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-semibold text-white">Explora</p>
          <Link href="/vacantes" className="block hover:text-white">Todas las vacantes</Link>
          <Link href="/vacantes?tipo=remoto&modalidad=remoto" className="block hover:text-white">Remoto en dólares</Link>
          <Link href="/vacantes?pais=MX" className="block hover:text-white">Vacantes en México</Link>
          <Link href="/empresas" className="block hover:text-white">Empresas que contratan</Link>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-semibold text-white">ChambaRadar</p>
          <Link href="/precios" className="block hover:text-white">Precios</Link>
          <Link href="/privacidad" className="block hover:text-white">Aviso de privacidad</Link>
          <Link href="/terminos" className="block hover:text-white">Términos y condiciones</Link>
          <a href="mailto:hola@chambaradar.com" className="block hover:text-white">hola@chambaradar.com</a>
        </div>
      </div>
      <p className="contenedor border-t border-white/10 py-6 text-xs">© {new Date().getFullYear()} ChambaRadar. Hecho en México.</p>
    </footer>
  );
}
