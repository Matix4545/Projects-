// Lectores de las APIs públicas de cada sistema de reclutamiento (ATS).
// Todas son APIs oficiales que las empresas publican para mostrar sus
// vacantes en su propio sitio, así que no hace falta "scrapear" HTML.

import type { Empresa, Sueldo, VacanteCruda } from "../tipos.ts";
import { htmlATexto, periodoDeIntervalo, sueldoDeGreenhouse } from "../normalizar.ts";

const AGENTE = "ChambaRadarBot/0.1 (+https://chambaradar.com/bot)";

async function leerJson<T>(url: string, intentos = 3): Promise<T> {
  let ultimoError: unknown;
  for (let i = 0; i < intentos; i++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": AGENTE, accept: "application/json" }, signal: AbortSignal.timeout(30_000) });
      if (r.status === 404) throw new Error(`404 en ${url}`);
      if (r.status === 429 || r.status >= 500) throw new Error(`HTTP ${r.status} en ${url}`);
      if (!r.ok) throw new Error(`HTTP ${r.status} en ${url}`);
      return (await r.json()) as T;
    } catch (e) {
      ultimoError = e;
      if (String(e).includes("404")) break;
      await new Promise((res) => setTimeout(res, 2000 * 2 ** i));
    }
  }
  throw ultimoError;
}

// --- Greenhouse --------------------------------------------------------------
interface GhJob {
  id: number;
  title: string;
  absolute_url: string;
  location?: { name?: string };
  offices?: { name?: string; location?: string | null }[];
  departments?: { name?: string }[];
  content?: string;
  first_published?: string;
  updated_at?: string;
}

