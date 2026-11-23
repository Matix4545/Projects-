// Tipos compartidos entre el recolector (scripts/) y la web (app/).
// Este archivo no importa nada para que también corra con Node directo.

export type Ats = "greenhouse" | "lever" | "ashby" | "workable" | "smartrecruiters" | "recruitee" | "bamboohr" | "teamtailor" | "workday" | "successfactors" | "wordpress";

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
  /** "agro": empresa del campo; sus vacantes comerciales o sin área clara van a "Agricultura y campo". */
  sector?: "agro";
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
export type Periodo = "hora" | "semana" | "mes" | "año";

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

/** Los 32 estados de México (slug → nombre), para filtrar vacantes por estado. */
export const ESTADOS = {
  aguascalientes: "Aguascalientes",
  "baja-california": "Baja California",
  "baja-california-sur": "Baja California Sur",
  campeche: "Campeche",
  chiapas: "Chiapas",
  chihuahua: "Chihuahua",
  cdmx: "Ciudad de México",
  coahuila: "Coahuila",
  colima: "Colima",
  durango: "Durango",
  edomex: "Estado de México",
  guanajuato: "Guanajuato",
  guerrero: "Guerrero",
  hidalgo: "Hidalgo",
  jalisco: "Jalisco",
  michoacan: "Michoacán",
  morelos: "Morelos",
  nayarit: "Nayarit",
  "nuevo-leon": "Nuevo León",
  oaxaca: "Oaxaca",
  puebla: "Puebla",
  queretaro: "Querétaro",
  "quintana-roo": "Quintana Roo",
  "san-luis-potosi": "San Luis Potosí",
  sinaloa: "Sinaloa",
  sonora: "Sonora",
  tabasco: "Tabasco",
  tamaulipas: "Tamaulipas",
  tlaxcala: "Tlaxcala",
  veracruz: "Veracruz",
  yucatan: "Yucatán",
  zacatecas: "Zacatecas",
} as const;
export type Estado = keyof typeof ESTADOS;

/** Zonas de una vacante: los estados de México donde está, más "cajeme" (Cd. Obregón). */
export const ZONAS = ["cajeme", ...(Object.keys(ESTADOS) as Estado[])] as const;
export type Zona = "cajeme" | Estado;
export const NOMBRE_ZONA: Record<Zona, string> = { cajeme: "Cd. Obregón (Cajeme)", ...ESTADOS };

export const CATEGORIAS = [
  "agro",
  "software",
  "datos-ia",
  "producto",
  "diseno",
  "marketing",
  "ventas",
  "atencion-clientes",
  "finanzas",
  "banca",
  "recursos-humanos",
  "operaciones",
  "produccion",
  "salud",
  "turismo",
  "oficios",
  "legal",
  "seguridad",
  "otros",
] as const;
export type Categoria = (typeof CATEGORIAS)[number];

export const NOMBRE_CATEGORIA: Record<Categoria, string> = {
  agro: "Agricultura y campo",
  software: "Software e ingeniería",
  "datos-ia": "Datos e IA",
  producto: "Producto",
  diseno: "Diseño",
  marketing: "Marketing",
  ventas: "Ventas",
  "atencion-clientes": "Atención a clientes",
  finanzas: "Finanzas y contabilidad",
  banca: "Banca, seguros y afore",
  "recursos-humanos": "Recursos humanos",
  operaciones: "Operaciones y logística",
  produccion: "Producción, manufactura y mantenimiento",
  salud: "Salud",
  turismo: "Hoteles, restaurantes y turismo",
  oficios: "Chofer, seguridad y servicios",
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
