import type { Metadata } from "next";
import { Migas, OtrasHerramientas, pesos, VacantesQuePagan } from "@/components/Herramientas";
import { Encabezado, Pie } from "@/components/Marco";
import { brutoParaNeto, SUBSIDIO_TOPE, sueldoNeto, TARIFA_ISR_MENSUAL } from "@/lib/nomina";
import { usuarioActual } from "@/lib/supabase/servidor";

type Props = { searchParams: Promise<Record<string, string | undefined>> };

const PERIODOS = { mensual: 1, quincenal: 2, semanal: 4.33 } as const;
type Periodo = keyof typeof PERIODOS;

function leer(p: Record<string, string | undefined>) {
  const monto = Math.min(1_000_000, Math.max(0, Number(String(p.bruto ?? "").replace(/[^\d.]/g, "")) || 0));
  const periodo: Periodo = p.periodo === "quincenal" || p.periodo === "semanal" ? p.periodo : "mensual";
  const modo = p.modo === "neto" ? "neto" : "bruto";
  return { monto, periodo, modo };
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { monto, modo } = leer(await searchParams);
  const titulo = monto && modo === "bruto" ? `Sueldo neto de ${pesos(monto)} brutos al mes (2026)` : "Calculadora de sueldo neto 2026: ISR e IMSS";
  return {
    title: titulo,
    description: "Calcula cuánto te queda de tu sueldo después de ISR, subsidio al empleo e IMSS con las tablas 2026. Gratis, sin registro, y con vacantes que pagan eso.",
    alternates: { canonical: "/herramientas/sueldo-neto" },
  };
}

