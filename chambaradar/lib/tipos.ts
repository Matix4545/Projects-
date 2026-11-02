// Tipos compartidos entre el recolector (scripts/) y la web (app/).
// Este archivo no importa nada para que también corra con Node directo.

export type Ats = "greenhouse" | "lever" | "ashby" | "workable" | "smartrecruiters" | "recruitee" | "bamboohr" | "teamtailor" | "workday";

/** Empresa que vigilamos. Viene de data/empresas.json. */
export interface Empresa {
  slug: string;
  nombre: string;
  ats: Ats;
  /**
   * Identificador del tablero de empleos en el ATS (p. ej. "clara" o "kraken.com").
   * En Workday es "inquilino|servidor|sitio", p. ej. "bbva|wd3|BBVA".
   */
  board: string;
  /** "local": empresa de LATAM. "remoto": empresa extranjera que contrata desde LATAM. */
  tipo: "local" | "remoto";
  /** Si la empresa es 100 % remota y contrata en cualquier país, "Remote" a secas cuenta como LATAM. */
  remotoGlobal?: boolean;
}

/** Vacante tal como llega del ATS, antes de normalizar. */
export interface VacanteCruda {
  idExterno: string;
  titulo: string;
  url: string;
  /** Todas las ubicaciones que publica la empresa, en texto libre */
  ubicaciones: string[];
  /** Pista estructurada del ATS: "remote", "hybrid", "onsite" (si existe) */
  modalidadAts?: string;
  departamento?: string;
  tipoEmpleo?: string;
  descripcion: string;
  publicada?: string;
  sueldo?: Sueldo | null;
}

export type Modalidad = "remoto" | "hibrido" | "presencial";
export type Periodo = "hora" | "mes" | "año";

export interface Sueldo {
  min: number | null;
  max: number | null;
  moneda: string;
  periodo: Periodo;
}

/** Vacante limpia, lista para guardar y mostrar. */
export interface Vacante {
  id: string;
  empresa_slug: string;
  empresa_nombre: string;
  empresa_tipo: "local" | "remoto";
  titulo: string;
  url: string;
  ubicacion: string;
  /** Códigos ISO de los países de LATAM donde aplica (MX, BR, AR…). Vacío si es "cualquier país". */
  paises: string[];
  modalidad: Modalidad;
  /** Se puede hacer desde LATAM (en un país de LATAM o remoto abierto a la región) */
  acepta_latam: boolean;
  /** Zonas locales detectadas en la ubicación: "cajeme" (Cd. Obregón), "sonora" */
  zonas: Zona[];
  categoria: Categoria;
  nivel: Nivel;
  idioma: "es" | "pt" | "en";
  sueldo_min: number | null;
  sueldo_max: number | null;
  moneda: string | null;
  periodo: Periodo | null;
  descripcion: string;
  publicada: string;
  vista: string;
}

export const ZONAS = ["cajeme", "sonora"] as const;
export type Zona = (typeof ZONAS)[number];
export const NOMBRE_ZONA: Record<Zona, string> = { cajeme: "Cd. Obregón (Cajeme)", sonora: "Sonora" };

export const CATEGORIAS = [
  "software",
  "datos-ia",
  "producto",
  "diseno",
  "marketing",
  "ventas",
  "atencion-clientes",
  "finanzas",
  "recursos-humanos",
  "operaciones",
  "legal",
  "seguridad",
  "otros",
] as const;
export type Categoria = (typeof CATEGORIAS)[number];

export const NOMBRE_CATEGORIA: Record<Categoria, string> = {
  software: "Software e ingeniería",
  "datos-ia": "Datos e IA",
  producto: "Producto",
  diseno: "Diseño",
  marketing: "Marketing",
  ventas: "Ventas",
  "atencion-clientes": "Atención a clientes",
  finanzas: "Finanzas y contabilidad",
  "recursos-humanos": "Recursos humanos",
  operaciones: "Operaciones y logística",
  legal: "Legal y cumplimiento",
  seguridad: "Ciberseguridad",
  otros: "Otras áreas",
};

export const NIVELES = ["practicante", "junior", "intermedio", "senior", "gerencia"] as const;
export type Nivel = (typeof NIVELES)[number];

export const NOMBRE_NIVEL: Record<Nivel, string> = {
  practicante: "Practicante",
  junior: "Junior",
  intermedio: "Intermedio",
  senior: "Senior",
  gerencia: "Gerencia / Dirección",
};

/** Países de LATAM que reconocemos, con su nombre en español. */
export const PAISES: Record<string, string> = {
  MX: "México",
  BR: "Brasil",
  AR: "Argentina",
  CO: "Colombia",
  CL: "Chile",
  PE: "Perú",
  UY: "Uruguay",
  CR: "Costa Rica",
  EC: "Ecuador",
  GT: "Guatemala",
  PA: "Panamá",
  DO: "Rep. Dominicana",
  PY: "Paraguay",
  BO: "Bolivia",
  VE: "Venezuela",
  SV: "El Salvador",
  HN: "Honduras",
  NI: "Nicaragua",
};
