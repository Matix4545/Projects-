// Generador de escritos (/herramientas/carta): solicitud de reparación con base en el derecho de
// petición (art. 8 constitucional) o reclamación por daños a un vehículo (art. 109, último párrafo).
// Todo se arma en el celular del vecino; nada se envía ni se guarda.

export type TipoEscrito = "reparacion" | "danos";

export const PROBLEMAS = {
  agua: {
    nombre: "Falta de agua, baja presión o agua sucia",
    destinatario: "OOMAPASC\nOrganismo Operador Municipal de Agua Potable, Alcantarillado y Saneamiento de Cajeme",
    pide: "se restablezca el servicio de agua potable con presión y calidad adecuadas, y se me informe la causa de la falla",
  },
  drenaje: {
    nombre: "Drenaje tapado, aguas negras o alcantarilla sin tapa",
    destinatario: "OOMAPASC\nOrganismo Operador Municipal de Agua Potable, Alcantarillado y Saneamiento de Cajeme",
    pide: "se desazolve y repare el drenaje, y se coloque la tapa de la alcantarilla si hace falta",
  },
  bache: {
    nombre: "Bache",
    destinatario: "H. Ayuntamiento de Cajeme",
    pide: "se repare el bache a la brevedad, ya que representa un riesgo para quienes circulan por ahí",
  },
  calle_baches: {
    nombre: "Calle con muchos baches",
    destinatario: "H. Ayuntamiento de Cajeme",
    pide: "se rehabilite la carpeta asfáltica del tramo señalado",
  },
  alumbrado: {
    nombre: "Alumbrado público (lámpara apagada, poste dañado)",
    destinatario: "H. Ayuntamiento de Cajeme",
    pide: "se repare el alumbrado público, ya que la falta de luz pone en riesgo a los vecinos",
  },
  banqueta: {
    nombre: "Banqueta en mal estado u obstruida",
    destinatario: "H. Ayuntamiento de Cajeme",
    pide: "se repare o libere la banqueta para que se pueda caminar con seguridad",
  },
  baldio: {
    nombre: "Baldío con basura, maleza o quema",
    destinatario: "H. Ayuntamiento de Cajeme",
    pide: "se limpie el terreno baldío o se requiera a su propietario que lo limpie y lo mantenga en condiciones",
  },
} as const;
export type Problema = keyof typeof PROBLEMAS;

export type DatosCarta = {
  tipo: TipoEscrito;
  problema: Problema;
  destinatario: string;
  nombre: string;
  domicilio: string;
  contacto: string;
  /** Calle y número o entre qué calles */
  ubicacion: string;
  colonia: string;
  desde: string;
  descripcion: string;
  /** Enlace al reporte en Reporta Cajeme (opcional) */
  enlace: string;
  /** Folio de un reporte oficial anterior (opcional) */
  folio: string;
  // Solo para reclamación por daños
  fechaIncidente: string;
  vehiculo: string;
  danos: string;
  monto: string;
};

export const CARTA_VACIA: DatosCarta = {
  tipo: "reparacion",
  problema: "bache",
  destinatario: PROBLEMAS.bache.destinatario,
  nombre: "",
  domicilio: "",
  contacto: "",
  ubicacion: "",
  colonia: "",
  desde: "",
  descripcion: "",
  enlace: "",
  folio: "",
  fechaIncidente: "",
  vehiculo: "",
  danos: "",
  monto: "",
};

const o = (texto: string, relleno: string) => texto.trim() || relleno;
const conPunto = (texto: string) => (/[.!?]$/.test(texto) ? texto : `${texto}.`);

/** "2026-11-05" → "5 de noviembre de 2026" (lo que no sea fecha se deja igual) */
export function fechaEscrita(valor: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
  return new Date(`${valor}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

/** Arma el texto completo del escrito. Lo que falte se deja como "[espacio para llenar]". */
export function armarCarta(d: DatosCarta, hoy: Date = new Date()): string {
  const fecha = hoy.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Hermosillo" });
  const nombre = o(d.nombre, "[Tu nombre completo]");
  const lugar = `${o(d.ubicacion, "[calle y número, o entre qué calles]")}, colonia ${o(d.colonia, "[colonia]")}, Cajeme, Sonora`;
  const contacto = d.contacto.trim() ? ` y como medio de contacto ${d.contacto.trim()}` : "";
  const montoTexto = d.monto.trim() ? `$${d.monto.trim().replace(/^\$/, "")}` : "[monto]";

  const lineas: string[] = [
    `Ciudad Obregón, Sonora, a ${fecha}.`,
    "",
    o(d.destinatario, "[A quién va dirigido]"),
    "P r e s e n t e.",
    "",
    `${nombre}, por mi propio derecho, señalando como domicilio para oír y recibir notificaciones el ubicado en ${o(d.domicilio, "[tu domicilio]")}${contacto}, con fundamento en el artículo 8 de la Constitución Política de los Estados Unidos Mexicanos, respetuosamente expongo:`,
    "",
  ];

  if (d.tipo === "danos") {
    lineas.push(
      `Que el día ${o(fechaEscrita(d.fechaIncidente), "[fecha]")}, al circular en mi vehículo ${o(d.vehiculo, "[marca, modelo y placas]")} por ${lugar}, caí en un bache que no estaba reparado ni señalizado, lo que causó los siguientes daños: ${conPunto(o(d.danos, "[daños: llanta, rin, suspensión…]"))}`,
    );
    if (d.descripcion.trim()) lineas.push("", conPunto(d.descripcion.trim()));
    lineas.push("", `El costo de la reparación es de ${montoTexto}, según la cotización o factura que anexo.`);
  } else {
    const desde = d.desde.trim() ? ` desde el ${fechaEscrita(d.desde.trim())}` : "";
    lineas.push(`Que${desde} existe el siguiente problema en ${lugar}: ${PROBLEMAS[d.problema].nombre.toLowerCase()}.`);
    if (d.descripcion.trim()) lineas.push("", conPunto(d.descripcion.trim()));
  }

  if (d.folio.trim()) lineas.push("", `Lo reporté previamente con el folio ${d.folio.trim()}, sin que a la fecha se haya atendido.`);
  if (d.enlace.trim())
    lineas.push("", `El problema está registrado de forma pública, con fecha y ubicación, en el mapa ciudadano Reporta Cajeme: ${d.enlace.trim()}`);

  lineas.push("");
  if (d.tipo === "danos") {
    lineas.push(
      "Por lo anterior, y con fundamento además en el último párrafo del artículo 109 de la Constitución Política de los Estados Unidos Mexicanos, que establece que la responsabilidad del Estado por los daños que cause con motivo de su actividad administrativa irregular es objetiva y directa, solicito:",
      "",
      `1. Que se me indemnice por los daños causados a mi vehículo, por la cantidad de ${montoTexto} o la que resulte de la valoración correspondiente.`,
      "2. Que se repare el bache para evitar más accidentes.",
      "3. Que se me informe por escrito el número de expediente y el procedimiento que seguirá mi reclamación.",
      "",
      "Anexo: fotografías del bache y de los daños, cotización o factura de la reparación, copia de mi identificación oficial y de la tarjeta de circulación.",
    );
  } else {
    lineas.push(
      "Por lo anterior, solicito:",
      "",
      `1. Que ${PROBLEMAS[d.problema].pide}.`,
      "2. Que se me informe por escrito el número de folio, el área responsable y la fecha estimada de atención.",
    );
  }

  lineas.push("", "Agradezco de antemano su atención.", "", "A t e n t a m e n t e", "", "", "______________________________", nombre);
  return lineas.join("\n");
}
