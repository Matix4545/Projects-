// Creador de CV: estructura, limpieza y textos fijos en español e inglés.
// Lo mismo se usa en el navegador (editor y vista previa) y en el servidor
// (antes de guardar), así que no importa nada exclusivo de ninguno de los dos.

export type IdiomaCv = "es" | "en";
export type Nivel = "basico" | "intermedio" | "avanzado" | "nativo";

export interface Experiencia {
  puesto: string;
  empresa: string;
  lugar: string;
  inicio: string;
  fin: string;
  /** Una línea por logro o responsabilidad */
  logros: string;
}

export interface Estudio {
  titulo: string;
  escuela: string;
  lugar: string;
  inicio: string;
  fin: string;
}

export interface IdiomaHablado {
  idioma: string;
  nivel: Nivel;
}

export interface Cv {
  idioma: IdiomaCv;
  nombre: string;
  titular: string;
  ciudad: string;
  telefono: string;
  correo: string;
  enlace: string;
  perfil: string;
  experiencia: Experiencia[];
  educacion: Estudio[];
  habilidades: string;
  idiomas: IdiomaHablado[];
  cursos: string;
}

export const NIVELES_IDIOMA: Nivel[] = ["basico", "intermedio", "avanzado", "nativo"];

export const TEXTOS = {
  es: {
    perfil: "Perfil profesional",
    experiencia: "Experiencia",
    educacion: "Educación",
    habilidades: "Habilidades",
    idiomas: "Idiomas",
    cursos: "Cursos y certificaciones",
    actual: "Actual",
    nivel: { basico: "Básico", intermedio: "Intermedio", avanzado: "Avanzado", nativo: "Nativo" },
  },
  en: {
    perfil: "Professional summary",
    experiencia: "Experience",
    educacion: "Education",
    habilidades: "Skills",
    idiomas: "Languages",
    cursos: "Courses and certifications",
    actual: "Present",
    nivel: { basico: "Basic", intermedio: "Intermediate", avanzado: "Advanced", nativo: "Native" },
  },
} as const;

export const EXPERIENCIA_VACIA: Experiencia = { puesto: "", empresa: "", lugar: "", inicio: "", fin: "", logros: "" };
export const ESTUDIO_VACIO: Estudio = { titulo: "", escuela: "", lugar: "", inicio: "", fin: "" };

export const CV_VACIO: Cv = {
  idioma: "es",
  nombre: "",
  titular: "",
  ciudad: "",
  telefono: "",
  correo: "",
  enlace: "",
  perfil: "",
  experiencia: [{ ...EXPERIENCIA_VACIA }],
  educacion: [{ ...ESTUDIO_VACIO }],
  habilidades: "",
  idiomas: [{ idioma: "Español", nivel: "nativo" }],
  cursos: "",
};

const MAX_EXPERIENCIAS = 12;
const MAX_ESTUDIOS = 8;
const MAX_IDIOMAS = 8;

function texto(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  // Quita caracteres de control (menos saltos de línea) y recorta
  return v.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "").slice(0, max);
}

function objeto(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function lista(v: unknown, max: number): Record<string, unknown>[] {
  return Array.isArray(v) ? v.slice(0, max).map(objeto) : [];
}

/** Convierte cualquier cosa (lo que llega del navegador o de la base) en un CV válido. */
export function limpiarCv(entrada: unknown): Cv {
  const d = objeto(entrada);
  return {
    idioma: d.idioma === "en" ? "en" : "es",
    nombre: texto(d.nombre, 80),
    titular: texto(d.titular, 120),
    ciudad: texto(d.ciudad, 80),
    telefono: texto(d.telefono, 40),
    correo: texto(d.correo, 120),
    enlace: texto(d.enlace, 200),
    perfil: texto(d.perfil, 1200),
    experiencia: lista(d.experiencia, MAX_EXPERIENCIAS).map((e) => ({
      puesto: texto(e.puesto, 120),
      empresa: texto(e.empresa, 120),
      lugar: texto(e.lugar, 80),
      inicio: texto(e.inicio, 30),
      fin: texto(e.fin, 30),
      logros: texto(e.logros, 2000),
    })),
    educacion: lista(d.educacion, MAX_ESTUDIOS).map((e) => ({
      titulo: texto(e.titulo, 160),
      escuela: texto(e.escuela, 160),
      lugar: texto(e.lugar, 80),
      inicio: texto(e.inicio, 30),
      fin: texto(e.fin, 30),
    })),
    habilidades: texto(d.habilidades, 800),
    idiomas: lista(d.idiomas, MAX_IDIOMAS).map((i) => ({
      idioma: texto(i.idioma, 40),
      nivel: (NIVELES_IDIOMA as unknown[]).includes(i.nivel) ? (i.nivel as Nivel) : "intermedio",
    })),
    cursos: texto(d.cursos, 1500),
  };
}

/** Líneas de un campo de texto libre, sin viñetas ni vacías ("• Hice X" → "Hice X"). */
export function renglones(t: string): string[] {
  return t
    .split("\n")
    .map((l) => l.replace(/^\s*[-•*·▪●]\s*/, "").trim())
    .filter(Boolean);
}

/** "Excel, ventas, inglés" → ["Excel", "ventas", "inglés"] (comas, punto y coma o saltos de línea). */
export function separarHabilidades(t: string): string[] {
  return t
    .split(/[,;\n]/)
    .map((h) => h.trim())
    .filter(Boolean);
}

/** "2021 – 2024", "2022 – Actual" o solo una de las dos. */
export function periodo(inicio: string, fin: string, idioma: IdiomaCv): string {
  const a = inicio.trim();
  const b = fin.trim() || (a ? TEXTOS[idioma].actual : "");
  return a && b ? `${a} – ${b}` : a || b;
}

/** ¿Tiene algo escrito una entrada de experiencia o educación? */
export function tieneAlgo(o: object): boolean {
  return Object.values(o).some((v) => typeof v === "string" && v.trim() !== "");
}

/** Nombre del archivo PDF: "CV Juan Pérez" */
export function tituloArchivo(cv: Cv): string {
  const n = cv.nombre.trim();
  return n ? `CV ${n}` : "Mi CV";
}
