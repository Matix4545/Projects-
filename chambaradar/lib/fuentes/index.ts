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

const LECTORES = { greenhouse, lever, ashby, workable } as const;

export function leerVacantes(empresa: Empresa): Promise<VacanteCruda[]> {
  return LECTORES[empresa.ats](empresa.board);
}
