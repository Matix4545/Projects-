import Link from "next/link";
import { numero } from "@/lib/formato";
import { pesosPor } from "@/lib/monedas";
import type { VacanteVista } from "@/lib/muro";
import { sueldoMensualMxn } from "@/lib/nomina";
import { pagosActivos } from "@/lib/planes";
import { accesoLocal, usuarioActual } from "@/lib/supabase/servidor";
import { buscarVacantes, leerFiltros } from "@/lib/vacantes";
import { Flecha } from "./Iconos";
import { TarjetaVacante, type ContextoTarjeta } from "./TarjetaVacante";

export const pesos = (n: number) => `$${numero(Math.round(n))}`;

/** Tipo de cambio del día: pesos por dólar. */
export const tipoCambioUsd = () => pesosPor("USD");

/**
 * Vacantes con sueldo publicado de al menos `minimoMxn` al mes (en pesos, convirtiendo
 * las que pagan en dólares). `remoto`: solo home office que acepta México.
 */
export async function VacantesQuePagan({ minimoMxn, remoto = false, titulo }: { minimoMxn: number; remoto?: boolean; titulo: string }) {
  const [usuario, tasa] = await Promise.all([usuarioActual(), tipoCambioUsd()]);
  const acceso = await accesoLocal(usuario);
  const base = leerFiltros(remoto ? { donde: "remoto", sueldo: "1" } : { donde: "mx", sueldo: "1" });
  const r = await buscarVacantes({ ...base, pagina: 1 }, acceso).catch(() => null);
  const segunda = r && r.total > 20 ? await buscarVacantes({ ...base, pagina: 2 }, acceso).catch(() => null) : null;
  const todas: VacanteVista[] = [...(r?.vacantes ?? []), ...(segunda?.vacantes ?? [])];
  const quePagan = todas
    .map((v) => ({ v, mes: sueldoMensualMxn(v, tasa) }))
    .filter((x): x is { v: VacanteVista; mes: number } => x.mes != null && x.mes >= minimoMxn)
    .sort((a, b) => a.mes - b.mes)
    .slice(0, 4)
    .map((x) => x.v);
  const ctx: ContextoTarjeta = { conSesion: Boolean(usuario), pagosActivos: pagosActivos(), resumen: "" };
  const enlace = remoto ? "/vacantes?donde=remoto&sueldo=1" : "/vacantes?donde=mx&sueldo=1";
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xl font-bold tracking-tight">{titulo}</h2>
        <p className="text-sm text-gris">{remoto ? "Home office que acepta gente de México" : "En México"} · con sueldo publicado · directo de las empresas</p>
      </div>
      {quePagan.length ? (
        <div className="space-y-4">
          {quePagan.map((v) => (
            <TarjetaVacante key={v.id} v={v} ctx={ctx} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-borde bg-white p-6 text-sm text-gris">Hoy no hay vacantes con ese sueldo publicado. Mira todas las que sí publican sueldo:</p>
      )}
      <Link href={enlace} className="boton-secundario">
        Ver todas las vacantes con sueldo <Flecha className="size-4" />
      </Link>
    </section>
  );
}

export function Migas({ actual }: { actual: string }) {
  return (
    <p className="text-sm text-gris">
      <Link href="/herramientas" className="font-medium text-radar-oscuro hover:underline">
        Herramientas gratis
      </Link>{" "}
      › {actual}
    </p>
  );
}

export function OtrasHerramientas({ excepto }: { excepto: string }) {
  const todas = [
    { ruta: "/herramientas/sueldo-neto", nombre: "Calculadora de sueldo neto (ISR e IMSS)" },
    { ruta: "/herramientas/dolares-a-pesos", nombre: "¿Cuánto son X dólares al mes en pesos?" },
    { ruta: "/cv", nombre: "Haz tu CV gratis (español o inglés)" },
  ].filter((h) => h.ruta !== excepto);
  return (
    <section className="rounded-2xl border border-borde bg-white p-5">
      <h2 className="font-bold">Más herramientas gratis</h2>
      <ul className="mt-2 space-y-1.5 text-sm">
        {todas.map((h) => (
          <li key={h.ruta}>
            <Link href={h.ruta} className="font-medium text-radar-oscuro hover:underline">
              {h.nombre}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
