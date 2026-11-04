import "server-only";
import { PAISES } from "./config";

import type { Tasas } from "./dinero";
export type { Tasas };

/** Tipos de cambio del día (se actualizan cada 12 h). Si falla, usa los de lib/config.ts. */
export async function tiposDeCambio(): Promise<Tasas> {
  const respaldo: Tasas = Object.fromEntries(PAISES.map((p) => [p.moneda, p.porUSD]));
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 43200 },
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return respaldo;
    const datos = (await r.json()) as { result?: string; rates?: Record<string, number> };
    if (datos.result !== "success" || !datos.rates) return respaldo;
    const tasas: Tasas = { ...respaldo };
    for (const moneda of Object.keys(respaldo)) {
      const v = datos.rates[moneda];
      if (typeof v === "number" && v > 0) tasas[moneda] = v;
    }
    return tasas;
  } catch {
    return respaldo;
  }
}
