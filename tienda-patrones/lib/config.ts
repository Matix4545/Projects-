// ─────────────────────────────────────────────────────────────────────────────
//  CONFIGURACIÓN DE LA TIENDA — cambia aquí nombre, contacto, precios de licencia
//  y monedas. Todo lo demás del sitio toma los datos de este archivo.
// ─────────────────────────────────────────────────────────────────────────────

export const TIENDA = {
  /** Nombre de la marca. Cámbialo por el tuyo. */
  nombre: "Trazo",
  lema: "Patrones digitales de costura",
  descripcion:
    "Patrones de costura digitales trazados en CAD, con tallas de XS a 4XL calculadas para estatura latina. Descarga al instante en PDF Carta, A4, plotter y DXF.",
  /** País y moneda en que COBRAS (la de tu cuenta de Mercado Pago / Stripe). */
  monedaCobro: "MXN" as const,
  /** WhatsApp con código de país, solo números (ej. 5216441234567). Vacío = se oculta el botón. */
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP ?? "",
  correo: process.env.NEXT_PUBLIC_CORREO_CONTACTO ?? "hola@tutienda.com",
  instagram: process.env.NEXT_PUBLIC_INSTAGRAM ?? "",
  /** Máximo de patrones por compra (Mercado Pago limita la referencia a 256 caracteres). */
  maxArticulos: 10,
};

// ── Licencias ────────────────────────────────────────────────────────────────
// La licencia "emprendedora" es un diferenciador fuerte en LatAm: muchas costureras
// venden lo que cosen. Las tiendas internacionales casi nunca la ofrecen barata.
export type Licencia = "personal" | "emprendedora";

export const LICENCIAS: Record<Licencia, { nombre: string; extra: number; resumen: string }> = {
  personal: {
    nombre: "Personal",
    extra: 0,
    resumen: "Cose para ti, tu familia o para regalar.",
  },
  emprendedora: {
    nombre: "Emprendedora",
    extra: 120, // MXN que se suman al precio del patrón
    resumen: "Vende las prendas que cosas tú o tu taller (hasta 5 personas), sin límite de piezas.",
  },
};

// ── Formatos que se entregan ─────────────────────────────────────────────────
// La clave es también el nombre del archivo en el almacenamiento:
//   patrones/<slug>/<clave>.<ext>   (ej. patrones/vestido-amapola/carta.pdf)
export type Formato = "carta" | "a4" | "plotter" | "proyector" | "dxf" | "instructivo";

export const FORMATOS: Record<Formato, { nombre: string; detalle: string; ext: string }> = {
  carta: { nombre: "PDF tamaño Carta", detalle: "Para imprimir en casa (impresora normal).", ext: "pdf" },
  a4: { nombre: "PDF tamaño A4", detalle: "Para impresoras con papel A4.", ext: "pdf" },
  plotter: { nombre: "PDF plotter 90 cm", detalle: "Imprime en una sola hoja en cualquier centro de copiado.", ext: "pdf" },
  proyector: { nombre: "PDF para proyector", detalle: "Líneas gruesas para cortar con proyector.", ext: "pdf" },
  dxf: { nombre: "DXF (CAD)", detalle: "Para AutoCAD, Audaces, Optitex o tu plotter de corte.", ext: "dxf" },
  instructivo: { nombre: "Instructivo ilustrado", detalle: "Paso a paso en español con dibujos.", ext: "pdf" },
};

export const FORMATOS_TODOS: Formato[] = ["carta", "a4", "plotter", "proyector", "dxf", "instructivo"];

// ── Países y monedas ─────────────────────────────────────────────────────────
// Se COBRA siempre en `TIENDA.monedaCobro`. Las demás monedas solo muestran un
// precio aproximado. `porUSD` es un respaldo: si hay internet, el sitio usa el
// tipo de cambio del día (ver lib/tipos-cambio.ts).
export type Pais = {
  codigo: string;
  nombre: string;
  moneda: string;
  porUSD: number; // unidades de la moneda local por 1 USD (respaldo)
  decimales: 0 | 2;
};

export const PAISES: Pais[] = [
  { codigo: "MX", nombre: "México", moneda: "MXN", porUSD: 18.5, decimales: 0 },
  { codigo: "CO", nombre: "Colombia", moneda: "COP", porUSD: 4000, decimales: 0 },
  { codigo: "AR", nombre: "Argentina", moneda: "ARS", porUSD: 1400, decimales: 0 },
  { codigo: "CL", nombre: "Chile", moneda: "CLP", porUSD: 950, decimales: 0 },
  { codigo: "PE", nombre: "Perú", moneda: "PEN", porUSD: 3.6, decimales: 2 },
  { codigo: "EC", nombre: "Ecuador", moneda: "USD", porUSD: 1, decimales: 2 },
  { codigo: "GT", nombre: "Guatemala", moneda: "GTQ", porUSD: 7.7, decimales: 2 },
  { codigo: "CR", nombre: "Costa Rica", moneda: "CRC", porUSD: 505, decimales: 0 },
  { codigo: "DO", nombre: "Rep. Dominicana", moneda: "DOP", porUSD: 63, decimales: 0 },
  { codigo: "UY", nombre: "Uruguay", moneda: "UYU", porUSD: 40, decimales: 0 },
  { codigo: "BO", nombre: "Bolivia", moneda: "BOB", porUSD: 6.9, decimales: 2 },
  { codigo: "PY", nombre: "Paraguay", moneda: "PYG", porUSD: 7500, decimales: 0 },
  { codigo: "PA", nombre: "Panamá", moneda: "USD", porUSD: 1, decimales: 2 },
  { codigo: "SV", nombre: "El Salvador", moneda: "USD", porUSD: 1, decimales: 2 },
  { codigo: "HN", nombre: "Honduras", moneda: "HNL", porUSD: 26, decimales: 2 },
  { codigo: "US", nombre: "Estados Unidos", moneda: "USD", porUSD: 1, decimales: 2 },
  { codigo: "ES", nombre: "España", moneda: "EUR", porUSD: 0.92, decimales: 2 },
];

export const PAIS_PREDETERMINADO = "MX";

/** URL pública del sitio (para ligas de regreso del pago y correos). */
export function urlSitio(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
  ).replace(/\/$/, "");
}