export default async function SueldoNeto({ searchParams }: Props) {
  const usuario = await usuarioActual();
  const { monto, periodo, modo } = leer(await searchParams);
  const factor = PERIODOS[periodo];
  const brutoMensual = monto ? (modo === "neto" ? brutoParaNeto(monto * factor) : monto * factor) : 18000;
  const n = sueldoNeto(brutoMensual);
  const porPeriodo = (x: number) => pesos(x / factor);
  const nombrePeriodo = periodo === "mensual" ? "al mes" : periodo === "quincenal" ? "a la quincena" : "a la semana";
  const ejemplos = [8000, 10000, 12000, 15000, 18000, 20000, 25000, 30000, 40000, 50000];

  return (
    <>
      <Encabezado usuario={usuario} />
      <main className="contenedor max-w-3xl space-y-8 py-8">
        <div className="space-y-2">
          <Migas actual="Sueldo neto" />
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">¿Cuánto te queda de sueldo neto?</h1>
          <p className="text-gris">Descuenta ISR, subsidio al empleo e IMSS con las tablas 2026. Gratis y sin registro.</p>
        </div>

        <form className="grid gap-3 rounded-2xl border border-borde bg-white p-5 sm:grid-cols-[1fr_auto_auto_auto]" action="/herramientas/sueldo-neto">
          <label className="block">
            <span className="text-xs font-semibold text-gris">Sueldo</span>
            <input name="bruto" inputMode="decimal" defaultValue={monto || 18000} className="campo mt-1 py-2.5" placeholder="18000" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gris">Es</span>
            <select name="modo" defaultValue={modo} className="campo mt-1 py-2.5">
              <option value="bruto">Bruto</option>
              <option value="neto">Neto (quiero saber el bruto)</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gris">Periodo</span>
            <select name="periodo" defaultValue={periodo} className="campo mt-1 py-2.5">
              <option value="mensual">Mensual</option>
              <option value="quincenal">Quincenal</option>
              <option value="semanal">Semanal</option>
            </select>
          </label>
          <button className="boton self-end py-2.5">Calcular</button>
        </form>

        <section className="rounded-2xl border border-radar/40 bg-white p-5 sm:p-6">
          <p className="text-sm text-gris">{modo === "neto" ? `Para que te queden ${porPeriodo(monto * factor)} ${nombrePeriodo} necesitas ganar` : `Te queda ${nombrePeriodo}`}</p>
          <p className="mt-1 text-4xl font-extrabold tracking-tight">{modo === "neto" ? porPeriodo(n.bruto) : porPeriodo(n.neto)}</p>
          <table className="mt-4 w-full text-sm">
            <tbody>
              {[
                ["Sueldo bruto", porPeriodo(n.bruto)],
                ["ISR (antes de subsidio)", `−${porPeriodo(n.isr + n.subsidio)}`],
                ...(n.subsidio ? [["Subsidio al empleo", `+${porPeriodo(n.subsidio)}`]] : []),
                ["IMSS (cuota del trabajador)", `−${porPeriodo(n.imss)}`],
                ["Sueldo neto", porPeriodo(n.neto)],
              ].map(([k, v], i, arr) => (
                <tr key={k} className={`border-t border-slate-100 ${i === arr.length - 1 ? "font-bold" : ""}`}>
                  <td className="py-1.5">{k}</td>
                  <td className="py-1.5 text-right tabular-nums">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-gris">
            ISR efectivo: {n.tasaEfectiva.toFixed(1)} %. Es una estimación con prestaciones de ley; tu empresa puede aplicar otros descuentos (fondo de ahorro, préstamos,
            pensión alimenticia) o darte prestaciones que cambian la base.
            {brutoMensual <= SUBSIDIO_TOPE ? " Incluye el subsidio al empleo 2026 porque tu base mensual no pasa de $11,492.66." : ""}
          </p>
        </section>

        <VacantesQuePagan minimoMxn={n.bruto} titulo={`Vacantes que pagan ${pesos(n.bruto)} o más al mes`} />

        <section className="rounded-2xl border border-borde bg-white p-5">
          <h2 className="font-bold">Tabla rápida 2026 (mensual)</h2>
          <table className="mt-2 w-full text-sm">
            <thead className="text-left text-gris">
              <tr>
                <th className="py-1 font-medium">Bruto</th>
                <th className="py-1 text-right font-medium">ISR</th>
                <th className="py-1 text-right font-medium">IMSS</th>
                <th className="py-1 text-right font-medium">Neto</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {ejemplos.map((b) => {
                const x = sueldoNeto(b);
                return (
                  <tr key={b} className="border-t border-slate-100">
                    <td className="py-1">
                      <a href={`/herramientas/sueldo-neto?bruto=${b}`} className="font-medium text-radar-oscuro hover:underline">
                        {pesos(b)}
                      </a>
                    </td>
                    <td className="py-1 text-right">{pesos(x.isr)}</td>
                    <td className="py-1 text-right">{pesos(x.imss)}</td>
                    <td className="py-1 text-right font-semibold">{pesos(x.neto)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="space-y-3 text-sm text-slate-700">
          <h2 className="text-lg font-bold">Cómo se calcula</h2>
          <p>
            <strong>ISR:</strong> con la tarifa mensual del artículo 96 de la LISR para 2026 ({TARIFA_ISR_MENSUAL.length} renglones, del 1.92 % al 35 %). Se toma la
            cuota fija del renglón más el porcentaje sobre lo que excede su límite inferior.
          </p>
          <p>
            <strong>Subsidio al empleo:</strong> si tu base mensual no pasa de $11,492.66, se resta del ISR hasta $535.65 (15.02 % de la UMA mensual 2026).
          </p>
          <p>
            <strong>IMSS:</strong> la parte que paga el trabajador: 2.375 % del salario base de cotización más 0.40 % de lo que pasa de 3 UMA diarias, con tope de 25
            UMA. El salario base incluye aguinaldo y prima vacacional de ley (factor 1.0452).
          </p>
        </section>

        <OtrasHerramientas excepto="/herramientas/sueldo-neto" />
      </main>
      <Pie />
    </>
  );
}