async function greenhouse(board: string): Promise<VacanteCruda[]> {
  const datos = await leerJson<{ jobs: GhJob[] }>(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs?content=true`);
  return datos.jobs.map((j) => ({
    idExterno: String(j.id),
    titulo: j.title,
    url: j.absolute_url,
    // La ubicación publicada manda; las oficinas solo se usan si no hay ubicación
    ubicaciones: j.location?.name?.trim() ? [j.location.name] : (j.offices ?? []).map((o) => o.location || o.name || ""),
    departamento: j.departments?.[0]?.name,
    descripcion: htmlATexto(j.content ?? ""),
    publicada: j.first_published ?? j.updated_at,
    sueldo: sueldoDeGreenhouse(j.content ?? ""),
  }));
}

// --- Lever -------------------------------------------------------------------
interface LeverJob {
  id: string;
  text: string;
  hostedUrl: string;
  categories?: { location?: string; allLocations?: string[]; department?: string; team?: string; commitment?: string };
  workplaceType?: string;
  descriptionPlain?: string;
  lists?: { text: string; content: string }[];
  additionalPlain?: string;
  createdAt?: number;
  salaryRange?: { min?: number; max?: number; currency?: string; interval?: string };
}

async function lever(board: string): Promise<VacanteCruda[]> {
  const datos = await leerJson<LeverJob[]>(`https://api.lever.co/v0/postings/${encodeURIComponent(board)}?mode=json`);
  return datos.map((j) => {
    const listas = (j.lists ?? []).map((l) => `${l.text}\n${htmlATexto(l.content)}`).join("\n");
    const s = j.salaryRange;
    const sueldo: Sueldo | null =
      s && (s.min || s.max) ? { min: s.min ?? null, max: s.max ?? null, moneda: s.currency ?? "USD", periodo: periodoDeIntervalo(s.interval) } : null;
    return {
      idExterno: j.id,
      titulo: j.text,
      url: j.hostedUrl,
      ubicaciones: j.categories?.allLocations?.length ? j.categories.allLocations : [j.categories?.location ?? ""],
      modalidadAts: j.workplaceType,
      departamento: j.categories?.department ?? j.categories?.team,
      tipoEmpleo: j.categories?.commitment,
      descripcion: [j.descriptionPlain ?? "", listas, j.additionalPlain ?? ""].join("\n").trim(),
      publicada: j.createdAt ? new Date(j.createdAt).toISOString() : undefined,
      sueldo,
    };
  });
}

// --- Ashby -------------------------------------------------------------------
interface AshbyJob {
  id: string;
  title: string;
  jobUrl: string;
  location?: string;
  secondaryLocations?: { location?: string }[];
  isRemote?: boolean;
  workplaceType?: string;
  department?: string;
  employmentType?: string;
  descriptionPlain?: string;
  publishedAt?: string;
  isListed?: boolean;
  compensation?: { summaryComponents?: { compensationType?: string; interval?: string; currencyCode?: string | null; minValue?: number | null; maxValue?: number | null }[] };
}

async function ashby(board: string): Promise<VacanteCruda[]> {
  const datos = await leerJson<{ jobs: AshbyJob[] }>(
    `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(board)}?includeCompensation=true`,
  );
  return datos.jobs
    .filter((j) => j.isListed !== false)
    .map((j) => {
      const c = j.compensation?.summaryComponents?.find((x) => x.compensationType === "Salary" && (x.minValue || x.maxValue));
      return {
        idExterno: j.id,
        titulo: j.title,
        url: j.jobUrl,
        ubicaciones: [j.location ?? "", ...(j.secondaryLocations ?? []).map((l) => l.location ?? "")],
        modalidadAts: j.workplaceType ?? (j.isRemote ? "remote" : undefined),
        departamento: j.department,
        tipoEmpleo: j.employmentType,
        descripcion: j.descriptionPlain ?? "",
        publicada: j.publishedAt,
        sueldo: c ? { min: c.minValue ?? null, max: c.maxValue ?? null, moneda: c.currencyCode ?? "USD", periodo: periodoDeIntervalo(c.interval) } : null,
      };
    });
}

// --- Workable ----------------------------------------------------------------
interface WorkableJob {
  shortcode: string;
  title: string;
  url?: string;
  shortlink?: string;
  application_url?: string;
  country?: string;
  city?: string;
  state?: string;
  telecommuting?: boolean;
  department?: string;
  employment_type?: string;
  description?: string;
  published_on?: string;
  created_at?: string;
  locations?: { country?: string; city?: string }[];
}

async function workable(board: string): Promise<VacanteCruda[]> {
  const datos = await leerJson<{ jobs: WorkableJob[] }>(`https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(board)}?details=true`);
  return datos.jobs.map((j) => ({
    idExterno: j.shortcode,
    titulo: j.title,
    url: j.url || j.shortlink || `https://apply.workable.com/${board}/j/${j.shortcode}/`,
    ubicaciones: (j.locations?.length ? j.locations : [{ country: j.country, city: j.city }]).map((l) => [l.city, l.country].filter(Boolean).join(", ")),
    modalidadAts: j.telecommuting ? "remote" : undefined,
    departamento: j.department,
    tipoEmpleo: j.employment_type,
    descripcion: htmlATexto(j.description ?? ""),
    publicada: j.published_on ?? j.created_at,
    sueldo: null,
  }));
}

// --- SmartRecruiters ---------------------------------------------------------
// Empresas grandes publican miles de vacantes en el mundo; pedimos solo las de
// países de LATAM (la API filtra por país) y las remotas sin país.
interface SrJob {
  id: string;
  name: string;
  releasedDate?: string;
  location?: { city?: string; country?: string; remote?: boolean; hybrid?: boolean; fullLocation?: string };
  function?: { label?: string };
  department?: { label?: string };
  typeOfEmployment?: { label?: string };
  experienceLevel?: { label?: string };
}

const PAISES_SR = ["mx", "br", "ar", "co", "cl", "pe", "cr", "uy", "ec", "gt", "do", "pa"];

async function smartrecruiters(board: string): Promise<VacanteCruda[]> {
  const todas: SrJob[] = [];
  for (const pais of PAISES_SR) {
    for (let offset = 0; offset < 1000; offset += 100) {
      const d = await leerJson<{ totalFound: number; content: SrJob[] }>(
        `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(board)}/postings?limit=100&offset=${offset}&country=${pais}`,
      );
      todas.push(...d.content);
      if (offset + 100 >= d.totalFound) break;
    }
  }
  return todas.map((j) => ({
    idExterno: j.id,
    titulo: j.name,
    url: `https://jobs.smartrecruiters.com/${board}/${j.id}`,
    ubicaciones: [j.location?.fullLocation ?? [j.location?.city, j.location?.country].filter(Boolean).join(", ")],
    modalidadAts: j.location?.remote ? "remote" : j.location?.hybrid ? "hybrid" : undefined,
    departamento: j.function?.label ?? j.department?.label,
    // Solo el nivel de entrada o prácticas dice algo útil; "Mid-Senior Level" no es "senior"
    tipoEmpleo: [j.typeOfEmployment?.label, /intern|entry/i.test(j.experienceLevel?.label ?? "") ? j.experienceLevel?.label : ""].filter(Boolean).join(" "),
    // La lista no trae descripción (habría que pedir cada vacante); se muestra al abrir el enlace
    descripcion: "",
    publicada: j.releasedDate,
    sueldo: null,
  }));
}

// --- Recruitee ---------------------------------------------------------------
interface RecruiteeJob {
  id: number;
  title: string;
  careers_url: string;
  location?: string;
  country?: string;
  city?: string;
  remote?: boolean;
  hybrid?: boolean;
  locations?: { name?: string; city?: string; country?: string }[];
  department?: string;
  employment_type_code?: string;
  description?: string;
  requirements?: string;
  published_at?: string;
  salary?: { min?: string | number | null; max?: string | number | null; currency?: string | null; period?: string | null };
}

async function recruitee(board: string): Promise<VacanteCruda[]> {
  const d = await leerJson<{ offers: RecruiteeJob[] }>(`https://${encodeURIComponent(board)}.recruitee.com/api/offers/`);
  return d.offers.map((j) => {
    const min = j.salary?.min != null ? Number(j.salary.min) : null;
    const max = j.salary?.max != null ? Number(j.salary.max) : null;
    return {
      idExterno: String(j.id),
      titulo: j.title,
      url: j.careers_url,
      ubicaciones: j.locations?.length
        ? j.locations.map((l) => [l.city || l.name, l.country].filter(Boolean).join(", "))
        : [j.location || [j.city, j.country].filter(Boolean).join(", ")],
      modalidadAts: j.remote ? "remote" : j.hybrid ? "hybrid" : undefined,
      departamento: j.department,
      tipoEmpleo: j.employment_type_code,
      descripcion: htmlATexto(`${j.description ?? ""}${j.requirements ?? ""}`),
      publicada: j.published_at?.replace(" UTC", "Z").replace(" ", "T"),
      sueldo:
        j.salary?.currency && (min || max)
          ? { min: min || null, max: max || null, moneda: j.salary.currency, periodo: periodoDeIntervalo(j.salary.period) }
          : null,
    };
  });
}

// --- BambooHR ----------------------------------------------------------------
// Muy usado por fintechs mexicanas (Bitso, Konfío, Klar, albo…). La lista no
// trae descripción; se pide el detalle de cada vacante (suelen ser pocas).
interface BambooJob {
  id: string;
  jobOpeningName: string;
  departmentLabel?: string;
  employmentStatusLabel?: string;
  location?: { city?: string | null; state?: string | null };
  atsLocation?: { country?: string | null; state?: string | null; city?: string | null };
  isRemote?: boolean | null;
  locationType?: string; // "1" presencial, "2" remoto, "3" híbrido (según BambooHR)
}

async function bamboohr(board: string): Promise<VacanteCruda[]> {
  const base = `https://${encodeURIComponent(board)}.bamboohr.com/careers`;
  const d = await leerJson<{ result: BambooJob[] }>(`${base}/list`);
  const lista = d.result ?? [];
  const detalles = await Promise.all(
    lista.slice(0, 80).map((j) =>
      leerJson<{ result?: { jobOpening?: { description?: string; datePosted?: string } } }>(`${base}/${j.id}/detail`, 1).catch(() => null),
    ),
  );
  return lista.map((j, i) => {
    const l = j.atsLocation ?? {};
    const ubicacion = [l.city ?? j.location?.city, l.state ?? j.location?.state, l.country].filter(Boolean).join(", ");
    const det = detalles[i]?.result?.jobOpening;
    return {
      idExterno: j.id,
      titulo: j.jobOpeningName,
      url: `${base}/${j.id}`,
      ubicaciones: [ubicacion],
      modalidadAts: j.isRemote || j.locationType === "2" ? "remote" : j.locationType === "3" ? "hybrid" : undefined,
      departamento: j.departmentLabel,
      tipoEmpleo: j.employmentStatusLabel,
      descripcion: htmlATexto(det?.description ?? ""),
      publicada: det?.datePosted,
      sueldo: null,
    };
  });
}

// --- Teamtailor (RSS público) --------------------------------------------------
function etiqueta(xml: string, nombre: string): string {
  const m = xml.match(new RegExp(`<${nombre}(?:\\s[^>]*)?>([\\s\\S]*?)</${nombre}>`));
  return m ? m[1].replace(/^<!\[CDATA\[|\]\]>$/g, "").trim() : "";
}

async function teamtailor(board: string): Promise<VacanteCruda[]> {
  const r = await fetch(`https://${encodeURIComponent(board)}.teamtailor.com/jobs.rss`, {
    headers: { "user-agent": AGENTE },
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} en Teamtailor ${board}`);
  const xml = await r.text();
  const items = xml.split("<item>").slice(1).map((x) => x.split("</item>")[0]);
  return items.map((it) => {
    const lugares = it.split("<tt:location>").slice(1).map((l) => [etiqueta(l, "tt:city"), etiqueta(l, "tt:country")].filter(Boolean).join(", "));
    const remoto = etiqueta(it, "remoteStatus");
    const enlace = etiqueta(it, "link");
    return {
      idExterno: etiqueta(it, "guid") || enlace,
      titulo: htmlATexto(etiqueta(it, "title")),
      url: enlace,
      ubicaciones: lugares,
      modalidadAts: remoto === "fully" ? "remote" : remoto === "hybrid" ? "hybrid" : undefined,
      departamento: etiqueta(it, "tt:department"),
      descripcion: htmlATexto(etiqueta(it, "description")),
      publicada: etiqueta(it, "pubDate") ? new Date(etiqueta(it, "pubDate")).toISOString() : undefined,
      sueldo: null,
    };
  });
}

// --- Workday ------------------------------------------------------------------
// Lo usan bancos y corporativos con sucursales y plantas en México (BBVA,
// Santander, Grupo Modelo, Constellation Brands…). Tienen miles de vacantes en
// el mundo, así que pedimos solo las de México con el filtro de país del sitio.
interface WdFaceta {
  facetParameter?: string;
  descriptor?: string;
  id?: string;
  count?: number;
  values?: WdFaceta[];
}
interface WdJob {
  title: string;
  externalPath: string;
  locationsText?: string;
  postedOn?: string;
  bulletFields?: string[];
}
interface WdDetalle {
  jobPostingInfo?: {
    jobDescription?: string;
    location?: string;
    additionalLocations?: string[];
    timeType?: string;
    remoteType?: string;
    startDate?: string;
  };
}

async function postJson<T>(url: string, cuerpo: unknown): Promise<T> {
  let ultimo: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "user-agent": AGENTE, accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(30_000),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status} en ${url}`);
      return (await r.json()) as T;
    } catch (e) {
      ultimo = e;
      if (/HTTP 4\d\d/.test(String(e))) break;
      await new Promise((res) => setTimeout(res, 1500 * 2 ** i));
    }
  }
  throw ultimo;
}

