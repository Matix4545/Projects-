// Alertas por correo: describir filtros, armar enlaces y el correo.
// Funciones puras (sin red ni base de datos) para poder probarlas en tests/.

import { formatoSueldo } from "./formato.ts";
import { NOMBRE_CATEGORIA, NOMBRE_NIVEL, PAISES, type Categoria, type Nivel, type Periodo } from "./tipos.ts";

/** Filtros que se guardan en una alerta (los mismos del buscador, sin página ni fecha). */
export interface FiltrosAlerta {
  q?: string;
  categoria?: string;
  pais?: string;
  modalidad?: string;
  nivel?: string;
  tipo?: string;
  conSueldo?: boolean;
}

export interface VacanteDeAlerta {
  titulo: string;
  empresa: string | null;
  url: string | null;
  ubicacion: string;
  modalidad: string;
  sueldo_min: number | null;
  sueldo_max: number | null;
  moneda: string | null;
  periodo: Periodo | null;
}

/** Una alerta con vacantes nuevas, como la devuelve alertas_por_enviar(). */
export interface AlertaPorEnviar {
  id: string;
  email: string;
  token: string;
  filtros: FiltrosAlerta;
  acceso: boolean;
  total: number;
  vacantes: VacanteDeAlerta[];
}

const MODALIDAD: Record<string, string> = { remoto: "remoto", hibrido: "híbrido", presencial: "presencial" };

/** "Software e ingeniería · remoto · México · que diga «react»" */
export function describirFiltros(f: FiltrosAlerta): string {
  const partes: string[] = [];
  if (f.categoria) partes.push(NOMBRE_CATEGORIA[f.categoria as Categoria] ?? f.categoria);
  if (f.nivel) partes.push(NOMBRE_NIVEL[f.nivel as Nivel] ?? f.nivel);
  if (f.modalidad) partes.push(MODALIDAD[f.modalidad] ?? f.modalidad);
  if (f.pais) partes.push(PAISES[f.pais] ?? f.pais);
  if (f.tipo === "local") partes.push("empresas de LATAM");
  if (f.tipo === "remoto") partes.push("empresas extranjeras");
  if (f.conSueldo) partes.push("con sueldo publicado");
  if (f.q) partes.push(`puesto: «${f.q}»`);
  return partes.length ? partes.join(" · ") : "Todas las vacantes";
}

/** Enlace al buscador con los filtros de la alerta. */
export function enlaceBusqueda(sitio: string, f: FiltrosAlerta): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  for (const k of ["tipo", "pais", "modalidad", "categoria", "nivel"] as const) if (f[k]) p.set(k, f[k]!);
  if (f.conSueldo) p.set("sueldo", "1");
  const s = p.toString();
  return `${sitio}/vacantes${s ? `?${s}` : ""}`;
}

/** Convierte los filtros del buscador a filtros de alerta (descarta vacíos). */
export function filtrosParaAlerta(f: { q: string; categoria: string; pais: string; modalidad: string; nivel: string; tipo: string; conSueldo: boolean }): FiltrosAlerta {
  const r: FiltrosAlerta = {};
  if (f.q) r.q = f.q;
  if (f.categoria) r.categoria = f.categoria;
  if (f.pais) r.pais = f.pais;
  if (f.modalidad) r.modalidad = f.modalidad;
  if (f.nivel) r.nivel = f.nivel;
  if (f.tipo) r.tipo = f.tipo;
  if (f.conSueldo) r.conSueldo = true;
  return r;
}

