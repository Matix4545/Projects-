import type { Metadata } from "next";
import { leerMontoUsd, PaginaDolaresAPesos, tituloUsd, type PeriodoUsd } from "@/components/DolaresAPesos";

type Props = { searchParams: Promise<Record<string, string | undefined>> };

const periodoDe = (p: string | undefined): PeriodoUsd => (p === "hora" || p === "ano" ? p : "mes");

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const p = await searchParams;
  const usd = leerMontoUsd(p.usd) || 2000;
  const por = periodoDe(p.por);
  return {
    title: tituloUsd(usd, por),
    description: "Convierte un sueldo en dólares a pesos mexicanos al mes, al año y por hora, con el tipo de cambio de hoy, y mira home office que paga eso.",
    alternates: { canonical: por === "mes" && (!p.usd || usd === 2000) ? "/herramientas/dolares-a-pesos" : undefined },
    robots: p.usd || p.por ? { index: false, follow: true } : undefined,
  };
}

export default async function DolaresAPesos({ searchParams }: Props) {
  const p = await searchParams;
  return <PaginaDolaresAPesos usd={leerMontoUsd(p.usd) || 2000} por={periodoDe(p.por)} />;
}
