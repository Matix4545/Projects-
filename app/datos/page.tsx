import type { Metadata } from "next";
import Link from "next/link";
import { Barras, Seccion, Tabla, Tarjeta, Vacio, num } from "@/components/graficas";
import { Pagina } from "@/components/Pagina";
import { COLOR_ESTADO, ESTADOS_AGUA, ETIQUETAS, INFO_PIN, tituloReporte, type TipoPin } from "@/lib/constantes";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { BotonCompartir } from "./BotonCompartir";

// Página pública con las cifras del mapa: para vecinos, periodistas y autoridades.
// Se vuelve a generar cada 5 minutos (con mucho tráfico, Supabase recibe 1 consulta cada 5 min).
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Datos · Reporta Cajeme",
  description: "Cuántos reportes han hecho los vecinos de Cajeme, de qué tipo, en qué colonias y cuántos ya se arreglaron.",
  openGraph: { title: "Reporta Cajeme · Datos", description: "Lo que han reportado los vecinos de Cajeme, en números." },
};

type Datos = {
  generado: string;
  desde: string;
  total: number;
  total_agua: number;
  total_puntos: number;
  colonias_con_reportes: number;
  colonias_afectadas_7d: number;
  activos: number;
  arreglados: number;
  dias_promedio_arreglo: number | null;
  dias_promedio_pendientes: number | null;
  por_dia: { dia: string; n: number }[];
  por_tipo: { tipo: TipoPin | "agua"; n: number; activos: number; arreglados: number }[];
  agua_por_estado: Partial<Record<string, number>>;
  top_colonias: { colonia: string; total: number; agua: number; otros: number }[];
  mas_confirmados: { id: number; tipo: TipoPin; subtipo: string; colonia: string; confirmaciones: number; creado_en: string }[];
};