/** Busca, dentro de las facetas de Workday, el valor que corresponde a México. */
export function facetaMexico(facetas: WdFaceta[]): { parametro: string; id: string } | null {
  const visitar = (lista: WdFaceta[], parametro: string): { parametro: string; id: string } | null => {
    for (const f of lista) {
      const p = f.facetParameter ?? parametro;
      if (f.id && f.descriptor && /^m[eé]xico$/i.test(f.descriptor.trim()) && /country|location/i.test(p)) return { parametro: p, id: f.id };
      if (f.values) {
        const r = visitar(f.values, p);
        if (r) return r;
      }
    }
    return null;
  };
  return visitar(facetas, "");
}

/** "Posted 3 Days Ago" / "Publicado hace 3 días" / "Posted Today" → fecha aproximada */
export function fechaWorkday(texto: string | undefined, ahora = new Date()): string | undefined {
  if (!texto) return undefined;
  const t = texto.toLowerCase();
  const dias = /today|hoy/.test(t) ? 0 : /yesterday|ayer/.test(t) ? 1 : Number(t.match(/(\d+)\+?/)?.[1] ?? NaN);
  if (Number.isNaN(dias)) return undefined;
  return new Date(ahora.getTime() - dias * 86_400_000).toISOString();
}

/** "/job/Obregon-Sonora-Mexico/Especialista_R-1" → "Obregon Sonora Mexico" */
function lugarDeRuta(ruta: string): string {
  const partes = ruta.split("/").filter(Boolean);
  return partes.length >= 3 ? decodeURIComponent(partes[1]).replace(/-/g, " ") : "";
}

