import "server-only";

/** Secreto para firmar pedidos y descargas. En producción es obligatorio. */
export function secreto(): string {
  const s = process.env.SECRETO_FIRMA;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("Falta SECRETO_FIRMA (mínimo 32 caracteres). Genera uno con: openssl rand -base64 48");
  }
  return "secreto-solo-para-desarrollo-local-no-usar-en-produccion";
}
