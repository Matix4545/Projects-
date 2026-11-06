import Link from "next/link";
import { Migas, OtrasHerramientas, pesos, tipoCambioUsd, VacantesQuePagan } from "@/components/Herramientas";
import { Encabezado, Pie } from "@/components/Marco";
import { numero } from "@/lib/formato";
import { brutoParaNeto } from "@/lib/nomina";
import { usuarioActual } from "@/lib/supabase/servidor";

/** Montos con página propia (para Google): /herramientas/dolares-a-pesos/2500 */
export const MONTOS_USD = [500, 800, 1000, 1200, 1500, 2000, 2500, 3000, 3500, 4000, 5000, 6000, 8000, 10000] as const;
export type PeriodoUsd = "mes" | "hora" | "ano";

export function leerMontoUsd(valor: string | undefined): number {
  const n = Number(String(valor ?? "").replace(/[^\d.]/g, ""));
  return Math.min(1_000_000, Math.max(0, n || 0));
}

export function tituloUsd(usd: number, por: PeriodoUsd) {
  const p = por === "hora" ? "la hora" : por === "ano" ? "año" : "mes";
  return `¿Cuánto son ${pesos(usd)} USD ${por === "hora" ? "la hora" : `al ${p}`} en pesos mexicanos?`;
}

export async function PaginaDolaresAPesos({ usd, por }: { usd: number; por: PeriodoUsd }) {
  const [usuario, tasa] = await Promise.all([usuarioActual(), tipoCambioUsd()]);
  const mensualUsd = por === "hora" ? usd * 173 : por === "ano" ? usd / 12 : usd;
  const mensual = mensualUsd * tasa;
  const anual = mensual * 12;
  const hora = mensual / 173;
  const brutoEquivalente = brutoParaNeto(mensual);
  const fecha = new Date().toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Mexico_City" });

  return (
    <>
      <Encabezado usuario={usuario} />
      <main className="contenedor max-w-3xl space-y-8 py-8">
        <div className="space-y-2">
          <Migas actual="Dólares a pesos" />
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{tituloUsd(usd, por)}</h1>
          <p className="text-gris">Lo que ganarías en un trabajo remoto en dólares, al tipo de cambio de hoy.</p>
        </div>

        <form className="grid gap-3 rounded-2xl border border-borde bg-white p-5 sm:grid-cols-[1fr_auto_auto]" action="/herramientas/dolares-a-pesos">
          <label className="block">
            <span className="text-xs font-semibold text-gris">Dólares</span>
            <input name="usd" inputMode="decimal" defaultValue={usd} className="campo mt-1 py-2.5" placeholder="2500" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gris">Por</span>
            <select name="por" defaultValue={por} className="campo mt-1 py-2.5">
              <option value="mes">Mes</option>
              <option value="hora">Hora</option>
              <option value="ano">Año</option>
            </select>
          </label>
          <button className="boton self-end py-2.5">Convertir</button>
        </form>

        <section className="rounded-2xl border border-radar/40 bg-white p-5 sm:p-6">
          <p className="text-sm text-gris">Al mes en pesos</p>
          <p className="mt-1 text-4xl font-extrabold tracking-tight">{pesos(mensual)} MXN</p>
          <table className="mt-4 w-full text-sm">
            <tbody>
              {[
                ["Al año", `${pesos(anual)} MXN`],
                ["Por hora (40 h a la semana)", `${pesos(hora)} MXN`],
                ["Equivale a un sueldo bruto en México de", `≈ ${pesos(brutoEquivalente)} al mes`],
              ].map(([k, v]) => (
                <tr key={k} className="border-t border-slate-100">
                  <td className="py-1.5">{k}</td>
                  <td className="py-1.5 text-right font-semibold tabular-nums">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-gris">
            Tipo de cambio: ${tasa.toFixed(2)} MXN por USD ({fecha}). Como contratista independiente no te descuentan IMSS ni ISR: tú los declaras (RESICO o actividad
            empresarial), por eso el "sueldo bruto equivalente" en una empresa mexicana es mayor. Las transferencias suelen cobrar 1–3 %.
          </p>
        </section>

        <VacantesQuePagan minimoMxn={mensual * 0.8} remoto titulo={`Home office que paga ${numero(Math.round(mensualUsd))} USD al mes o más`} />

        <section className="rounded-2xl border border-borde bg-white p-5">
          <h2 className="font-bold">Otros montos</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {MONTOS_USD.map((m) => (
              <Link key={m} href={`/herramientas/dolares-a-pesos/${m}`} className={`chip ${m === usd && por === "mes" ? "bg-noche text-white" : "bg-white"}`}>
                ${numero(m)} USD
              </Link>
            ))}
          </div>
        </section>

        <OtrasHerramientas excepto="/herramientas/dolares-a-pesos" />
      </main>
      <Pie />
    </>
  );
}