async function workday(board: string): Promise<VacanteCruda[]> {
  const [inquilino, servidor, sitio] = board.split("|");
  if (!inquilino || !servidor || !sitio) throw new Error(`Board de Workday inválido: ${board} (usa "inquilino|wdN|sitio")`);
  const base = `https://${inquilino}.${servidor}.myworkdayjobs.com`;
  const api = `${base}/wday/cxs/${inquilino}/${sitio}`;

  const primera = await postJson<{ total: number; jobPostings: WdJob[]; facets?: WdFaceta[] }>(`${api}/jobs`, { limit: 20, offset: 0, searchText: "", appliedFacets: {} });
  const mx = facetaMexico(primera.facets ?? []);
  const filtro = mx ? { appliedFacets: { [mx.parametro]: [mx.id] }, searchText: "" } : { appliedFacets: {}, searchText: "Mexico" };

  // Workday solo dice el total en la primera página
  const empleos: WdJob[] = [];
  let total = Infinity;
  for (let offset = 0; offset < Math.min(total, 600); offset += 20) {
    const pagina = await postJson<{ total: number; jobPostings: WdJob[] }>(`${api}/jobs`, { limit: 20, offset, ...filtro });
    if (offset === 0) total = pagina.total ?? 0;
    empleos.push(...(pagina.jobPostings ?? []));
    if (!pagina.jobPostings?.length) break;
  }

  // El detalle trae la descripción y todas las ubicaciones; se pide para las primeras 60
  const detalles = await Promise.all(
    empleos.map((j, i) =>
      i < 60 ? leerJson<WdDetalle>(`${api}${j.externalPath}`, 1).catch(() => null) : Promise.resolve(null),
    ),
  );

  return empleos.map((j, i) => {
    const d = detalles[i]?.jobPostingInfo;
    const varias = /\d+\s+(locations|ubicaciones)/i.test(j.locationsText ?? "");
    let ubicaciones = d?.location
      ? [d.location, ...(d.additionalLocations ?? [])]
      : [varias ? lugarDeRuta(j.externalPath) : (j.locationsText ?? lugarDeRuta(j.externalPath))];
    // Ya filtramos por México: si la ubicación no dice el país, se agrega
    if (mx) ubicaciones = ubicaciones.map((u) => (/m[eé]xico|\bmx\b/i.test(u) ? u : `${u}, México`));
    return {
      idExterno: j.bulletFields?.[0] ?? j.externalPath,
      titulo: j.title,
      url: `${base}/${sitio}${j.externalPath}`,
      ubicaciones,
      modalidadAts: /remote|remoto/i.test(d?.remoteType ?? "") ? "remote" : /hybrid|h[ií]brido/i.test(d?.remoteType ?? "") ? "hybrid" : undefined,
      tipoEmpleo: d?.timeType,
      descripcion: htmlATexto(d?.jobDescription ?? ""),
      publicada: d?.startDate ? new Date(d.startDate).toISOString() : fechaWorkday(j.postedOn),
      sueldo: null,
    };
  });
}

