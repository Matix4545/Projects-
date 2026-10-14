// Catálogos, etiquetas y colores compartidos entre servidor y navegador.

export const ESTADOS_AGUA = ["sin_agua", "baja_presion", "sucia", "con_agua"] as const;
export type EstadoAgua = (typeof ESTADOS_AGUA)[number];

export const DETALLES_SUCIA = ["mal_olor", "turbia", "sedimentos", "color_extrano"] as const;
export type DetalleSucia = (typeof DETALLES_SUCIA)[number];

export const TAMANOS_BACHE = ["chico", "mediano", "grande", "peligroso"] as const;
export const TIPOS_DRENAJE = ["tapado", "aguas_negras", "sin_tapa", "mal_olor"] as const;
export type TipoPin = "bache" | "drenaje";

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
  bache: "Bache",
  drenaje: "Drenaje",
};

export const COLOR_ESTADO: Record<EstadoAgua | "ninguno", string> = {
  sin_agua: "#dc2626", // rojo
  baja_presion: "#f97316", // naranja
  sucia: "#7c3aed", // morado
  con_agua: "#16a34a", // verde
  ninguno: "#9ca3af", // gris
};

export const COLOR_PIN = {
  bache: "#facc15",
  drenaje: "#92400e",
  arreglado: "#9ca3af",
};

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

// Reglas antispam
export const LIMITE_DIARIO_IP = 10;
// Votos (+1 / arreglado) y denuncias por IP al día
export const LIMITE_DIARIO_INTERACCIONES_IP = 40;
export const HORAS_ENTRE_REPORTES_AGUA = 6;
export const MAX_COMENTARIO = 280;
export const MAX_FOTO_BYTES = 1024 * 1024;
