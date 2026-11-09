import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { leerMontoUsd, MONTOS_USD, PaginaDolaresAPesos, tituloUsd } from "@/components/DolaresAPesos";

type Props = { params: Promise<{ monto: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const usd = leerMontoUsd((await params).monto);
  if (!usd) return { title: "No encontrado", robots: { index: false } };
  return {
    title: tituloUsd(usd, "mes"),
    description: `${usd.toLocaleString("es-MX")} dólares al mes en pesos mexicanos, al tipo de cambio de hoy: al mes, al año y por hora, y home office que paga eso aceptando gente de México.`,
    alternates: { canonical: `/herramientas/dolares-a-pesos/${usd}` },
  };
}

export default async function DolaresMonto({ params }: Props) {
  const usd = leerMontoUsd((await params).monto);
  if (!usd || !(MONTOS_USD as readonly number[]).includes(usd)) notFound();
  return <PaginaDolaresAPesos usd={usd} por="mes" />;
}
