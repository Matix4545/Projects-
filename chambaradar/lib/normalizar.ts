// Convierte las vacantes de cada ATS a un formato único y decide si sirven
// para alguien en México/LATAM. Funciones puras: se prueban en tests/.

import type { Categoria, Empresa, Modalidad, Nivel, Sueldo, Vacante, VacanteCruda, Zona } from "./tipos.ts";

/** Quita acentos y pasa a minúsculas para comparar texto. */
export function plano(texto: string | null | undefined): string {
  return (texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Convierte HTML (a veces escapado dos veces, como en Greenhouse) a texto plano. */
export function htmlATexto(html: string): string {
  let t = html;
  // Greenhouse manda el HTML escapado (&lt;p&gt;…)
  if (/&lt;\/?[a-z]/i.test(t)) t = decodificar(t);
  t = t
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|br|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " ");
  t = decodificar(t);
  return t
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function decodificar(t: string): string {
  return t
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&mdash;|&ndash;/g, "–")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");
}

// ---------------------------------------------------------------------------
// Ubicación
// ---------------------------------------------------------------------------

/** Palabras que identifican cada país de LATAM (sin acentos, en minúsculas). */
const CLAVES_PAIS: Record<string, string[]> = {
  MX: [
    "mexico", "cdmx", "ciudad de mexico", "guadalajara", "monterrey", "queretaro", "puebla", "tijuana", "merida", "leon, gto", "jalisco", "nuevo leon", "cmx",
    // Sonora
    "sonora", "hermosillo", "obregon", "cd. obregon", "cajeme", "navojoa", "guaymas", "empalme", "nogales", "san luis rio colorado", "huatabampo", "caborca",
    // Otras ciudades con muchas vacantes
    "saltillo", "chihuahua", "ciudad juarez", "mexicali", "culiacan", "mazatlan", "aguascalientes", "san luis potosi", "toluca", "veracruz", "piedras negras", "cancun",
  ],
  BR: ["brazil", "brasil", "sao paulo", "rio de janeiro", "belo horizonte", "curitiba", "florianopolis", "porto alegre", "campinas", "recife"],
  AR: ["argentina", "buenos aires", "cordoba", "rosario", "mendoza", "caba"],
  CO: ["colombia", "bogota", "medellin", "cali", "barranquilla"],
  CL: ["chile", "santiago"],
  PE: ["peru", "lima"],
  UY: ["uruguay", "montevideo"],
  CR: ["costa rica", "san jose, cr"],
  EC: ["ecuador", "quito", "guayaquil"],
  GT: ["guatemala"],
  PA: ["panama"],
  DO: ["dominican republic", "republica dominicana", "santo domingo"],
  PY: ["paraguay", "asuncion"],
  BO: ["bolivia"],
  VE: ["venezuela", "caracas"],
  SV: ["el salvador"],
  HN: ["honduras"],
  NI: ["nicaragua"],
};

/** Regiones que incluyen a LATAM. */
const REGIONES_LATAM = /\b(latam|lat am|latin america|latinoamerica|america latina|south america|central america|americas|amer\b|anywhere|worldwide|global|any location|cualquier lugar|todo el mundo)/;

/** Palabras que solo dicen "remoto" sin nombrar un país o región. */
const SOLO_REMOTO = /\b(remote|remoto|remota|fully|100%|work from home|home based|home office|wfh|teletrabajo|location|flexible|n\/a|none|any)\b/g;

/** ¿La ubicación dice solo "Remote" (sin país ni región)? */
function remotoSinRegion(ubicaciones: string[]): boolean {
  return ubicaciones.every((u) => plano(u).replace(SOLO_REMOTO, " ").replace(/[^a-z]+/g, "").length === 0);
}

/** Países de LATAM mencionados en el texto. */
export function detectarPaises(texto: string): string[] {
  // "New Mexico" es un estado de EE.UU., no México
  const t = plano(texto).replace(/new mexico|, nm\b/g, " ");
  const encontrados: string[] = [];
  for (const [codigo, claves] of Object.entries(CLAVES_PAIS)) {
    if (claves.some((c) => new RegExp(`(^|[^a-z])${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`).test(t))) {
      encontrados.push(codigo);
    }
  }
  return encontrados;
}

// ---------------------------------------------------------------------------
// Zonas locales (por ahora: Cd. Obregón / Cajeme y Sonora)
// ---------------------------------------------------------------------------

const CIUDADES_SONORA = /\b(sonora|hermosillo|cajeme|navojoa|guaymas|empalme|nogales|san luis rio colorado|huatabampo|caborca|etchojoa|alamos|pueblo yaqui|bacum|esperanza,? son)\b/;

/**
 * "Obregón" puede ser Cd. Obregón, Sonora, o la alcaldía Álvaro Obregón (CDMX).
 * Cuenta como Cajeme si dice Cajeme, "Ciudad/Cd. Obregón", "Obregón, Sonora",
 * el código postal 850xx, o "Obregón" a secas sin "Álvaro" ni CDMX.
 */
export function detectarZonas(texto: string): Zona[] {
  const t = plano(texto).replace(/alvaro obregon/g, " ");
  const enCdmx = /cdmx|ciudad de mexico|mexico city|distrito federal/.test(t);
  const cajeme =
    /\bcajeme\b|(ciudad|cd\.?) ?obregon|obregon[ ,-]+(son\b|sonora)|\b850\d\d\b/.test(t) || (/\bobregon\b/.test(t) && !enCdmx);
  const zonas: Zona[] = [];
  if (cajeme) zonas.push("cajeme");
  if (cajeme || CIUDADES_SONORA.test(t)) zonas.push("sonora");
  return zonas;
}

/**
 * Enfoque de lanzamiento (Cd. Obregón): ¿la vacante le sirve a alguien que vive ahí?
 * - Sí, si es en Sonora (Cajeme primero, pero también Hermosillo, Navojoa…), en cualquier modalidad.
 * - Sí, si es 100 % remota y acepta gente en México (dice México o es abierta a
 *   LATAM/cualquier país sin limitarse a otros países).
 * - No, si es presencial/híbrida en otra ciudad, o remota solo para otros países.
 */
export function esRelevanteObregon(v: Pick<Vacante, "zonas" | "modalidad" | "paises" | "acepta_latam">): boolean {
  if (v.zonas.includes("sonora")) return true;
  return v.modalidad === "remoto" && v.acepta_latam && (v.paises.length === 0 || v.paises.includes("MX"));
}

export function detectarModalidad(ubicaciones: string[], titulo: string, pista?: string): Modalidad {
  const p = plano(pista ?? "");
  const t = plano([...ubicaciones, titulo].join(" | "));
  if (/hybrid|hibrid/.test(p) || /hybrid|hibrid/.test(t)) return "hibrido";
  if (/remote/.test(p) || /\bremot[eoa]\b|anywhere|home.based|home office|work from home|teletrabajo/.test(t)) return "remoto";
  return "presencial";
}

/**
 * ¿Puede aplicar alguien que vive en LATAM?
 * - Sí, si la vacante está en un país de LATAM (presencial, híbrida o remota).
 * - Sí, si es remota para una región que incluye LATAM (LATAM, Americas, Worldwide…).
 * - Sí, si es remota "a secas" en una empresa que contrata en cualquier país.
 * - No, si es remota pero limitada a otro país o región (Remote - US, Remote, North America…).
 */
export function aceptaLatam(ubicaciones: string[], modalidad: Modalidad, paises: string[], empresa: Empresa): boolean {
  if (paises.length > 0) return true;
  const t = plano(ubicaciones.join(" | "));
  if (modalidad !== "remoto") return false;
  if (REGIONES_LATAM.test(t)) return true;
  // "Remote" a secas: solo cuenta en empresas que contratan en cualquier país.
  // "Remote, North America" o "Remote - US" nombran otra región y no cuentan.
  return Boolean(empresa.remotoGlobal) && remotoSinRegion(ubicaciones);
}

// ---------------------------------------------------------------------------
// Categoría, nivel e idioma
// ---------------------------------------------------------------------------

/** Reglas en orden: la primera que coincide con el título gana. */
const REGLAS_CATEGORIA: [Categoria, RegExp][] = [
  ["seguridad", /secur|seguridad|ciberseg|infosec|soc analyst|pentest|threat|grc\b|iam\b/],
  ["datos-ia", /\bdata\b|datos|analytics|analista de datos|machine learning|\bml\b|\bai\b|\bia\b|inteligencia artificial|scientist|cientific|\bbi\b|business intelligence|llm|research engineer/],
  ["diseno", /design|disen|ux|ui\b|ilustra|creative|creativ|visual|motion|brand designer/],
  ["producto", /product manager|product owner|gerente de producto|\bpm\b|product lead|head of product|product director|product operations|\bproduct\b(?!.*engineer)/],
  ["software", /engineer|ingenier|developer|desarrollador|programador|devops|\bsre\b|backend|back-end|frontend|front-end|full ?stack|mobile|ios\b|android|qa\b|quality assurance|tester|architect|arquitect|software|tech lead|cloud|infra|platform|sistemas|soporte tecnico|it support|helpdesk/],
  ["ventas", /go.to.market|\bgtm\b|account strategist|sales|ventas|vendedor|account executive|\bae\b|sdr\b|bdr\b|business development|desarrollo de negocio|comercial|account manager|partnership|alianzas|key account|inside sales/],
  ["marketing", /campaign|campana|marketing|mercadotecnia|growth|seo\b|content|contenido|social media|redes sociales|community|comunicacion|communications|\bpr\b|copywriter|brand/],
  ["atencion-clientes", /customer|cliente|support|soporte|success|experiencia|call center|atencion|onboarding specialist/],
  ["finanzas", /fraud|fraude|controller|controllership|\balm\b|financ|accountant|accounting|contador|contab|tesorer|treasury|fp&a|auditor|tax\b|impuesto|payroll|nomina|credit|credito|cobranza|collections|risk|riesgo|billing|facturacion/],
  ["recursos-humanos", /recruit|reclut|talent|talento|\bhr\b|human resources|recursos humanos|people|personas|rrhh|compensation|benefits/],
  ["legal", /legal|lawyer|abogad|counsel|compliance|cumplimiento|regulatory|regulatorio|privacy|juridic/],
  ["operaciones", /operation|operacion|logistic|logistica|supply|cadena de suministro|warehouse|almacen|fleet|flota|procurement|compras|category manager|strateg|estrateg|country manager|general manager|program\b|project manager|program manager|chief of staff|admin|asistente|assistant|office|oficina|analyst|analista|coordinador|coordinator/],
];

export function detectarCategoria(titulo: string, departamento = ""): Categoria {
  const t = plano(titulo);
  for (const [categoria, regla] of REGLAS_CATEGORIA) if (regla.test(t)) return categoria;
  const d = plano(departamento);
  if (d) for (const [categoria, regla] of REGLAS_CATEGORIA) if (regla.test(d)) return categoria;
  return "otros";
}

export function detectarNivel(titulo: string, tipoEmpleo = ""): Nivel {
  const t = plano(`${titulo} ${tipoEmpleo}`);
  if (/intern|internship|becari|practicante|pasante|trainee|estagi|aprendiz|working student|new grad/.test(t)) return "practicante";
  // "Product Manager" o "Account Manager" no son puestos de dirección; estos sí:
  if (/\b(head|director|directora|vp|vice president|chief|cto|cfo|ceo|coo|jefe|jefa|gerente general|country manager|general manager|engineering manager|managing director|manager of|managers)\b/.test(t)) return "gerencia";
  if (/\b(senior|sr\.?|staff|principal|lead|lider|especialista senior|expert)\b|\biii\b|\biv\b/.test(t)) return "senior";
  if (/\b(junior|jr\.?|entry|associate|asociado|trainee)\b|\bi\b(?!i)/.test(t)) return "junior";
  return "intermedio";
}

const PALABRAS_ES = /\b(el|la|los|las|para|con|que|una|del|experiencia|buscamos|requisitos|años|trabajo|equipo|nuestro|nuestra)\b/g;
const PALABRAS_PT = /\b(você|voce|para|com|que|uma|experiência|vaga|requisitos|anos|trabalho|equipe|nosso|nossa|são|não)\b/g;
const PALABRAS_EN = /\b(the|and|with|you|our|for|experience|team|we|are|will|requirements|years|work)\b/g;

export function detectarIdioma(texto: string): "es" | "pt" | "en" {
  const t = texto.toLowerCase().slice(0, 3000);
  const es = (t.match(PALABRAS_ES) ?? []).length;
  const pt = (t.match(PALABRAS_PT) ?? []).length + (t.match(/ção|ções|ão\b/g) ?? []).length * 2;
  const en = (t.match(PALABRAS_EN) ?? []).length;
  if (en >= es && en >= pt) return "en";
  return pt > es ? "pt" : "es";
}

// ---------------------------------------------------------------------------
// Sueldo
// ---------------------------------------------------------------------------

/** Lee el bloque de rango salarial de Greenhouse: <div class="pay-range">…$120,000…$140,000 USD</div> */
export function sueldoDeGreenhouse(html: string): Sueldo | null {
  const h = /&lt;/.test(html) ? decodificar(html) : html;
  const bloque = h.match(/class="pay-range"[\s\S]*?<\/div>/i)?.[0];
  if (!bloque) return null;
  const texto = decodificar(bloque.replace(/<[^>]+>/g, " "));
  const numeros = [...texto.matchAll(/(\d[\d,.]*)\s*(k)?/gi)]
    .map((m) => aNumero(m[1]) * (m[2] ? 1000 : 1))
    .filter((n) => n > 0);
  if (numeros.length === 0) return null;
  const moneda = texto.match(/\b(USD|MXN|BRL|CAD|EUR|GBP|COP|CLP|ARS|PEN)\b/)?.[1] ?? (texto.includes("R$") ? "BRL" : "USD");
  const min = Math.min(...numeros);
  const max = Math.max(...numeros);
  return { min, max, moneda, periodo: periodoPorMonto(max, texto) };
}

function aNumero(s: string): number {
  // "120,000" o "120.000" o "110.4"
  const limpio = /^\d{1,3}([.,]\d{3})+$/.test(s) ? s.replace(/[.,]/g, "") : s.replace(/,/g, "");
  const n = Number(limpio);
  return Number.isFinite(n) ? n : 0;
}

export function periodoPorMonto(max: number, texto = ""): Sueldo["periodo"] {
  const t = plano(texto);
  if (/hour|hora|\/hr|per hr/.test(t)) return "hora";
  if (/month|mes|mensual|mensal/.test(t)) return "mes";
  if (max > 0 && max < 300) return "hora";
  return "año";
}

/** Convierte el intervalo de Ashby ("1 YEAR", "1 MONTH", "1 HOUR") o Lever ("per-year-salary") */
export function periodoDeIntervalo(intervalo: string | undefined | null): Sueldo["periodo"] {
  const i = (intervalo ?? "").toLowerCase();
  if (i.includes("hour")) return "hora";
  if (i.includes("month")) return "mes";
  return "año";
}

// ---------------------------------------------------------------------------
// Ensamblado final
// ---------------------------------------------------------------------------

export function normalizar(cruda: VacanteCruda, empresa: Empresa, ahora = new Date()): Vacante {
  const ubicaciones = (cruda.ubicaciones ?? []).map((u) => (u ?? "").trim()).filter(Boolean);
  const textoUbic = ubicaciones.join(" | ");
  const paises = detectarPaises(textoUbic);
  const modalidad = detectarModalidad(ubicaciones, cruda.titulo, cruda.modalidadAts);
  const titulo = sinMayusculasSostenidas(limpiarTexto(cruda.titulo ?? "").replace(/\s+/g, " ").trim());
  const descripcion = limpiarTexto((cruda.descripcion ?? "").slice(0, 4000));
  const fecha = cruda.publicada ? new Date(cruda.publicada) : ahora;

  return {
    id: `${empresa.slug}:${cruda.idExterno}`,
    empresa_slug: empresa.slug,
    empresa_nombre: empresa.nombre,
    empresa_tipo: empresa.tipo,
    titulo,
    url: cruda.url,
    ubicacion: limpiarTexto(resumirUbicacion(ubicaciones)),
    paises,
    modalidad,
    acepta_latam: aceptaLatam(ubicaciones, modalidad, paises, empresa),
    zonas: detectarZonas(textoUbic),
    categoria: detectarCategoria(titulo, cruda.departamento),
    nivel: detectarNivel(titulo, cruda.tipoEmpleo),
    idioma: descripcion.length > 80 ? detectarIdioma(`${titulo}\n${descripcion}`) : idiomaDelTitulo(titulo, paises),
    ...sueldoCreible(cruda.sueldo),
    descripcion,
    publicada: (Number.isNaN(fecha.getTime()) ? ahora : fecha).toISOString(),
    vista: ahora.toISOString(),
  };
}

/** "PLANEADOR (A) DE MATERIA PRIMA" → "Planeador (a) de materia prima" */
export function sinMayusculasSostenidas(t: string): string {
  const letras = t.replace(/[^\p{L}]/gu, "");
  if (letras.length < 8 || letras !== letras.toUpperCase()) return t;
  const bajo = t.toLowerCase();
  // Respeta siglas cortas conocidas
  return (bajo.charAt(0).toUpperCase() + bajo.slice(1)).replace(/\b(it|qa|ui|ux|ai|ia|hr|rh|sap|erp|crm|sql|aws|b2b|b2c|cdmx|gdl|mty|pyme|ti)\b/g, (m) => m.toUpperCase());
}

/** Sin descripción, el idioma se adivina por el título y el país. */
export function idiomaDelTitulo(titulo: string, paises: string[]): "es" | "pt" | "en" {
  const t = titulo.toLowerCase();
  if (/ção|ções|\b(analista|vaga|estágio|desenvolvedor|gerente de)\b/.test(t) && paises.includes("BR")) return "pt";
  if (/[ñáéíóú¿]|\(a\)|\b(de|del|para|y|ejecutivo|ejecutiva|ingeniero|ingeniera|gerente|analista|auxiliar|coordinador|coordinadora|técnico|tecnico|jefe|asesor|vendedor|practicante|becario)\b/.test(t))
    return "es";
  return "en";
}

function resumirUbicacion(ubicaciones: string[]): string {
  // Primero las ubicaciones de LATAM, que son las que le importan al usuario
  // Primero Cd. Obregón/Sonora, luego el resto de LATAM y al final lo demás
  const peso = (u: string) => (detectarZonas(u).includes("cajeme") ? 3 : detectarZonas(u).length ? 2 : detectarPaises(u).length ? 1 : 0);
  const unicas = [...new Set(ubicaciones.map((u) => u.replace(/(\s*,\s*)+/g, ", ").replace(/^, |, $/g, "").trim()).filter(Boolean))].sort((a, b) => peso(b) - peso(a));
  if (unicas.length === 0) return "Sin ubicación";
  if (unicas.length <= 3) return unicas.join(" · ");
  return `${unicas.slice(0, 3).join(" · ")} y ${unicas.length - 3} más`;
}

/**
 * Quita lo que Postgres o JSON no aceptan: caracteres nulos y mitades de emoji
 * (al cortar un texto a 4000 caracteres un emoji puede quedar partido).
 */
export function limpiarTexto(t: string): string {
  return t.replace(/\u0000/g, "").replace(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g, "");
}

/**
 * Máximo anual creíble por moneda. Más que eso no es un sueldo (becas,
 * fondos, rangos mal capturados) y mejor no mostrarlo.
 */
const TOPE_ANUAL: Record<string, number> = { USD: 1_000_000, EUR: 1_000_000, GBP: 1_000_000, CAD: 1_300_000, MXN: 20_000_000, BRL: 5_000_000 };
const POR_ANIO: Record<string, number> = { hora: 2080, mes: 12, "año": 1 };

export function sueldoCreible(s: Sueldo | null | undefined): Pick<Vacante, "sueldo_min" | "sueldo_max" | "moneda" | "periodo"> {
  const nada = { sueldo_min: null, sueldo_max: null, moneda: null, periodo: null };
  if (!s) return nada;
  const min = redondear(s.min);
  const max = redondear(s.max);
  if (min == null && max == null) return nada;
  const tope = TOPE_ANUAL[s.moneda?.toUpperCase()];
  const anual = (max ?? min ?? 0) * (POR_ANIO[s.periodo] ?? 1);
  if (tope && anual > tope) return nada;
  // Menos de 1 (p. ej. "$0") o un sueldo anual de menos de mil tampoco son reales
  if ((max ?? min ?? 0) < 1 || (s.periodo === "año" && anual < 1000)) return nada;
  return { sueldo_min: min, sueldo_max: max, moneda: s.moneda, periodo: s.periodo };
}

function redondear(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  return n >= 1000 ? Math.round(n / 100) * 100 : Math.round(n * 100) / 100;
}
