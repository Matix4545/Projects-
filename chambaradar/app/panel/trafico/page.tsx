import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Encabezado, Pie } from "@/components/Marco";
import { NOMBRE_ZONA_VISITA, type Zona } from "@/lib/estadisticas";
import { numero } from "@/lib/formato";
import { supabaseConfigurado, supabaseSesion, usuarioActual } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Tráfico", robots: { index: false } };

interface Fila {
  clave: string;
  n?: number;
  visitantes?: number;
  aplicar?: number;
}
interface Dia {
  dia: string;
  visitantes: number;
  vistas: number;
  aplicar: number;
}
interface Datos {
  resumen: { visitantes: number; vistas: number; aplicar: number; aplicar_bloqueada: number; busquedas: number; obregon: number };
  por_dia: Dia[];
  por_zona: Fila[];
  por_origen: Fila[];
  por_dispositivo: Fila[];
  busquedas: Fila[];
  paginas: Fila[];
  empresas: Fila[];
}

const PERIODOS = [7, 30, 90] as const;
const NOMBRE_DISPOSITIVO: Record<string, string> = { movil: "Celular", escritorio: "Computadora" };
const fechaCorta = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short" });

function Cifra({ valor, texto, nota }: { valor: number; texto: string; nota?: string }) {
  return (
    <div className="rounded-2xl border border-borde bg-white p-4">
      <p className="text-sm text-gris">{texto}</p>
      <p className="mt-1 text-3xl font-extrabold tracking-tight tabular-nums">{numero(valor)}</p>
      {nota && <p className="mt-1 text-xs text-gris">{nota}</p>}
    </div>
  );
}

