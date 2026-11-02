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

const LECTORES = { greenhouse, lever, ashby, workable, smartrecruiters, recruitee, bamboohr, teamtailor } as const;

export function leerVacantes(empresa: Empresa): Promise<VacanteCruda[]> {
  return LECTORES[empresa.ats](empresa.board);
}
