import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgeDias } from "@/components/BadgeDias";
import { Barras, Seccion, Tarjeta, Vacio, num } from "@/components/graficas";
import { DEPENDENCIAS, INFO_PIN, tituloReporte, type TipoPin } from "@/lib/constantes";
import type { Pin } from "@/lib/datos";
import { sesionPanelValida } from "@/lib/panel";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { folio } from "@/lib/urgencia";

// Solo para el equipo: pide la misma contraseña que /panel
export const metadata: Metadata = {
  title: "Estadísticas · Reporta Cajeme",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

type Estadisticas = {
  generado: string;
  pendientes: number;
  criticos: number;
  resueltos_90d: number;
  dias_promedio_resolucion: number | null;
  dias_promedio_pendientes: number | null;
  agua_problemas_7d: number;
  colonias_agua_afectadas: number;
  por_tipo: { tipo: TipoPin; pendientes: number; criticos: number; resueltos: number; suma_dias_resolucion: number }[];
  top_colonias: { colonia: string; pendientes: number; criticos: number; dias_max: number }[];
  olvidados: Pick<Pin, "id" | "tipo" | "subtipo" | "colonia" | "confirmaciones" | "creado_en" | "foto">[];
};

const porcentaje = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 100) : null);
const dias = (n: number | null) => (n === null ? "—" : `${num(n)} ${n === 1 ? "día" : "días"}`);

export default async function PaginaEstadisticas() {
  if (!(await sesionPanelValida())) redirect("/panel");
  const { data, error } = await supabaseServidor().rpc("estadisticas_equipo");
  if (error) console.error("estadisticas_equipo:", error.message);
  const e = (data as Estadisticas | null) ?? null;

  return (
    <main className="mx-auto max-w-4xl bg-white px-4 pb-16 pt-6 text-gray-900 sm:my-6 sm:rounded-2xl sm:px-8 sm:shadow">
      <nav className="flex gap-4 text-sm font-semibold text-blue-700">
        <Link href="/" className="underline">
          ← Mapa
        </Link>
        <Link href="/panel" className="underline">
          Reporte ejecutivo
        </Link>
      </nav>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-400">🔒 Solo equipo</p>
      <h1 className="text-2xl font-extrabold">¿Qué tan rápido se atienden los reportes?</h1>

      {!e ? (
        <p className="mt-8 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          No se pudieron calcular las estadísticas. ¿Ya corriste <code>02_funciones.sql</code> en Supabase?
        </p>
      ) : (
        <Contenido e={e} />
      )}

      <p className="mt-10 border-t border-gray-200 pt-4 text-xs text-gray-500">
        Datos de percepción ciudadana reportados de forma anónima. “Resuelto” significa que 3 vecinos confirmaron que ya
        lo arreglaron; no son cifras oficiales. La dependencia responsable es una guía aproximada.
      </p>
    </main>
  );
}

