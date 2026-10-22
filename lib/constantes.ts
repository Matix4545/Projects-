// Catálogos, etiquetas y colores compartidos entre servidor y navegador.

export const ESTADOS_AGUA = ["sin_agua", "baja_presion", "sucia", "con_agua"] as const;
export type EstadoAgua = (typeof ESTADOS_AGUA)[number];

export const DETALLES_SUCIA = ["mal_olor", "turbia", "sedimentos", "color_extrano"] as const;
export type DetalleSucia = (typeof DETALLES_SUCIA)[number];

// Reportes con pin (ubicación exacta). Para agregar un tipo nuevo hay que
// tocarlo aquí y en el "check" de reportes_pin (supabase/01_esquema.sql).
export const TIPOS_PIN = ["bache", "drenaje", "alumbrado", "banqueta", "baldio", "calle_cerrada", "calle_baches"] as const;
export type TipoPin = (typeof TIPOS_PIN)[number];

export const SUBTIPOS: Record<TipoPin, readonly string[]> = {
  bache: ["chico", "mediano", "grande", "peligroso"],
  drenaje: ["tapado", "aguas_negras", "sin_tapa", "mal_olor"],
  alumbrado: ["apagada", "parpadea", "poste_danado", "cables_expuestos"],
  banqueta: ["quebrada", "incompleta", "obstruida"],
  baldio: ["basura", "maleza", "quema", "escombro"],
  calle_cerrada: ["obra", "inundada", "accidente", "otro_cierre"],
  calle_baches: ["mitad", "toda"],
};

/** Tipos que se marcan como un tramo de calle (línea) en lugar de un punto */
export const TIPOS_LINEA: ReadonlySet<TipoPin> = new Set(["calle_cerrada", "calle_baches"]);
export const esLinea = (tipo: TipoPin) => TIPOS_LINEA.has(tipo);
/** Largo permitido de un tramo de calle, en metros */
export const LARGO_MIN_TRAMO = 20;
export const LARGO_MAX_TRAMO = 3000;

/** Subtipos que se marcan con borde rojo en el mapa */
export const SUBTIPOS_PELIGROSOS = new Set(["peligroso", "sin_tapa", "cables_expuestos", "quema"]);

export const INFO_PIN: Record<TipoPin, { nombre: string; plural: string; emoji: string; color: string; pregunta: string }> = {
  bache: { nombre: "Bache", plural: "Baches", emoji: "🕳️", color: "#facc15", pregunta: "¿De qué tamaño es el bache?" },
  drenaje: { nombre: "Drenaje", plural: "Drenaje", emoji: "🚧", color: "#92400e", pregunta: "¿Qué problema de drenaje?" },
  alumbrado: { nombre: "Alumbrado", plural: "Alumbrado", emoji: "💡", color: "#0ea5e9", pregunta: "¿Qué pasa con la luz?" },
  banqueta: { nombre: "Banqueta", plural: "Banquetas", emoji: "🚶", color: "#ec4899", pregunta: "¿Cómo está la banqueta?" },
  baldio: { nombre: "Baldío", plural: "Baldíos", emoji: "🗑️", color: "#84cc16", pregunta: "¿Qué hay en el baldío?" },
  calle_cerrada: { nombre: "Calle cerrada", plural: "Calles cerradas", emoji: "⛔", color: "#dc2626", pregunta: "¿Por qué está cerrada?" },
  calle_baches: { nombre: "Calle con baches", plural: "Calles con baches", emoji: "🛣️", color: "#facc15", pregunta: "¿Cuánto de la calle tiene baches?" },
};

export const ETIQUETAS: Record<string, string> = {
  sin_agua: "Sin agua",
  baja_presion: "Baja presión",
  sucia: "Agua sucia",
  con_agua: "Con agua",
  mal_olor: "Mal olor",
  turbia: "Turbia",
  sedimentos: "Sedimentos",
  color_extrano: "Color extraño",
  chico: "Chico",
  mediano: "Mediano",
  grande: "Grande",
  peligroso: "Peligroso",
  tapado: "Drenaje tapado",
  aguas_negras: "Aguas negras en la calle",
  sin_tapa: "Alcantarilla sin tapa",
  apagada: "Lámpara apagada o fundida",
  parpadea: "Lámpara que parpadea",
  poste_danado: "Poste dañado o caído",
  cables_expuestos: "Cables expuestos",
  quebrada: "Banqueta quebrada",
  incompleta: "Incompleta o falta un tramo",
  obstruida: "Obstruida (no se puede pasar)",
  basura: "Baldío con basura",
  maleza: "Maleza alta",
  quema: "Quema de basura",
  escombro: "Escombro tirado",
  bache: "Bache",
  drenaje: "Drenaje",
  alumbrado: "Alumbrado",
  banqueta: "Banqueta",
  baldio: "Baldío",
  obra: "Obra o reparación",
  inundada: "Inundada o fuga de agua",
  accidente: "Accidente o algo atravesado",
  otro_cierre: "Otro motivo",
  mitad: "Más de la mitad de la calle",
  toda: "Toda la calle",
  calle_cerrada: "Calle cerrada",
  calle_baches: "Calle con baches",
};

