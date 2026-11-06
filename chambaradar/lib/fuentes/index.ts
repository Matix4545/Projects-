// Lectores de las APIs públicas de cada sistema de reclutamiento (ATS).
// Todas son APIs oficiales que las empresas publican para mostrar sus
// vacantes en su propio sitio, así que no hace falta "scrapear" HTML.

import type { Empresa, Sueldo, VacanteCruda } from "../tipos.ts";
import { detectarPaises, htmlATexto, periodoDeIntervalo, sueldoDeGreenhouse } from "../normalizar.ts";

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
/** Países de LATAM de habla hispana: cómo los nombra Workday (en inglés o español) y el nombre que agregamos a la ubicación. */
const PAISES_LATAM: [RegExp, string][] = [
  [/^m[eé]xico$/i, "México"],
  [/^argentina$/i, "Argentina"],
  [/^colombia$/i, "Colombia"],
  [/^chile$/i, "Chile"],
  [/^per[uú]$/i, "Perú"],
  [/^uruguay$/i, "Uruguay"],
  [/^costa rica$/i, "Costa Rica"],
  [/^ecuador$/i, "Ecuador"],
  [/^guatemala$/i, "Guatemala"],
  [/^panam[aá]$/i, "Panamá"],
  [/^(dominican republic|rep[uú]blica dominicana)$/i, "República Dominicana"],
  [/^paraguay$/i, "Paraguay"],
  [/^bolivia\b/i, "Bolivia"],
  [/^venezuela\b/i, "Venezuela"],
  [/^el salvador$/i, "El Salvador"],
  [/^honduras$/i, "Honduras"],
  [/^nicaragua$/i, "Nicaragua"],
];

/** Facetas de país de LATAM (sin Brasil) en el buscador de Workday, con cuántas vacantes tiene cada una. */
export function facetasLatam(facetas: WdFaceta[]): { parametro: string; id: string; pais: string; total: number }[] {
  const encontradas: { parametro: string; id: string; pais: string; total: number }[] = [];
  const visitar = (lista: WdFaceta[], parametro: string) => {
    for (const f of lista) {
      const p = f.facetParameter ?? parametro;
      const nombre = f.descriptor?.trim() ?? "";
      const pais = PAISES_LATAM.find(([r]) => r.test(nombre))?.[1];
      if (f.id && pais && /country|location/i.test(p) && !encontradas.some((e) => e.pais === pais)) {
        encontradas.push({ parametro: p, id: f.id, pais, total: f.count ?? -1 });
      }
      if (f.values) visitar(f.values, p);
    }
  };
  visitar(facetas, "");
  return encontradas;
}

