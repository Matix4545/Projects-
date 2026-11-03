import type { Metadata } from "next";
import Link from "next/link";
import { Flecha } from "@/components/Iconos";
import { Logo } from "@/components/Marco";
import { CATEGORIAS, NOMBRE_CATEGORIA, type Categoria } from "@/lib/tipos";

export const metadata: Metadata = { title: "¿Qué chamba buscas?" };

const EMOJI: Record<Categoria, string> = {
  agro: "🌾",
  software: "💻",
  "datos-ia": "🤖",
  producto: "🧩",
  diseno: "🎨",
  marketing: "📣",
  ventas: "🤝",
  "atencion-clientes": "💬",
  finanzas: "💰",
  "recursos-humanos": "🧑‍🤝‍🧑",
  operaciones: "📦",
  legal: "⚖️",
  seguridad: "🔐",
  otros: "✨",
};

const DONDE = [
  { valor: "todo", titulo: "Donde sea", texto: "Todo México y LATAM, presencial y remoto" },
  { valor: "remoto", titulo: "Home office", texto: "Remoto desde tu casa, para empresas de México y del mundo" },
  { valor: "mx", titulo: "En México", texto: "Presencial o híbrido: CDMX, Monterrey, Guadalajara, Sonora…" },
  { valor: "sonora", titulo: "En Sonora", texto: "Hermosillo, Cd. Obregón, Navojoa, Guaymas, Nogales…" },
];

/** Paso de bienvenida: elegir área y dónde, y de ahí al listado ya filtrado. */
export default function Empezar() {
  return (
    <main className="min-h-screen bg-fondo px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <Logo />
          <Link href="/vacantes" className="text-sm font-medium text-gris hover:text-tinta">
            Saltar
          </Link>
        </div>

        <form action="/vacantes" className="mt-8 rounded-3xl bg-white p-5 text-tinta shadow-xl shadow-slate-200/70 border border-borde sm:mt-12 sm:p-8">
          <p className="text-sm font-semibold text-radar-oscuro">Paso 1 de 2</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">¿Qué tipo de chamba buscas?</h1>
          <fieldset className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <legend className="sr-only">Área</legend>
            {CATEGORIAS.map((c, i) => (
              <label key={c} className="cursor-pointer">
                <input type="radio" name="categoria" value={c} defaultChecked={i === 0} className="peer sr-only" />
                <span className="flex h-full items-center gap-2.5 rounded-2xl border-2 border-borde px-3 py-3 text-sm font-semibold transition peer-checked:border-radar peer-checked:bg-radar-claro/50 peer-focus-visible:ring-4 peer-focus-visible:ring-radar/20 hover:border-slate-300">
                  <span className="text-xl" aria-hidden>
                    {EMOJI[c]}
                  </span>
                  {NOMBRE_CATEGORIA[c]}
                </span>
              </label>
            ))}
            <label className="cursor-pointer">
              <input type="radio" name="categoria" value="" className="peer sr-only" />
              <span className="flex h-full items-center gap-2.5 rounded-2xl border-2 border-dashed border-borde px-3 py-3 text-sm font-semibold text-gris transition peer-checked:border-radar peer-checked:bg-radar-claro/50 peer-checked:text-tinta hover:border-slate-300">
                <span className="text-xl" aria-hidden>
                  🌎
                </span>
                Ver todas
              </span>
            </label>
          </fieldset>

          <p className="mt-8 text-sm font-semibold text-radar-oscuro">Paso 2 de 2</p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight sm:text-2xl">¿Dónde quieres trabajar?</h2>
          <fieldset className="mt-4 grid gap-2.5 sm:grid-cols-2">
            <legend className="sr-only">Dónde</legend>
            {DONDE.map((d, i) => (
              <label key={d.valor || "todo"} className="cursor-pointer">
                <input type="radio" name="donde" value={d.valor} defaultChecked={i === 0} className="peer sr-only" />
                <span className="block h-full rounded-2xl border-2 border-borde p-4 transition peer-checked:border-radar peer-checked:bg-radar-claro/50 peer-focus-visible:ring-4 peer-focus-visible:ring-radar/20 hover:border-slate-300">
                  <span className="block font-bold">{d.titulo}</span>
                  <span className="mt-0.5 block text-sm text-gris">{d.texto}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <button className="boton mt-8 w-full py-3.5 text-base">
            Ver mis vacantes <Flecha className="size-4" />
          </button>
          <p className="mt-3 text-center text-sm text-gris">Gratis y sin registrarte. Puedes cambiar los filtros cuando quieras.</p>
        </form>
      </div>
    </main>
  );
}