function Contenido({ e }: { e: Estadisticas }) {
  const pct = porcentaje(e.resueltos_90d, e.resueltos_90d + e.pendientes);

  const dependencias = DEPENDENCIAS.map((d) => {
    const filas = e.por_tipo.filter((t) => d.tipos.includes(t.tipo));
    const pendientes = filas.reduce((s, t) => s + t.pendientes, 0);
    const criticos = filas.reduce((s, t) => s + t.criticos, 0);
    const resueltos = filas.reduce((s, t) => s + t.resueltos, 0);
    const sumaDias = filas.reduce((s, t) => s + Number(t.suma_dias_resolucion), 0);
    return {
      ...d,
      pendientes,
      criticos,
      resueltos,
      pct: porcentaje(resueltos, resueltos + pendientes),
      promedio: resueltos > 0 ? Math.round((sumaDias / resueltos) * 10) / 10 : null,
    };
  });

  return (
    <>
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tarjeta titulo="Reportes activos" valor={num(e.pendientes)} nota="Pendientes en el mapa" />
        <Tarjeta
          titulo="Resueltos"
          valor={pct === null ? "—" : `${pct}%`}
          nota={`${num(e.resueltos_90d)} arreglados en los últimos 90 días`}
        />
        <Tarjeta titulo="Tiempo promedio de atención" valor={dias(e.dias_promedio_resolucion)} nota="De reporte a arreglado" />
        <Tarjeta
          titulo="Más de 30 días sin atención"
          valor={num(e.criticos)}
          nota={e.dias_promedio_pendientes === null ? "Sin pendientes" : `Los pendientes llevan ${dias(e.dias_promedio_pendientes)} en promedio`}
        />
      </section>

      <Seccion titulo="Desempeño por dependencia" nota="A quién le toca, de forma aproximada. Resueltos: últimos 90 días.">
        <div className="grid gap-3 sm:grid-cols-2">
          {dependencias.map((d) => (
            <article key={d.clave} className="rounded-xl border border-gray-200 p-4">
              <h3 className="text-lg font-extrabold">{d.nombre}</h3>
              <p className="text-xs text-gray-500">
                {d.descripcion} · {d.tipos.map((t) => INFO_PIN[t].emoji).join(" ")}
              </p>
              <div className="mt-3 flex items-baseline justify-between text-sm">
                <span className="font-semibold">Resuelto</span>
                <strong className="text-2xl tabular-nums">{d.pct === null ? "—" : `${d.pct}%`}</strong>
              </div>
              <div className="mt-1 h-2 rounded-full bg-gray-100" role="img" aria-label={`${d.pct ?? 0}% resuelto`}>
                <div className="h-2 rounded-full bg-green-600" style={{ width: `${d.pct ?? 0}%` }} />
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                <div>
                  <dt className="text-xs text-gray-500">Pendientes</dt>
                  <dd className="font-bold tabular-nums">{num(d.pendientes)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">+30 días</dt>
                  <dd className={`font-bold tabular-nums ${d.criticos > 0 ? "text-red-600" : ""}`}>{num(d.criticos)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Tarda</dt>
                  <dd className="font-bold tabular-nums">{dias(d.promedio)}</dd>
                </div>
              </dl>
              {d.clave === "oomapasc" && (
                <p className="mt-3 rounded-lg bg-blue-50 p-2 text-xs text-blue-900">
                  💧 Agua: {num(e.agua_problemas_7d)} reportes de falta de agua, baja presión o agua sucia en 7 días ·{" "}
                  {num(e.colonias_agua_afectadas)} colonias afectadas ahora (72 h).
                </p>
              )}
            </article>
          ))}
        </div>
      </Seccion>

      <div className="grid gap-x-8 sm:grid-cols-2">
        <Seccion titulo="Colonias con más reportes sin resolver">
          {e.top_colonias.length === 0 ? (
            <Vacio texto="No hay reportes pendientes." />
          ) : (
            <Barras
              colorBarra="#dc2626"
              filas={e.top_colonias.map((c) => ({
                etiqueta: c.colonia,
                valor: c.pendientes,
                extra: c.criticos > 0 ? `${num(c.criticos)} con +30 días` : `el más viejo: ${dias(c.dias_max)}`,
              }))}
            />
          )}
        </Seccion>

        <Seccion titulo="Pendientes por tipo">
          <Barras
            colorBarra="#ea580c"
            filas={e.por_tipo.map((t) => ({
              etiqueta: `${INFO_PIN[t.tipo]?.emoji ?? ""} ${INFO_PIN[t.tipo]?.plural ?? t.tipo}`,
              muestra: INFO_PIN[t.tipo]?.color,
              valor: t.pendientes,
              extra: t.resueltos > 0 ? `${num(t.resueltos)} resueltos` : undefined,
            }))}
          />
        </Seccion>
      </div>

      <Seccion titulo="Los más olvidados" nota="Reportes pendientes más antiguos. Toca uno para verlo en el mapa.">
        {e.olvidados.length === 0 ? (
          <Vacio texto="No hay reportes pendientes." />
        ) : (
          <ul className="divide-y divide-gray-100">
            {e.olvidados.map((o) => (
              <li key={o.id}>
                <Link href={`/?pin=${o.id}`} className="flex items-center justify-between gap-3 py-3">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">
                      {INFO_PIN[o.tipo]?.emoji} {tituloReporte(o)}
                    </span>
                    <span className="block truncate text-xs text-gray-500">
                      {o.colonia ?? "Cajeme"} · {folio(o.id)} · +{num(o.confirmaciones)}
                    </span>
                  </span>
                  <span className="shrink-0">
                    <BadgeDias pin={{ estado: "activo", creado_en: o.creado_en, arreglado_en: null }} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Seccion>
    </>
  );
}
