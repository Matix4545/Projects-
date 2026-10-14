import "server-only";
import sharp from "sharp";
import { MAX_FOTO_BYTES } from "./constantes";

/**
 * Re-codifica la foto como JPEG nuevo. Esto:
 *  - elimina TODOS los metadatos (EXIF, GPS, modelo de cámara, etc.),
 *    porque sharp no copia metadatos a menos que se le pida;
 *  - aplica la rotación del EXIF antes de quitarlo, para que no salga de lado;
 *  - la reduce a máx. 1600 px y la deja por debajo de 1 MB.
 * Si el archivo no es una imagen válida, lanza un error.
 */
export async function limpiarFoto(entrada: Buffer): Promise<Buffer> {
  const base = sharp(entrada, { failOn: "error", limitInputPixels: 40_000_000 })
    .rotate()
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true });

  for (const calidad of [80, 68, 55, 40]) {
    const salida = await base.clone().jpeg({ quality: calidad, mozjpeg: true }).toBuffer();
    if (salida.length <= MAX_FOTO_BYTES) return salida;
  }
  // Último recurso: más pequeña
  return base.clone().resize(1000, 1000, { fit: "inside" }).jpeg({ quality: 50 }).toBuffer();
}
