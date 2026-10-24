import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgeDias } from "@/components/BadgeDias";
import { Barras, Seccion, Tabla, Tarjeta, Vacio, num } from "@/components/graficas";
import { DEPENDENCIAS, INFO_PIN, tituloReporte, type TipoPin } from "@/lib/constantes";
import type { Pin } from "@/lib/datos";
import { sesionPanelValida } from "@/lib/panel";
import { SUPUESTOS, estimar, type Estimacion, type GrupoMedido } from "@/lib/economia";
import { COLOR_CLASE, UMBRALES } from "@/lib/rugosidad";
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
  // Secciones electorales con más reportes en 30 días (vacío si aún no se importan)
  const { data: secciones } = await supabaseServidor()
    .rpc("conteo_secciones", { p_dias: 30 })
    .gt("total", 0)
    .order("total", { ascending: false })
    .limit(15);
  const { data: rugosidad } = await supabaseServidor().rpc("resumen_rugosidad", {
    p_regular: UMBRALES.regular,
    p_mala: UMBRALES.mala,
  });
  const { data: distribucion } = await supabaseServidor().rpc("rugosidad_distribucion");
  const estimacion = estimar(((distribucion as GrupoMedido[] | null) ?? []).map((g) => ({ ...g, m: Number(g.m) })));

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
        <Contenido e={e} secciones={(secciones as FilaSeccion[] | null) ?? null} />
      )}

      <Recorridos r={(rugosidad as ResumenRugosidad | null) ?? null} />
      <Economia e={estimacion} />

      <p className="mt-10 border-t border-gray-200 pt-4 text-xs text-gray-500">
        Datos de percepción ciudadana reportados de forma anónima. “Resuelto” significa que 3 vecinos confirmaron que ya
        lo arreglaron; no son cifras oficiales. La dependencia responsable es una guía aproximada.
      </p>
    </main>
  );
}

type FilaSeccion = { seccion: number; distrito_local: number | null; total: number; puntos: number; agua: number };

function Contenido({ e, secciones }: { e: Estadisticas; secciones: FilaSeccion[] | null }) {
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
                  {num(e.colonias_agua_afectadas)} colonias afectadas ahora (7 días).
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

      <Seccion
        titulo="🗳️ Secciones electorales con más reportes"
        nota="Últimos 30 días. El agua se asigna por el centro de la colonia (aproximado)."
      >
        {!secciones || secciones.length === 0 ? (
          <Vacio texto="Sin datos: aún no se importan las secciones o no hay reportes en ellas." />
        ) : (
          <Tabla
            encabezados={["Sección", "Distrito local", "Total", "Con ubicación", "Agua"]}
            numericas={[1, 2, 3, 4]}
            filas={secciones.map((s) => [
              <strong key={s.seccion}>{s.seccion}</strong>,
              s.distrito_local ?? "—",
              num(s.total),
              num(s.puntos),
              num(s.agua),
            ])}
          />
        )}
      </Seccion>

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

type ResumenRugosidad = {
  km: number;
  sesiones: number;
  dias: number;
  km_buena: number;
  km_regular: number;
  km_mala: number;
  golpes: number;
  con_calibracion: number;
  pruebas: { nota: string; fecha: string; tramos: number; km: number; rms: number; vel_kmh: number; vel_sd: number | null }[];
};

/** Lo medido con /medir: cuánto, en qué estado y los recorridos de prueba para calibrar */
function Recorridos({ r }: { r: ResumenRugosidad | null }) {
  return (
    <Seccion
      titulo="🚗 Recorridos medidos"
      nota="Escala provisional en m/s² (aún no es IRI). El CSV trae todos los tramos con los datos para calibrar."
    >
      {!r || r.km === 0 ? (
        <Vacio texto="Aún no hay recorridos medidos." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tarjeta titulo="Medido" valor={`${num(r.km)} km`} nota={`${num(r.sesiones)} recorridos en ${num(r.dias)} días`} />
            <Tarjeta titulo="Buena" valor={`${num(r.km_buena)} km`} nota={`Menos de ${UMBRALES.regular.toFixed(1)} m/s²`} />
            <Tarjeta titulo="Regular" valor={`${num(r.km_regular)} km`} nota={`${UMBRALES.regular.toFixed(1)}–${UMBRALES.mala.toFixed(1)} m/s²`} />
            <Tarjeta titulo="Mala" valor={`${num(r.km_mala)} km`} nota={`${num(r.golpes)} golpes fuertes en total`} />
          </div>
          <div className="mt-3 flex h-3 overflow-hidden rounded-full" role="img" aria-label="Kilómetros por estado">
            {(["buena", "regular", "mala"] as const).map((c) => (
              <div key={c} style={{ width: `${(r[`km_${c}`] / r.km) * 100}%`, background: COLOR_CLASE[c] }} />
            ))}
          </div>
          {r.pruebas.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-bold">🧪 Recorridos de prueba</h3>
              <Tabla
                encabezados={["Nota", "Fecha", "km", "Rugosidad", "Vel. km/h", "± km/h"]}
                numericas={[2, 3, 4, 5]}
                filas={r.pruebas.map((p, i) => [
                  <span key={i}>{p.nota}</span>,
                  p.fecha,
                  num(p.km),
                  p.rms.toFixed(2),
                  num(p.vel_kmh),
                  p.vel_sd === null ? "—" : String(p.vel_sd),
                ])}
              />
            </div>
          )}
        </>
      )}
      <a href="/api/equipo/rugosidad/csv" className="mt-4 inline-block rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold">
        ⬇️ Descargar tramos (CSV)
      </a>
    </Seccion>
  );
}

