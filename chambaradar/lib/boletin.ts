// Boletín semanal "5 vacantes remotas en dólares": arma el correo. Funciones
// puras (sin red ni base) para poder probarlas en tests/.

import { escaparHtml, type Correo } from "./alertas.ts";
import { sueldoGrande } from "./landing.ts";
import type { Vacante } from "./tipos.ts";

export interface Suscriptor {
  id: number;
  correo: string;
  token: string;
  pais?: string | null;
}

export type VacanteBoletin = Omit<Vacante, "descripcion" | "vista">;

export interface OpcionesBoletin {
  sitio: string;
  responsable: string;
  /** Pesos por dólar, para el "≈ $22,000 MXN" */
  tasaUsd: number;
  /** "$49" */
  precioSemana: string;
  /** Cuántas remotas para México hay hoy en el sitio (para el cierre) */
  totalRemotas?: number;
}

/** Arma el correo semanal. Los textos de las vacantes vienen de terceros: todo se escapa. */
export function correoDeBoletin(s: Suscriptor, vacantes: VacanteBoletin[], o: OpcionesBoletin): Correo {
  const baja = `${o.sitio}/boletin/baja?t=${encodeURIComponent(s.token)}`;
  const bajaUnClic = `${o.sitio}/api/boletin/baja?t=${encodeURIComponent(s.token)}`;
  const landing = `${o.sitio}/remoto-dolares?utm_source=boletin&utm_campaign=semanal`;
  const n = vacantes.length;
  const asunto = n > 0 ? `${n} vacantes remotas en dólares de esta semana (con empresa y enlace)` : "Esta semana no hubo vacantes nuevas en dólares";

  const filas = vacantes
    .map((v) => {
      const g = sueldoGrande(v, o.tasaUsd);
      const sueldo = g ? `${escaparHtml(g.principal)}${g.pesos ? ` <span style="color:#64748b;font-weight:400">${escaparHtml(g.pesos)}</span>` : ""}` : "";
      return `<tr><td style="padding:16px 0;border-bottom:1px solid #e2e8f0">
<a href="${escaparHtml(v.url)}" style="color:#0f172a;font-weight:700;font-size:17px;text-decoration:none">${escaparHtml(v.titulo)}</a>
<div style="color:#334155;font-size:15px;margin-top:3px">${escaparHtml(v.empresa_nombre)}</div>
${sueldo ? `<div style="color:#b45309;font-weight:700;font-size:15px;margin-top:4px">${sueldo}</div>` : ""}
<div style="color:#64748b;font-size:13px;margin-top:3px">${escaparHtml(v.ubicacion)}${v.idioma !== "es" ? " · en inglés" : ""}</div>
<a href="${escaparHtml(v.url)}" style="display:inline-block;margin-top:8px;background:#0f172a;color:#ffffff;font-weight:700;font-size:13px;padding:8px 14px;border-radius:999px;text-decoration:none">Aplicar en la página de la empresa →</a>
</td></tr>`;
    })
    .join("\n");

  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;padding:28px">
<tr><td>
<p style="margin:0;font-size:20px;font-weight:800;color:#0f172a">Chamba<span style="color:#2563eb">Radar</span></p>
<h1 style="margin:18px 0 4px;font-size:22px;color:#0f172a">${n > 0 ? `Tus ${n} vacantes remotas en dólares de la semana` : "Esta semana no hubo vacantes nuevas en dólares"}</h1>
<p style="margin:0 0 8px;color:#64748b;font-size:14px">Home office que acepta gente de México, con el sueldo publicado por la empresa. Completas: empresa y enlace para aplicar directo, gratis.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${filas}</table>
<p style="margin:22px 0 0;padding:14px;background:#ecfdf5;border-radius:10px;color:#065f46;font-size:13px">Aplicas gratis en la página oficial de la empresa. Ninguna empresa seria cobra por contratarte ni pide datos bancarios antes de firmar contrato.</p>
<p style="margin:18px 0 0;color:#334155;font-size:14px">${o.totalRemotas ? `Hoy hay ${o.totalRemotas.toLocaleString("es-MX")} vacantes remotas para México en ChambaRadar. ` : ""}Con el plan de ${escaparHtml(o.precioSemana)} MXN (una semana, pago único) ves la empresa y el enlace de todas.</p>
<p style="margin:14px 0 0"><a href="${escaparHtml(landing)}" style="display:inline-block;background:#2563eb;color:#ffffff;font-weight:700;padding:12px 20px;border-radius:10px;text-decoration:none">Ver todas las remotas en dólares</a></p>
</td></tr></table>
<p style="max-width:600px;color:#94a3b8;font-size:12px;line-height:1.5;margin:16px auto 0">
Recibes este correo porque pediste las 5 vacantes remotas en dólares de cada semana en chambaradar.com. <a href="${escaparHtml(baja)}" style="color:#64748b">Darme de baja</a> ·
<a href="${o.sitio}/privacidad" style="color:#64748b">Aviso de privacidad</a><br>
ChambaRadar · ${escaparHtml(o.responsable)}</p>
</td></tr></table></body></html>`;

  const texto = [
    asunto,
    "",
    ...vacantes.map((v) => {
      const g = sueldoGrande(v, o.tasaUsd);
      return `- ${v.titulo} · ${v.empresa_nombre}\n  ${[g?.principal, g?.pesos, v.ubicacion].filter(Boolean).join(" · ")}\n  ${v.url}`;
    }),
    "",
    `Todas las remotas en dólares: ${landing}`,
    `Darme de baja: ${baja}`,
  ].join("\n");

  return { para: s.correo, asunto, html, texto, baja, bajaUnClic };
}