const fechaLarga = (dia: string) =>
  new Date(`${dia}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
const fechaCorta = (dia: string) => new Date(`${dia}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
const dias = (n: number | null) => (n === null ? "—" : `${num(Math.round(n))} ${Math.round(n) === 1 ? "día" : "días"}`);
const nombreTipo = (t: TipoPin | "agua") => (t === "agua" ? "💧 Agua" : `${INFO_PIN[t]?.emoji ?? ""} ${INFO_PIN[t]?.plural ?? t}`);
const colorTipo = (t: TipoPin | "agua") => (t === "agua" ? "#007aff" : INFO_PIN[t]?.color);

export default async function PaginaDatos() {
  const { data, error } = await supabaseServidor().rpc("datos_publicos");
  if (error) console.error("datos_publicos:", error.message);
  const d = (data as Datos | null) ?? null;

  return (
    <Pagina
      titulo="Datos"
      ancho="max-w-3xl"
      subtitulo={d ? `Lo que han reportado los vecinos de Cajeme desde el ${fechaLarga(d.desde)}.` : undefined}
    >
      {!d ? (
        <p className="rounded-2xl bg-white p-4 text-[15px] text-ios-secundario">No se pudieron cargar los datos. Intenta en unos minutos.</p>
      ) : (
        <Contenido d={d} />
      )}
    </Pagina>
  );
}

function Contenido({ d }: { d: Datos }) {
  const max = Math.max(1, ...d.por_dia.map((x) => x.n));
  const totalAgua = ESTADOS_AGUA.reduce((s, e) => s + (d.agua_por_estado[e] ?? 0), 0);
  const actualizado = new Date(d.generado).toLocaleString("es-MX", {
    timeZone: "America/Hermosillo",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <>
      {/* Cifra principal */}
      <section className="rounded-3xl bg-white px-5 py-6 text-center">
        <p className="text-[64px] font-bold leading-none tracking-tight tabular-nums">{num(d.total)}</p>
        <p className="mt-2 text-[17px] font-semibold">reportes ciudadanos</p>
        <p className="mt-1 text-[15px] text-ios-secundario">
          en {num(d.colonias_con_reportes)} colonias · {num(d.total_puntos)} con ubicación y {num(d.total_agua)} de agua
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tarjeta titulo="Sin resolver" valor={num(d.activos)} nota="Reportes con ubicación pendientes" />
        <Tarjeta
          titulo="Arreglados"
          valor={num(d.arreglados)}
          nota={d.arreglados ? `Tardaron ${dias(d.dias_promedio_arreglo)} en promedio` : "Aún ninguno confirmado por 3 vecinos"}
        />
        <Tarjeta titulo="Esperando" valor={dias(d.dias_promedio_pendientes)} nota="Tiempo promedio de los pendientes" />
        <Tarjeta titulo="Colonias con problemas de agua" valor={num(d.colonias_afectadas_7d)} nota="En los últimos 7 días" />
      </section>

      <Seccion titulo="Reportes por día">
        <p className="mb-2 text-xs text-ios-secundario">Máximo: {num(max)} en un día</p>
        <div className="flex h-40 items-end gap-[3px]" role="img" aria-label={`Reportes por día; máximo ${max}`}>
          {d.por_dia.map((x) => (
            <div key={x.dia} className="flex h-full flex-1 items-end" title={`${fechaCorta(x.dia)}: ${num(x.n)}`}>
              <div className="w-full rounded-t-[3px] bg-ios-azul" style={{ height: `${(x.n / max) * 100}%`, minHeight: x.n > 0 ? 2 : 0 }} />
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-xs text-ios-secundario">
          <span>{fechaCorta(d.por_dia[0].dia)}</span>
          <span>{fechaCorta(d.por_dia[d.por_dia.length - 1].dia)}</span>
        </div>
      </Seccion>

      <div className="grid gap-x-6 sm:grid-cols-2">
        <Seccion titulo="¿Qué reportan?">
          <Barras
            filas={d.por_tipo.map((t) => ({
              etiqueta: nombreTipo(t.tipo),
              muestra: colorTipo(t.tipo),
              valor: t.n,
              extra: t.arreglados > 0 ? `${num(t.arreglados)} arreglados` : undefined,
            }))}
          />
        </Seccion>
        <Seccion titulo="Agua" nota="Lo que reportan los vecinos de su colonia.">
          {totalAgua === 0 ? (
            <Vacio texto="Sin reportes de agua todavía." />
          ) : (
            <Barras
              filas={ESTADOS_AGUA.map((e) => ({
                etiqueta: ETIQUETAS[e],
                muestra: COLOR_ESTADO[e],
                valor: d.agua_por_estado[e] ?? 0,
                extra: `${Math.round(((d.agua_por_estado[e] ?? 0) / totalAgua) * 100)}%`,
              }))}
            />
          )}
        </Seccion>
      </div>

      <Seccion titulo="Colonias con más reportes">
        {d.top_colonias.length === 0 ? (
          <Vacio />
        ) : (
          <Tabla
            encabezados={["Colonia", "Total", "Agua", "Otros"]}
            numericas={[1, 2, 3]}
            filas={d.top_colonias.map((c) => [c.colonia, <strong key={c.colonia}>{num(c.total)}</strong>, num(c.agua), num(c.otros)])}
          />
        )}
      </Seccion>

      {d.mas_confirmados.length > 0 && (
        <Seccion titulo="Los más confirmados por vecinos" nota="Siguen pendientes. Toca uno para verlo en el mapa.">
          <ul className="-my-1">
            {d.mas_confirmados.map((r) => (
              <li key={r.id} className="border-t-[0.5px] border-ios-separador first:border-t-0">
                <Link href={`/?pin=${r.id}`} className="flex items-center gap-3 py-3">
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[20px]"
                    style={{ background: `${INFO_PIN[r.tipo]?.color ?? "#8e8e93"}33` }}
                    aria-hidden
                  >
                    {INFO_PIN[r.tipo]?.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-medium">{tituloReporte(r)}</span>
                    <span className="block truncate text-[13px] text-ios-secundario">
                      {r.colonia} · desde el {fechaCorta(r.creado_en.slice(0, 10))}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[17px] font-semibold tabular-nums">+{num(r.confirmaciones)}</span>
                    <span className="block text-[11px] text-ios-secundario">vecinos</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Seccion>
      )}

      <div className="mt-8 space-y-3">
        <Link href="/" className="boton boton-principal w-full">
          Ver el mapa y reportar
        </Link>
        <BotonCompartir texto={`${num(d.total)} reportes ciudadanos en Cajeme: baches, agua, drenaje y más.`} />
      </div>

      <p className="mt-8 px-4 text-xs leading-relaxed text-ios-secundario">
        Datos de percepción ciudadana reportados de forma anónima en Reporta Cajeme; no son cifras oficiales. “Arreglado”
        significa que 3 vecinos confirmaron que ya se resolvió. Actualizado el {actualizado} (hora de Sonora).
      </p>
    </>
  );
}