const pesos = (n: number) => `$${num(Math.round(n))}`;
const millones = (n: number) => `$${num(Math.round(n / 1e6))} millones`;

/** Costo de las calles en mal estado para los vehículos de Cajeme (PRELIMINAR, ver lib/economia.ts) */
function Economia({ e }: { e: Estimacion | null }) {
  const s = SUPUESTOS;
  const r = (x: { bajo: number; medio: number; alto: number }, f = (n: number) => num(n)) => `${f(x.bajo)} – ${f(x.alto)}`;
  return (
    <Seccion
      titulo="💸 Impacto económico (preliminar)"
      nota="Estimación con supuestos de la literatura (HDM-4 del Banco Mundial, NCHRP 720). La conversión a IRI aún no está calibrada: no publicar como cifra definitiva."
    >
      {!e ? (
        <Vacio texto="Se calcula cuando haya recorridos medidos (sin contar los de prueba)." />
      ) : (
        <>
          <div className="rounded-xl bg-amber-50 p-4">
            <p className="text-sm text-amber-900">Costo extra al año para los {num(s.vehiculos)} vehículos de Cajeme</p>
            <p className="text-3xl font-extrabold tabular-nums">{millones(e.porEscenario.medio.totalAnio)}</p>
            <p className="text-sm text-amber-900">
              Rango: {millones(e.porEscenario.bajo.totalAnio)} a {millones(e.porEscenario.alto.totalAnio)}
            </p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tarjeta
              titulo="Por vehículo al año"
              valor={pesos(e.porEscenario.medio.porVehiculoAnio)}
              nota={`${pesos(e.porEscenario.bajo.porVehiculoAnio)} a ${pesos(e.porEscenario.alto.porVehiculoAnio)}`}
            />
            <Tarjeta titulo="Por km manejado" valor={`$${e.porEscenario.medio.porKm.toFixed(2)}`} nota="Costo extra promedio" />
            <Tarjeta titulo="IRI promedio estimado" valor={`${e.iriPromedio.toFixed(1)} m/km`} nota={`DGST: bueno < ${s.iriAceptable}`} />
            <Tarjeta titulo="Base del cálculo" valor={`${num(Math.round(e.km))} km`} nota="Medidos (sin pruebas ni motos)" />
          </div>

          <div className="mt-4 grid gap-x-8 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-bold">¿En qué se va el dinero? (pesos por vehículo al año)</h3>
              <Barras
                colorBarra="#b45309"
                filas={(
                  [
                    ["Reparaciones y suspensión", e.porEscenario.medio.desglose.reparaciones],
                    ["Gasolina", e.porEscenario.medio.desglose.gasolina],
                    ["Llantas", e.porEscenario.medio.desglose.llantas],
                  ] as const
                ).map(([etiqueta, porKm]) => ({
                  etiqueta,
                  valor: Math.round(porKm * s.kmAnioPorVehiculo.medio),
                }))}
              />
            </div>
            <div>
              <h3 className="text-sm font-bold">Km medidos según la escala de la DGST (IRI estimado)</h3>
              <Barras
                filas={[
                  { etiqueta: `Bueno (< ${s.iriAceptable})`, muestra: COLOR_CLASE.buena, valor: Math.round(e.kmPorClase.bueno * 10) / 10 },
                  {
                    etiqueta: `Aceptable (${s.iriAceptable}–${s.iriNoSatisfactorio})`,
                    muestra: COLOR_CLASE.regular,
                    valor: Math.round(e.kmPorClase.aceptable * 10) / 10,
                  },
                  {
                    etiqueta: `No satisfactorio (> ${s.iriNoSatisfactorio})`,
                    muestra: COLOR_CLASE.mala,
                    valor: Math.round(e.kmPorClase.noSatisfactorio * 10) / 10,
                  },
                ]}
              />
            </div>
          </div>

          <details className="mt-4 rounded-xl border border-gray-200 p-3 text-sm">
            <summary className="cursor-pointer font-semibold">Supuestos (se reemplazan cuando haya datos reales)</summary>
            <Tabla
              encabezados={["Supuesto", "Rango (bajo – alto)", "Se reemplaza con"]}
              filas={[
                ["IRI por cada m/s² medido (a 40 km/h)", r(s.iriPorRms, (n) => n.toFixed(1)), "IRI de la SICT en tramos que recorramos"],
                ["Km al año por vehículo en Cajeme", r(s.kmAnioPorVehiculo), "Encuesta o dato de movilidad"],
                ["Gasolina normal por km", r(s.gasolinaPorKm, (n) => `$${n.toFixed(2)}`), "Precio local y rendimiento promedio"],
                ["Reparaciones normales por km", r(s.reparacionesPorKm, (n) => `$${n.toFixed(2)}`), "Talleres locales"],
                ["Llantas normales por km", r(s.llantasPorKm, (n) => `$${n.toFixed(2)}`), "Precio y duración de llantas"],
                ["Gasolina extra por punto de IRI", r(s.gasolinaPctPorIri, (n) => `${n}%`), "HDM-4"],
                ["Llantas extra por punto de IRI", r(s.llantasPctPorIri, (n) => `${n}%`), "HDM-4"],
                ["Reparaciones extra", "+10% en IRI 4, +40% en IRI 5", "NCHRP 720"],
                ["Vehículos", num(s.vehiculos), "Padrón vehicular de Sonora"],
              ]}
            />
            <p className="mt-2 text-xs text-gray-500">
              Supone que los km medidos representan por dónde circula la gente (los recorridos son de choferes y
              repartidores en su día normal). Sin calles en buen estado (IRI ≤ {s.iriBase}) no hay costo extra.
            </p>
          </details>
        </>
      )}
    </Seccion>
  );
}