/** La faceta de México (se conserva para compatibilidad y pruebas). */
export function facetaMexico(facetas: WdFaceta[]): { parametro: string; id: string } | null {
  const mx = facetasLatam(facetas).find((f) => f.pais === "México");
  return mx ? { parametro: mx.parametro, id: mx.id } : null;
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

/**
 * Id de la vacante en Workday: el primer "bullet" suele ser el número de
 * requisición (R123456, JR-001…), pero algunos portales ponen ahí la ciudad.
 * Si no parece un número de vacante, se usa la ruta, que siempre es única.
 */
export function idWorkday(bullet: string | undefined, ruta: string): string {
  return bullet && /\d/.test(bullet) && !/\s/.test(bullet.trim()) ? bullet.trim() : ruta;
}

async function workday(board: string): Promise<VacanteCruda[]> {
  const [inquilino, servidor, sitio] = board.split("|");
  if (!inquilino || !servidor || !sitio) throw new Error(`Board de Workday inválido: ${board} (usa "inquilino|wdN|sitio")`);
  const base = `https://${inquilino}.${servidor}.myworkdayjobs.com`;
  const api = `${base}/wday/cxs/${inquilino}/${sitio}`;

  const primera = await postJson<{ total: number; jobPostings: WdJob[]; facets?: WdFaceta[] }>(`${api}/jobs`, { limit: 20, offset: 0, searchText: "", appliedFacets: {} });
  // Un país a la vez (México primero), solo los que tienen vacantes: así sabemos de qué país es cada una
  const paises = facetasLatam(primera.facets ?? []).filter((f) => f.total !== 0);
  const consultas = paises.length
    ? paises.map((f) => ({ pais: f.pais, tope: f.pais === "México" ? 600 : 300, filtro: { appliedFacets: { [f.parametro]: [f.id] }, searchText: "" } }))
    : [{ pais: "México", tope: 600, filtro: { appliedFacets: {}, searchText: "Mexico" } }];

  // Workday solo dice el total en la primera página
  // Los países se piden en paralelo (cada uno página por página)
  const porPais = await Promise.all(
    consultas.map(async (c) => {
      const lista: WdJob[] = [];
      let total = Infinity;
      for (let offset = 0; offset < Math.min(total, c.tope); offset += 20) {
        const pagina = await postJson<{ total: number; jobPostings: WdJob[] }>(`${api}/jobs`, { limit: 20, offset, ...c.filtro });
        if (offset === 0) total = pagina.total ?? 0;
        lista.push(...(pagina.jobPostings ?? []));
        if (!pagina.jobPostings?.length) break;
      }
      return { pais: c.pais, lista };
    }),
  );
  const empleos: WdJob[] = [];
  const paisDe = new Map<string, string>();
  for (const { pais, lista } of porPais) {
    for (const j of lista) {
      // Sin ruta no hay enlace para aplicar; y no repetimos las de varios países
      if (!j.externalPath || paisDe.has(j.externalPath)) continue;
      paisDe.set(j.externalPath, pais);
      empleos.push(j);
    }
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
    // Ya filtramos por país: si la ubicación no lo dice, se agrega
    const pais = paisDe.get(j.externalPath);
    if (pais && paises.length) ubicaciones = ubicaciones.map((u) => (detectarPaises(u).length ? u : `${u}, ${pais}`));
    return {
      idExterno: idWorkday(j.bulletFields?.[0], j.externalPath),
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
const PAIS_CODIGO: Record<string, string> = {
  MX: "México", BR: "Brasil", AR: "Argentina", CO: "Colombia", CL: "Chile", PE: "Perú", CR: "Costa Rica", UY: "Uruguay", EC: "Ecuador",
  GT: "Guatemala", PA: "Panamá", DO: "República Dominicana", PY: "Paraguay", BO: "Bolivia", VE: "Venezuela", SV: "El Salvador", HN: "Honduras", NI: "Nicaragua",
};
/** Países que se piden a SuccessFactors (LATAM de habla hispana, México primero). */
const PAISES_SF = ["MX", "CO", "AR", "CL", "PE", "CR", "UY", "EC", "GT", "PA", "DO", "PY", "BO", "VE", "SV", "HN", "NI"];

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

/** "Results <b>1 – 25</b> of <b>318</b>" o, en portales en español, "Resultados <b>1 – 25</b> de <b>318</b>". */
export function totalSuccessFactors(html: string): number {
  return Number(html.match(/(?:Results|Resultados) <b>[^<]*<\/b>\s*(?:of|de)\s*<b>([\d,.]+)<\/b>/)?.[1]?.replace(/[,.]/g, "") ?? 0);
}

async function successfactors(board: string): Promise<VacanteCruda[]> {
  const base = `https://${board}`;
  const filas: (ReturnType<typeof filasSuccessFactors>[number] & { pais: string })[] = [];
  const vistas = new Set<string>();
  for (const pais of PAISES_SF) {
    for (let inicio = 0; inicio < (pais === "MX" ? 500 : 250); inicio += 25) {
      const html = await leerTexto(`${base}/search/?q=&optionsFacetsDD_country=${pais}&startrow=${inicio}`);
      const pagina = filasSuccessFactors(html);
      for (const f of pagina) {
        if (vistas.has(f.ruta)) continue;
        vistas.add(f.ruta);
        filas.push({ ...f, pais });
      }
      if (pagina.length === 0 || inicio + 25 >= totalSuccessFactors(html)) break;
    }
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
      // Ya filtramos por país: si la ubicación no lo dice, se agrega
      ubicaciones: [detectarPaises(paisLegible(lugar)).length ? paisLegible(lugar) : `${paisLegible(lugar)}, ${PAIS_CODIGO[f.pais]}`],
      departamento: f.area,
      descripcion: htmlATexto(desc),
      publicada: fecha && !Number.isNaN(new Date(fecha).getTime()) ? new Date(fecha).toISOString() : undefined,
      sueldo: null,
    };
  });
}

// --- WordPress con ofertas "job" (portales hechos con Beetween, p. ej. Radiall) ---
// board: "dominio|taxonomía-de-ubicación", p. ej. "jobs.radiall.com|job_custom_radiall_location".
// La lista sale de la API pública de WordPress (/wp-json/wp/v2/job) y la descripción,
// del bloque JobPosting (schema.org) que cada vacante publica para Google.

interface WpJob {
  id: number;
  date_gmt?: string;
  link: string;
  title: { rendered: string };
  [taxonomia: string]: unknown;
}

const PAIS_WP: Record<string, string> = {
  MEXICO: "México", BRAZIL: "Brasil", ARGENTINA: "Argentina", COLOMBIA: "Colombia", CHILE: "Chile", PERU: "Perú", USA: "Estados Unidos",
};

/** "MEXICO, Sonora, Obregón" → "Obregón, Sonora, México" */
export function ubicacionWordpress(nombre: string): string {
  const partes = nombre.split(",").map((x) => x.trim()).filter(Boolean);
  if (partes.length > 1 && /^[A-Z ]+$/.test(partes[0])) {
    const pais = PAIS_WP[partes[0].trim()] ?? partes[0].charAt(0) + partes[0].slice(1).toLowerCase();
    return [...partes.slice(1).reverse(), pais].join(", ");
  }
  return nombre.trim();
}

interface JobPosting {
  description?: string;
  datePosted?: string;
  validThrough?: string;
  employmentType?: string | string[];
}

/** El primer JobPosting de los bloques JSON-LD de una página (también dentro de "@graph"). */
export function jobPostingDeHtml(html: string): JobPosting | null {
  for (const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const datos = JSON.parse(m[1]);
      const lista: unknown[] = Array.isArray(datos) ? datos : datos?.["@graph"] ? datos["@graph"] : [datos];
      const jp = lista.find((x) => x && typeof x === "object" && [(x as { "@type"?: unknown })["@type"]].flat().includes("JobPosting"));
      if (jp) return jp as JobPosting;
    } catch {
      /* bloque inválido: se ignora */
    }
  }
  return null;
}

const LATAM_WP = /mexic|méxic|brazil|brasil|argentin|colombi|chile|peru|perú|remot/i;

async function wordpress(board: string): Promise<VacanteCruda[]> {
  const [dominio, taxonomia] = board.split("|");
  const base = `https://${dominio}`;
  const lugares = new Map<number, string>();
  if (taxonomia) for (const t of await leerJson<{ id: number; name: string }[]>(`${base}/wp-json/wp/v2/${taxonomia}?per_page=100`)) lugares.set(t.id, t.name);

  const puestos: WpJob[] = [];
  for (let pagina = 1; pagina <= 10; pagina++) {
    const lote = await leerJson<WpJob[]>(`${base}/wp-json/wp/v2/job?per_page=100&page=${pagina}`);
    puestos.push(...lote);
    if (lote.length < 100) break;
  }

  const ubicacionesDe = (j: WpJob) =>
    ((taxonomia ? (j[taxonomia] as number[] | undefined) : undefined) ?? []).map((id) => lugares.get(id)).filter((x): x is string => Boolean(x)).map(ubicacionWordpress);

  // Descripción solo de las que pueden servir desde LATAM (las demás se descartan después)
  const detalle = new Map<number, JobPosting | null>();
  const conDetalle = puestos.filter((j) => LATAM_WP.test(ubicacionesDe(j).join(" ")));
  for (let i = 0; i < Math.min(conDetalle.length, 60); i += 4) {
    await Promise.all(
      conDetalle.slice(i, i + 4).map(async (j) => {
        try {
          detalle.set(j.id, jobPostingDeHtml(await leerTexto(j.link)));
        } catch {
          /* sin detalle */
        }
      }),
    );
  }

  const hoy = Date.now();
  return puestos
    .filter((j) => {
      const vence = detalle.get(j.id)?.validThrough;
      return !vence || Number.isNaN(Date.parse(vence)) || Date.parse(vence) > hoy;
    })
    .map((j) => {
      const jp = detalle.get(j.id);
      const fecha = jp?.datePosted || (j.date_gmt ? `${j.date_gmt}Z` : "");
      return {
        idExterno: String(j.id),
        titulo: htmlATexto(j.title.rendered),
        url: j.link,
        ubicaciones: ubicacionesDe(j),
        tipoEmpleo: [jp?.employmentType ?? []].flat().join(", ") || undefined,
        descripcion: htmlATexto(jp?.description ?? ""),
        publicada: fecha && !Number.isNaN(new Date(fecha).getTime()) ? new Date(fecha).toISOString() : undefined,
        sueldo: null,
      };
    });
}

const LECTORES = { greenhouse, lever, ashby, workable, smartrecruiters, recruitee, bamboohr, teamtailor, workday, successfactors, wordpress } as const;

export function leerVacantes(empresa: Empresa): Promise<VacanteCruda[]> {
  return LECTORES[empresa.ats](empresa.board);
}