// --- SAP SuccessFactors (sitios de empleo "careers.empresa.com") ---------------
// Lo usan maquiladoras y corporativos con plantas en México (Yazaki, Lear,
// Gruma…). No hay API: se lee la búsqueda pública del propio sitio (permitida
// en su robots.txt) filtrada a México, y el detalle de cada vacante.
const PAIS_CODIGO: Record<string, string> = { MX: "México", BR: "Brasil", AR: "Argentina", CO: "Colombia", CL: "Chile", PE: "Perú", CR: "Costa Rica" };

function textoHtml(s: string): string {
  return htmlATexto(s).replace(/\s+/g, " ").trim();
}

/** Las filas de la tabla de resultados de SuccessFactors. */
export function filasSuccessFactors(html: string): { titulo: string; ruta: string; ubicacion: string; fecha: string; area: string }[] {
  return [...html.matchAll(/<tr class="data-row">([\s\S]*?)<\/tr>/g)].map((m) => {
    const r = m[1];
    const ubic = [...r.matchAll(/class="jobLocation">\s*([^<]+?)\s*</g)].map((x) => x[1]);
    return {
      titulo: textoHtml(r.match(/class="jobTitle-link"[^>]*>([^<]+)</)?.[1] ?? ""),
      ruta: r.match(/href="(\/job\/[^"]+)"/)?.[1] ?? "",
      ubicacion: textoHtml(ubic.at(-1) ?? ""),
      fecha: textoHtml(r.match(/class="jobDate">([^<]+)</)?.[1] ?? ""),
      area: textoHtml(r.match(/class="jobDepartment">([^<]*)</)?.[1] ?? ""),
    };
  }).filter((f) => f.titulo && f.ruta);
}