/** "Bache grande", "Drenaje tapado", "Alumbrado: lámpara apagada o fundida"… */
export function tituloReporte({ tipo, subtipo }: { tipo: TipoPin; subtipo: string }) {
  const detalle = ETIQUETAS[subtipo] ?? subtipo;
  if (tipo === "bache") return `Bache ${detalle.toLowerCase()}`;
  if (tipo === "drenaje" || tipo === "baldio") return detalle;
  return `${INFO_PIN[tipo]?.nombre ?? tipo}: ${detalle.toLowerCase()}`;
}

// A quién le toca atenderlo: guía aproximada para el tablero del equipo, no una asignación oficial.
// Las calles cerradas no tienen una dependencia clara y no se cuentan aquí.
export const DEPENDENCIAS: { clave: string; nombre: string; descripcion: string; tipos: TipoPin[] }[] = [
  { clave: "oomapasc", nombre: "OOMAPASC", descripcion: "Agua potable y drenaje", tipos: ["drenaje"] },
  {
    clave: "servicios",
    nombre: "Servicios Públicos / Imagen Urbana",
    descripcion: "Baches, alumbrado, banquetas y baldíos",
    tipos: ["bache", "calle_baches", "alumbrado", "banqueta", "baldio"],
  },
];

export const COLOR_ESTADO: Record<EstadoAgua | "ninguno", string> = {
  sin_agua: "#dc2626", // rojo
  baja_presion: "#f97316", // naranja
  sucia: "#7c3aed", // morado
  con_agua: "#16a34a", // verde
  ninguno: "#9ca3af", // gris
};

export const COLOR_ARREGLADO = "#9ca3af";

// Centro aproximado de Ciudad Obregón y límites del área permitida para reportar
export const CENTRO_OBREGON: [number, number] = [27.4863, -109.9405];
export const LIMITES_CAJEME = { sur: 27.3, norte: 27.65, oeste: -110.15, este: -109.75 };

export function dentroDeCajeme(lat: number, lng: number) {
  return (
    lat >= LIMITES_CAJEME.sur &&
    lat <= LIMITES_CAJEME.norte &&
    lng >= LIMITES_CAJEME.oeste &&
    lng <= LIMITES_CAJEME.este
  );
}

// Periodos para ver los reportes de agua en el mapa (los reportes nunca se borran)
export const PERIODOS = [
  { horas: 24, corto: "24 h", largo: "las últimas 24 h" },
  { horas: 72, corto: "72 h", largo: "las últimas 72 h" },
  { horas: 168, corto: "7 días", largo: "los últimos 7 días" },
] as const;
export type HorasPeriodo = (typeof PERIODOS)[number]["horas"];
export const PERIODO_PREDETERMINADO: HorasPeriodo = 72;
export const textoPeriodo = (horas: number) => PERIODOS.find((p) => p.horas === horas)?.largo ?? `las últimas ${horas} h`;

// Reglas antispam. Por teléfono (cookie) el límite es estricto; por IP es amplio porque
// en datos móviles (Telcel, AT&T…) cientos de vecinos pueden salir con la misma IP.
export const LIMITE_DIARIO_DISPOSITIVO = 10;
export const LIMITE_DIARIO_IP = 60;
// Votos (+1 / arreglado) y denuncias al día
export const LIMITE_DIARIO_INTERACCIONES_DISPOSITIVO = 40;
export const LIMITE_DIARIO_INTERACCIONES_IP = 250;
export const HORAS_ENTRE_REPORTES_AGUA = 6;
export const MAX_COMENTARIO = 280;
export const MAX_FOTO_BYTES = 1024 * 1024;