export function escaparHtml(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export interface Correo {
  para: string;
  asunto: string;
  html: string;
  texto: string;
  /** Página para darse de baja (enlace dentro del correo) */
  baja: string;
  /** Baja con un clic desde Gmail/Outlook (encabezado List-Unsubscribe, recibe POST) */
  bajaUnClic: string;
}

/** Arma el correo diario de una alerta. Los textos de las vacantes vienen de terceros: todo se escapa. */
export function correoDeAlerta(a: AlertaPorEnviar, o: { sitio: string; responsable: string; pagosActivos: boolean }): Correo {
  const descripcion = describirFiltros(a.filtros);
  const busqueda = enlaceBusqueda(o.sitio, a.filtros);
  const baja = `${o.sitio}/alertas/baja?t=${encodeURIComponent(a.token)}`;
  const bajaUnClic = `${o.sitio}/api/alertas/baja?t=${encodeURIComponent(a.token)}`;
  const n = a.total;
  const asunto = `${n} ${n === 1 ? "vacante nueva" : "vacantes nuevas"}: ${descripcion}`.slice(0, 140);
  const restantes = n - a.vacantes.length;

  const filas = a.vacantes
    .map((v) => {
      const sueldo = formatoSueldo(v.sueldo_min, v.sueldo_max, v.moneda, v.periodo);
      const detalle = [v.ubicacion, MODALIDAD[v.modalidad] ?? v.modalidad, sueldo].filter(Boolean).map((x) => escaparHtml(String(x))).join(" · ");
      const enlace = a.acceso && v.url ? v.url : busqueda;
      const empresa = a.acceso && v.empresa ? escaparHtml(v.empresa) : '<span style="color:#94a3b8">Empresa oculta 🔒</span>';
      return `<tr><td style="padding:14px 0;border-bottom:1px solid #e2e8f0">
<a href="${escaparHtml(enlace)}" style="color:#0f172a;font-weight:600;font-size:16px;text-decoration:none">${escaparHtml(v.titulo)}</a>
<div style="color:#334155;font-size:14px;margin-top:2px">${empresa}</div>
<div style="color:#64748b;font-size:13px;margin-top:2px">${detalle}</div>
</td></tr>`;
    })
    .join("\n");

  const invitacion =
    !a.acceso && o.pagosActivos
      ? `<p style="margin:20px 0 0;padding:14px;background:#d1fae5;border-radius:10px;color:#065f46;font-size:14px">Con un plan desde $49 MXN ves qué empresa es y el enlace para aplicar directo. <a href="${o.sitio}/precios" style="color:#065f46;font-weight:700">Ver planes</a></p>`
      : "";

  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;padding:28px">
<tr><td>
<p style="margin:0;font-size:20px;font-weight:800;color:#0f172a">Chamba<span style="color:#10b981">Radar</span></p>
<h1 style="margin:18px 0 4px;font-size:22px;color:#0f172a">${n} ${n === 1 ? "vacante nueva" : "vacantes nuevas"} para ti</h1>
<p style="margin:0 0 8px;color:#64748b;font-size:14px">Tu alerta: ${escaparHtml(descripcion)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${filas}</table>
${restantes > 0 ? `<p style="color:#64748b;font-size:14px">…y ${restantes} más.</p>` : ""}
<p style="margin:22px 0 0"><a href="${escaparHtml(busqueda)}" style="display:inline-block;background:#10b981;color:#ffffff;font-weight:700;padding:12px 20px;border-radius:10px;text-decoration:none">Ver todas en ChambaRadar</a></p>
${invitacion}
</td></tr></table>
<p style="max-width:600px;color:#94a3b8;font-size:12px;line-height:1.5;margin:16px auto 0">
Recibes este correo porque creaste esta alerta en ChambaRadar. <a href="${escaparHtml(baja)}" style="color:#64748b">Dejar de recibir esta alerta</a> ·
<a href="${o.sitio}/cuenta" style="color:#64748b">Administrar alertas</a> · <a href="${o.sitio}/privacidad" style="color:#64748b">Aviso de privacidad</a><br>
ChambaRadar · ${escaparHtml(o.responsable)}</p>
</td></tr></table></body></html>`;

  const texto = [
    `${n} ${n === 1 ? "vacante nueva" : "vacantes nuevas"} · ${descripcion}`,
    "",
    ...a.vacantes.map((v) => {
      const sueldo = formatoSueldo(v.sueldo_min, v.sueldo_max, v.moneda, v.periodo);
      return `- ${v.titulo}${a.acceso && v.empresa ? ` · ${v.empresa}` : ""}\n  ${[v.ubicacion, sueldo].filter(Boolean).join(" · ")}${a.acceso && v.url ? `\n  ${v.url}` : ""}`;
    }),
    restantes > 0 ? `…y ${restantes} más.` : "",
    "",
    `Ver todas: ${busqueda}`,
    `Dejar de recibir esta alerta: ${baja}`,
  ].join("\n");

  return { para: a.email, asunto, html, texto, baja, bajaUnClic };
}