/** "Ciudad Obregon Cajeme, SON, MX" → "Ciudad Obregon Cajeme, SON, México" */
function paisLegible(u: string): string {
  return u.replace(/,\s*([A-Z]{2})\s*$/, (m, c) => (PAIS_CODIGO[c] ? `, ${PAIS_CODIGO[c]}` : m));
}

/** El contenido del <span class="jobdescription">, que trae spans y divs anidados. */
export function descripcionSuccessFactors(html: string): string {
  const inicio = html.search(/class="jobdescription"[^>]*>/);
  if (inicio < 0) return "";
  const desde = html.indexOf(">", inicio) + 1;
  let profundidad = 0;
  for (const t of html.slice(desde, desde + 60_000).matchAll(/<(\/?)span\b/g)) {
    profundidad += t[1] ? -1 : 1;
    if (profundidad < 0) return html.slice(desde, desde + t.index!);
  }
  return "";
}

async function leerTexto(url: string): Promise<string> {
  const r = await fetch(url, { headers: { "user-agent": AGENTE }, signal: AbortSignal.timeout(30_000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} en ${url}`);
  return r.text();
}

async function successfactors(board: string): Promise<VacanteCruda[]> {
  const base = `https://${board}`;
  const filas: ReturnType<typeof filasSuccessFactors> = [];
  for (let inicio = 0; inicio < 500; inicio += 25) {
    const html = await leerTexto(`${base}/search/?q=&optionsFacetsDD_country=MX&startrow=${inicio}`);
    const pagina = filasSuccessFactors(html);
    filas.push(...pagina);
    const total = Number(html.match(/Results <b>[^<]*<\/b>\s*of\s*<b>([\d,]+)<\/b>/)?.[1]?.replace(/,/g, "") ?? 0);
    if (pagina.length === 0 || inicio + 25 >= total) break;
  }

  // Detalle: descripción y ubicación exacta (máximo 60, empezando por Sonora)
  const orden = [...filas.keys()].sort((a, b) => Number(/SON\b|sonora/i.test(filas[b].ubicacion)) - Number(/SON\b|sonora/i.test(filas[a].ubicacion)));
  const detalle = new Map<number, string>();
  for (let i = 0; i < Math.min(orden.length, 60); i += 6) {
    await Promise.all(
      orden.slice(i, i + 6).map(async (k) => {
        try {
          detalle.set(k, await leerTexto(`${base}${filas[k].ruta}`));
        } catch {
          /* sin detalle: se usa lo de la lista */
        }
      }),
    );
  }

  return filas.map((f, k) => {
    const h = detalle.get(k) ?? "";
    const meta = (prop: string) => h.match(new RegExp(`itemprop="${prop}" content="([^"]*)"`))?.[1] ?? "";
    const lugar = meta("addressLocality") ? [meta("addressLocality"), meta("addressRegion"), meta("addressCountry")].filter(Boolean).join(", ") : f.ubicacion;
    const desc = descripcionSuccessFactors(h);
    const fecha = meta("datePosted") || f.fecha;
    return {
      idExterno: f.ruta.match(/\/(\d+)\/?$/)?.[1] ?? f.ruta,
      titulo: f.titulo,
      url: `${base}${f.ruta}`,
      ubicaciones: [paisLegible(lugar)],
      departamento: f.area,
      descripcion: htmlATexto(desc),
      publicada: fecha && !Number.isNaN(new Date(fecha).getTime()) ? new Date(fecha).toISOString() : undefined,
      sueldo: null,
    };
  });
}

const LECTORES = { greenhouse, lever, ashby, workable, smartrecruiters, recruitee, bamboohr, teamtailor, workday, successfactors } as const;

export function leerVacantes(empresa: Empresa): Promise<VacanteCruda[]> {
  return LECTORES[empresa.ats](empresa.board);
}