/** Lista con barra horizontal: una sola serie, un solo color; el número va en texto, no en la barra. */
function Lista({ titulo, filas, nombre = (c) => c, vacio = "Todavía sin datos." }: { titulo: string; filas: { clave: string; n: number }[]; nombre?: (c: string) => string; vacio?: string }) {
  const max = Math.max(1, ...filas.map((f) => f.n));
  return (
    <section className="rounded-2xl border border-borde bg-white p-5">
      <h2 className="font-bold">{titulo}</h2>
      {filas.length === 0 ? (
        <p className="mt-3 text-sm text-gris">{vacio}</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {filas.map((f) => (
            <li key={f.clave} title={`${nombre(f.clave)}: ${numero(f.n)}`}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{nombre(f.clave)}</span>
                <span className="shrink-0 font-semibold tabular-nums">{numero(f.n)}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                <div className="h-1.5 rounded-full bg-radar" style={{ width: `${Math.max(2, (f.n / max) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Visitantes por día: columnas finas con 2px de separación, eje recesivo y la tabla a un clic. */
function PorDia({ dias }: { dias: Dia[] }) {
  const max = Math.max(1, ...dias.map((d) => d.visitantes));
  const marcas = dias.length <= 10 ? dias.map((_, i) => i) : [0, Math.floor(dias.length / 2), dias.length - 1];
  return (
    <section className="rounded-2xl border border-borde bg-white p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-bold">Visitantes por día</h2>
        <p className="text-xs text-gris">Máximo: {numero(max)}</p>
      </div>
      <div className="mt-4 flex h-40 items-end gap-0.5 border-b border-slate-200" role="img" aria-label="Visitantes por día">
        {dias.map((d) => (
          <div key={d.dia} className="group relative flex h-full flex-1 items-end" title={`${fechaCorta(d.dia)}: ${numero(d.visitantes)} visitantes, ${numero(d.aplicar)} clics en Aplicar`}>
            <div className="w-full rounded-t bg-radar transition group-hover:bg-radar-oscuro" style={{ height: `${d.visitantes ? Math.max(3, (d.visitantes / max) * 100) : 0}%` }} />
          </div>
        ))}
      </div>
      <div className="relative mt-1.5 h-4 text-[11px] text-gris">
        {marcas.map((i) => (
          <span key={i} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${((i + 0.5) / dias.length) * 100}%` }}>
            {fechaCorta(dias[i].dia)}
          </span>
        ))}
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-gris">Ver tabla</summary>
        <table className="mt-2 w-full text-sm">
          <thead className="text-left text-gris">
            <tr>
              <th className="py-1 font-medium">Día</th>
              <th className="py-1 text-right font-medium">Visitantes</th>
              <th className="py-1 text-right font-medium">Páginas vistas</th>
              <th className="py-1 text-right font-medium">Clics en Aplicar</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {[...dias].reverse().map((d) => (
              <tr key={d.dia} className="border-t border-slate-100">
                <td className="py-1">{fechaCorta(d.dia)}</td>
                <td className="py-1 text-right">{numero(d.visitantes)}</td>
                <td className="py-1 text-right">{numero(d.vistas)}</td>
                <td className="py-1 text-right">{numero(d.aplicar)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function Trafico({ searchParams }: Props) {
  const { dias: diasTexto } = await searchParams;
  const dias = PERIODOS.find((p) => String(p) === diasTexto) ?? 30;
  if (!supabaseConfigurado()) notFound();
  const usuario = await usuarioActual();
  if (!usuario?.esAdmin) notFound();
  const { data, error } = await (await supabaseSesion()).rpc("estadisticas_trafico", { p_dias: dias });
  if (error || !data) throw new Error(error?.message ?? "Sin estadísticas");
  const d = data as Datos;
  const r = d.resumen;
  const n = (f: Fila) => ({ clave: f.clave, n: f.n ?? 0 });

  return (
    <>
      <Encabezado usuario={usuario} />
      <main className="contenedor max-w-5xl space-y-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link href="/panel" className="text-sm font-medium text-radar-oscuro hover:underline">
              ← Panel
            </Link>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Tráfico</h1>
            <p className="text-sm text-gris">Sin cookies: cada visitante se cuenta una vez por día. No incluye robots ni tus visitas al panel.</p>
          </div>
          <nav className="flex rounded-full border border-borde bg-white p-1 text-sm font-semibold" aria-label="Periodo">
            {PERIODOS.map((p) => (
              <Link key={p} href={`/panel/trafico?dias=${p}`} className={`rounded-full px-3 py-1.5 ${p === dias ? "bg-noche text-white" : "text-gris hover:text-tinta"}`} aria-current={p === dias ? "page" : undefined}>
                {p} días
              </Link>
            ))}
          </nav>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Cifra valor={r.visitantes} texto="Visitantes" nota={`${numero(r.vistas)} páginas vistas`} />
          <Cifra valor={r.obregon} texto="De Cd. Obregón" nota={r.visitantes ? `${Math.round((r.obregon / r.visitantes) * 100)} % del total` : undefined} />
          <Cifra valor={r.aplicar} texto="Clics en Aplicar" nota="Gente que fue a aplicar" />
          <Cifra valor={r.aplicar_bloqueada} texto="Aplicar sin pagar" nota="Tocaron Aplicar con candado" />
          <Cifra valor={r.busquedas} texto="Búsquedas" />
        </div>

        <PorDia dias={d.por_dia} />

        <div className="grid gap-4 md:grid-cols-2">
          <Lista titulo="¿De dónde son?" filas={d.por_zona.map((f) => ({ clave: f.clave, n: f.visitantes ?? 0 }))} nombre={(c) => NOMBRE_ZONA_VISITA[c as Zona] ?? c} />
          <Lista titulo="¿Cómo llegaron?" filas={d.por_origen.map(n)} nombre={(c) => c.charAt(0).toUpperCase() + c.slice(1)} />
          <Lista titulo="Empresas con más clics en Aplicar" filas={d.empresas.map(n)} vacio="Todavía nadie ha dado clic en Aplicar." />
          <Lista titulo="Lo más buscado" filas={d.busquedas.map(n)} vacio="Todavía no hay búsquedas." />
          <Lista titulo="Páginas más vistas" filas={d.paginas.map(n)} />
          <Lista titulo="Dispositivo" filas={d.por_dispositivo.map(n)} nombre={(c) => NOMBRE_DISPOSITIVO[c] ?? c} />
        </div>
      </main>
      <Pie />
    </>
  );
}
