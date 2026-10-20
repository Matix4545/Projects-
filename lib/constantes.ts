// Catálogos, etiquetas y colores compartidos entre servidor y navegador.

export const ESTADOS_AGUA = ["sin_agua", "baja_presion", "sucia", "con_agua"] as const;
export type EstadoAgua = (typeof ESTADOS_AGUA)[number];

export const DETALLES_SUCIA = ["mal_olor", "turbia", "sedimentos", "color_extrano"] as const;
export type DetalleSucia = (typeof DETALLES_SUCIA)[number];

// Reportes con pin (ubicación exacta). Para agregar un tipo nuevo hay que
// tocarlo aquí y en el "check" de reportes_pin (supabase/01_esquema.sql).
export const TIPOS_PIN = ["bache", "drenaje", "alumbrado", "banqueta", "baldio"] as const;
export type TipoPin = (typeof TIPOS_PIN)[number];

export const SUBTIPOS: Record<TipoPin, readonly string[]> = {
  bache: ["chico", "mediano", "grande", "peligroso"],
  drenaje: ["tapado", "aguas_negras", "sin_tapa", "mal_olor"],
  alumbrado: ["apagada", "parpadea", "poste_danado", "cables_expuestos"],
  banqueta: ["quebrada", "incompleta", "obstruida"],
  baldio: ["basura", "maleza", "quema", "escombro"],
};

/** Subtipos que se marcan con borde rojo en el mapa */
export const SUBTIPOS_PELIGROSOS = new Set(["peligroso", "sin_tapa", "cables_expuestos", "quema"]);

export const INFO_PIN: Record<TipoPin, { nombre: string; plural: string; emoji: string; color: string; pregunta: string }> = {
  bache: { nombre: "Bache", plural: "Baches", emoji: "🕳️", color: "#facc15", pregunta: "¿De qué tamaño es el bache?" },
  drenaje: { nombre: "Drenaje", plural: "Drenaje", emoji: "🚧", color: "#92400e", pregunta: "¿Qué problema de drenaje?" },
  alumbrado: { nombre: "Alumbrado", plural: "Alumbrado", emoji: "💡", color: "#0ea5e9", pregunta: "¿Qué pasa con la luz?" },
  banqueta: { nombre: "Banqueta", plural: "Banquetas", emoji: "🚶", color: "#ec4899", pregunta: "¿Cómo está la banqueta?" },
  baldio: { nombre: "Baldío", plural: "Baldíos", emoji: "🗑️", color: "#84cc16", pregunta: "¿Qué hay en el baldío?" },
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
};

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
