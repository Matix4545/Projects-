// Datos estructurados para Google for Jobs (schema.org/JobPosting).
// Solo para vacantes que TODOS ven completas (las que publican los negocios en
// ChambaRadar). Las demás tienen empresa y enlace ocultos, y marcarlas con datos
// que el visitante no ve va contra las reglas de Google.

import type { Vacante } from "./tipos.ts";

const UNIDAD = { hora: "HOUR", dia: "DAY", semana: "WEEK", mes: "MONTH", "año": "YEAR" } as const;
const DIAS_VIGENCIA = 30;

const escaparHtml = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** "Cd. Obregón, Sonora" → { ciudad: "Cd. Obregón", estado: "Sonora" } */
export function partesUbicacion(ubicacion: string): { ciudad: string; estado: string } {
  const partes = ubicacion.split(",").map((p) => p.trim()).filter(Boolean);
  return { ciudad: partes[0] ?? "", estado: partes[1] ?? partes[0] ?? "" };
}

export function jobPosting(v: Vacante, url: string): Record<string, unknown> {
  const publicada = new Date(v.publicada);
  const vigencia = new Date(publicada.getTime() + DIAS_VIGENCIA * 86_400_000);
  const { ciudad, estado } = partesUbicacion(v.ubicacion);
  const remoto = v.modalidad === "remoto";
  const datos: Record<string, unknown> = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: v.titulo,
    description: escaparHtml(v.descripcion || v.titulo).replace(/\r?\n/g, "<br>"),
    datePosted: publicada.toISOString(),
    validThrough: vigencia.toISOString(),
    hiringOrganization: { "@type": "Organization", name: v.empresa_nombre },
    identifier: { "@type": "PropertyValue", name: "ChambaRadar", value: v.id },
    url,
    directApply: false,
  };
  if (remoto) {
    datos.jobLocationType = "TELECOMMUTE";
    datos.applicantLocationRequirements = { "@type": "Country", name: "México" };
  } else {
    datos.jobLocation = {
      "@type": "Place",
      address: { "@type": "PostalAddress", addressLocality: ciudad, addressRegion: estado, addressCountry: "MX" },
    };
  }
  if (v.sueldo_min != null || v.sueldo_max != null) {
    const valor: Record<string, unknown> = { "@type": "QuantitativeValue", unitText: UNIDAD[v.periodo as keyof typeof UNIDAD] ?? "MONTH" };
    if (v.sueldo_min != null && v.sueldo_max != null && v.sueldo_min !== v.sueldo_max) Object.assign(valor, { minValue: v.sueldo_min, maxValue: v.sueldo_max });
    else valor.value = v.sueldo_max ?? v.sueldo_min;
    datos.baseSalary = { "@type": "MonetaryAmount", currency: v.moneda ?? "MXN", value: valor };
  }
  return datos;
}

/** JSON listo para <script type="application/ld+json"> (sin "</script>" posible dentro). */
export function jsonLd(datos: unknown): string {
  return JSON.stringify(datos).replace(/</g, "\\u003c");
}
