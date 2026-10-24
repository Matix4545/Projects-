import type { Metadata } from "next";
import Link from "next/link";
import { COLOR_ESTADO, ESTADOS_AGUA, ETIQUETAS, INFO_PIN, type EstadoAgua, type TipoPin } from "@/lib/constantes";
import { diasValidos, panelConfigurado, sesionPanelValida } from "@/lib/panel";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { Pagina } from "@/components/Pagina";
import { Barras, Caja, Seccion, Tabla, Tarjeta, Vacio, num } from "@/components/graficas";
import { BotonImprimir } from "./BotonImprimir";

export const metadata: Metadata = {
  title: "Reporte ejecutivo · Reporta Cajeme",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

type Reporte = {
  dias: number;
  generado: string;
  total: number;
  total_anterior: number;
  total_historico: number;
  colonias_afectadas_ahora: number;
  activos: number;
  arreglados: number;
  dias_promedio_arreglo: number | null;
  por_dia: { dia: string; n: number }[];
  por_tipo: { tipo: "agua" | TipoPin; n: number; arreglados: number }[];
  agua_por_estado: Partial<Record<EstadoAgua, number>>;
  por_detalle: { tipo: TipoPin; detalle: string; n: number }[];
  top_colonias: { colonia: string; total: number; agua: number; sin_agua: number; otros: number }[];
  urgentes: { id: number; tipo: TipoPin; subtipo: string; colonia: string; lat: number; lng: number; confirmaciones: number; creado_en: string; peligroso: boolean }[];
  moderacion: { comentarios_ocultos: number; fotos_ocultas: number; en_revision: number };
};

const fechaCorta = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
const nombreTipo = (t: string) => (t === "agua" ? "💧 Agua" : `${INFO_PIN[t as TipoPin]?.emoji ?? ""} ${INFO_PIN[t as TipoPin]?.plural ?? t}`);

const ERRORES: Record<string, string> = {
  clave: "Contraseña incorrecta.",
  "demasiados-intentos": "Demasiados intentos. Vuelve a intentarlo mañana.",
  "sin-configurar": "El panel no está activado.",
};

export default async function Panel({ searchParams }: { searchParams: Promise<{ dias?: string; error?: string }> }) {
  const { dias: diasTexto, error } = await searchParams;

  if (!panelConfigurado()) {
    return (
      <Caja>
        <h1 className="text-[22px] font-bold">Panel no activado</h1>
        <p className="mt-2 text-[15px] text-ios-secundario">
          Para activarlo, agrega la variable <code className="rounded bg-ios-relleno px-1">PANEL_CLAVE</code> en Vercel
          (mínimo 10 caracteres) y vuelve a publicar.
        </p>
      </Caja>
    );
  }

  if (!(await sesionPanelValida())) {
    return (
      <Caja>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-ios-azul text-white">
          <svg width="22" height="26" viewBox="0 0 11 13" aria-hidden>
            <rect x="0.5" y="5.5" width="10" height="7" rx="2" fill="currentColor" />
            <path d="M2.8 5.5V4a2.7 2.7 0 0 1 5.4 0v1.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
          </svg>
        </div>
        <h1 className="mt-4 text-center text-[22px] font-bold">Equipo</h1>
        <p className="mt-1 text-center text-[15px] text-ios-secundario">Acceso solo para la administración de Reporta Cajeme.</p>
        <form action="/api/panel/entrar" method="post" className="mt-6 space-y-3">
          <label className="sr-only" htmlFor="clave">
            Contraseña
          </label>
          <input id="clave" name="clave" type="password" required autoComplete="current-password" placeholder="Contraseña" className="campo" />
          {error && <p className="text-[15px] text-ios-rojo">{ERRORES[error] ?? "No se pudo entrar."}</p>}
          <button className="boton boton-principal w-full">Entrar</button>
        </form>
        <Link href="/" className="mt-4 block text-center text-[15px] text-ios-azul">
          Volver al mapa
        </Link>
      </Caja>
    );
  }

  const dias = diasValidos(diasTexto);
  const { data, error: errorDatos } = await supabaseServidor().rpc("reporte_ejecutivo", { p_dias: dias });
  if (errorDatos || !data) {
    return (
      <Caja>
        <h1 className="text-[22px] font-bold">No se pudo generar el reporte</h1>
        <p className="mt-2 text-[15px] text-ios-secundario">
          ¿Ya corriste <code>02_funciones.sql</code> y <code>03_seguridad.sql</code> en Supabase? Detalle: {errorDatos?.message}
        </p>
      </Caja>
    );
  }
  const r = data as Reporte;

  const cambio = r.total_anterior > 0 ? Math.round(((r.total - r.total_anterior) / r.total_anterior) * 100) : null;
  const totalAgua = Object.values(r.agua_por_estado).reduce((s, n) => s + (n ?? 0), 0);
  const maxDia = Math.max(1, ...r.por_dia.map((d) => d.n));
  const generado = new Date(r.generado).toLocaleString("es-MX", { timeZone: "America/Hermosillo", dateStyle: "long", timeStyle: "short" });

  return (
    <Pagina
      ancho="max-w-4xl"
      titulo="Reporte ejecutivo"
      subtitulo={`Últimos ${dias} días · Generado el ${generado} (hora de Sonora)`}
      accion={
        <form action="/api/panel/salir" method="post">
          <button className="text-[17px] text-ios-azul">Salir</button>
        </form>
      }
    >
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <nav className="segmentado w-full sm:w-64" aria-label="Periodo">
          {[7, 30, 90].map((d) => (
            <Link key={d} href={`/panel?dias=${d}`} aria-current={d === dias ? "page" : undefined}
              className={`flex-1 rounded-[7px] py-1.5 text-center text-[13px] ${d === dias ? "bg-white font-semibold shadow-[0_3px_8px_rgba(0,0,0,0.12)]" : "font-medium"}`}>
              {d} días
            </Link>
          ))}
        </nav>
        <Link href="/" className="boton boton-principal min-h-9 rounded-full px-4 text-[15px]">Mapa del equipo</Link>
        <Link href="/estadisticas" className="boton boton-tenue min-h-9 rounded-full px-4 text-[15px]">Estadísticas</Link>
        <Link href="/medir" className="boton boton-tenue min-h-9 rounded-full px-4 text-[15px]">Medir recorrido</Link>
        <a href={`/api/panel/csv?dias=${dias}`} className="boton boton-tenue min-h-9 rounded-full px-4 text-[15px]">Descargar Excel</a>
        <BotonImprimir />
      </div>

      {/* Números clave */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tarjeta titulo="Reportes en el periodo" valor={num(r.total)}
          nota={cambio === null ? `${num(r.total_historico)} desde el inicio` : `${cambio >= 0 ? "▲" : "▼"} ${Math.abs(cambio)}% vs. ${dias} días anteriores`} />
        <Tarjeta titulo="Colonias afectadas ahora" valor={num(r.colonias_afectadas_ahora)} nota="Mayoría sin agua, baja presión o sucia (24 h)" />
        <Tarjeta titulo="Problemas abiertos" valor={num(r.activos)} nota="Baches, drenaje, alumbrado, banquetas y baldíos" />
        <Tarjeta titulo="Arreglados en el periodo" valor={num(r.arreglados)}
          nota={r.dias_promedio_arreglo !== null ? `Tardaron ${r.dias_promedio_arreglo} días en promedio` : "Confirmados por 3 vecinos"} />
      </section>

      {/* Reportes por día */}
      <Seccion titulo="Reportes por día">
        <div className="relative">
          <p className="mb-1 text-xs text-ios-secundario">Máximo: {num(maxDia)} en un día</p>
          <div className="flex h-40 items-end gap-[2px] border-b border-ios-separador" role="img"
            aria-label={`Reportes por día en los últimos ${dias} días, máximo ${maxDia}`}>
            {r.por_dia.map((d) => (
              <div key={d.dia} className="group relative flex h-full flex-1 items-end">
                <div className="w-full rounded-t bg-ios-azul group-hover:opacity-80"
                  style={{ height: `${(d.n / maxDia) * 100}%`, minHeight: d.n > 0 ? 2 : 0 }} />
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block">
                  {fechaCorta(d.dia)}: {num(d.n)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs text-ios-secundario">
            <span>{fechaCorta(r.por_dia[0].dia)}</span>
            <span>{fechaCorta(r.por_dia[Math.floor(r.por_dia.length / 2)].dia)}</span>
            <span>{fechaCorta(r.por_dia[r.por_dia.length - 1].dia)}</span>
          </div>
        </div>
      </Seccion>

      <div className="grid gap-x-8 sm:grid-cols-2">
        <Seccion titulo="Reportes por tipo">
          <Barras filas={r.por_tipo.map((t) => ({
            etiqueta: nombreTipo(t.tipo), valor: t.n,
            extra: t.tipo !== "agua" && t.arreglados > 0 ? `${num(t.arreglados)} ${t.arreglados === 1 ? "arreglado" : "arreglados"}` : undefined,
          }))} />
        </Seccion>

        <Seccion titulo="Agua: lo que reportan los vecinos">
          {totalAgua === 0 ? <Vacio /> : (
            <Barras filas={ESTADOS_AGUA.map((e) => ({
              etiqueta: ETIQUETAS[e], muestra: COLOR_ESTADO[e], valor: r.agua_por_estado[e] ?? 0,
              extra: `${Math.round(((r.agua_por_estado[e] ?? 0) / totalAgua) * 100)}%`,
            }))} />
          )}
        </Seccion>
      </div>

      <Seccion titulo="Problemas más reportados">
        <Barras filas={r.por_detalle.map((d) => ({
          etiqueta: `${INFO_PIN[d.tipo]?.emoji ?? ""} ${d.tipo === "bache" ? `Bache ${ETIQUETAS[d.detalle]?.toLowerCase()}` : ETIQUETAS[d.detalle] ?? d.detalle}`,
          valor: d.n,
        }))} />
      </Seccion>

      <Seccion titulo="Colonias con más reportes">
        {r.top_colonias.length === 0 ? <Vacio /> : (
          <Tabla encabezados={["Colonia", "Total", "Agua", "Sin agua", "Otros"]} numericas={[1, 2, 3, 4]}
            filas={r.top_colonias.map((c) => [c.colonia, num(c.total), num(c.agua), num(c.sin_agua), num(c.otros)])} />
        )}
      </Seccion>

      <Seccion titulo="Pendientes más urgentes" nota="Primero los peligrosos; luego los más confirmados por vecinos.">
        {r.urgentes.length === 0 ? <Vacio /> : (
          <Tabla encabezados={["Problema", "Colonia", "+1", "Desde", "Mapa"]} numericas={[2]}
            filas={r.urgentes.map((u) => [
              `${u.peligroso ? "⚠️ " : ""}${INFO_PIN[u.tipo]?.nombre ?? u.tipo}: ${ETIQUETAS[u.subtipo] ?? u.subtipo}`,
              u.colonia,
              num(u.confirmaciones),
              new Date(u.creado_en).toLocaleDateString("es-MX", { timeZone: "America/Hermosillo", day: "numeric", month: "short" }),
              <a key={u.id} className="text-ios-azul" href={`https://www.google.com/maps?q=${u.lat},${u.lng}`} target="_blank" rel="noreferrer">Ver</a>,
            ])} />
        )}
      </Seccion>

      <Seccion titulo="Moderación" className="print:hidden">
        <p className="text-sm text-ios-etiqueta">
          {num(r.moderacion.comentarios_ocultos)} comentarios y {num(r.moderacion.fotos_ocultas)} fotos ocultos por denuncias ·{" "}
          <strong>{num(r.moderacion.en_revision)}</strong> con 1 o 2 denuncias (revísalos con la consulta "Moderar" del README).
        </p>
      </Seccion>

      <p className="mt-10 px-4 text-xs text-ios-secundario">
        Datos de percepción ciudadana reportados de forma anónima en Reporta Cajeme. No son cifras oficiales ni análisis de
        laboratorio. Proyecto ciudadano sin afiliación al gobierno.
      </p>
    </Pagina>
  );
}
