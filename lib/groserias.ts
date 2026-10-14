// Filtro sencillo de groserías y datos personales para comentarios.
// No es perfecto (ningún filtro lo es): por eso también existe el botón
// "denunciar comentario", que oculta el texto con 3 denuncias.

// Raíces: se bloquea cualquier palabra que EMPIECE así (ya normalizada).
const RAICES = [
  "pendej", "pinche", "pinchi", "ching", "verga", "vergu", "puto", "puta", "putit", "culer", "culo",
  "cabron", "mamon", "mamad", "joto", "jota", "maricon", "marica", "mierd", "ojete", "panoch", "pucha",
  "piruj", "zora", "coger", "cojer", "cogid", "malparid", "estupid", "imbecil", "idiota", "retrasad",
  "huevon", "nalgas", "chichis", "prostitut", "gilipol",
].map(quitarDobles);

// Palabras cortas que se bloquean solo si aparecen completas
const EXACTAS = new Set(["hdp", "ptm", "alv", "pito", "pitos", "nmms", "vrg", "ctm", "pndj"].map(quitarDobles));

// Palabras normales que empiezan como una raíz y NO deben bloquearse
const PERMITIDAS = ["culon", "putrefact", "cabroncit"].map(quitarDobles);

function quitarDobles(s: string) {
  return s.replace(/([a-z])\1+/g, "$1");
}

/** Minúsculas, sin acentos, sin "l33t" (p3nd3j0 → pendejo) y sin letras repetidas. */
export function normalizar(texto: string): string {
  return quitarDobles(
    texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[4@]/g, "a")
      .replace(/3/g, "e")
      .replace(/[1!|]/g, "i")
      .replace(/0/g, "o")
      .replace(/[5$]/g, "s")
      .replace(/7/g, "t")
      .replace(/[^a-z\s]/g, " "),
  );
}

function palabraProhibida(p: string) {
  if (EXACTAS.has(p)) return true;
  if (PERMITIDAS.some((ok) => p.startsWith(ok))) return false;
  return RAICES.some((r) => p.startsWith(r));
}

export function tieneGroserias(texto: string): boolean {
  const palabras = normalizar(texto).split(/\s+/).filter(Boolean);
  if (palabras.some(palabraProhibida)) return true;

  // Letras sueltas separadas por espacios: "p u t o" → "puto"
  let sueltas = "";
  for (const p of [...palabras, ""]) {
    if (p.length === 1) {
      sueltas += p;
    } else {
      if (sueltas.length >= 3 && palabraProhibida(quitarDobles(sueltas))) return true;
      sueltas = "";
    }
  }
  return false;
}

/** Teléfonos, correos y enlaces: no se permiten (privacidad y spam). */
export function tieneDatosPersonales(texto: string): boolean {
  const sinSeparadores = texto.replace(/[\s\-().]/g, "");
  return (
    /\d{8,}/.test(sinSeparadores) ||
    /[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(texto) ||
    /(https?:\/\/|www\.|\.com\b|\.mx\b|\.net\b|\.org\b)/i.test(texto)
  );
}

/** Quita caracteres de control y espacios de más. Devuelve null si queda vacío. */
export function limpiarComentario(texto: unknown): string | null {
  if (typeof texto !== "string") return null;
  const limpio = texto
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return limpio.length ? limpio : null;
}

/** Mensaje de error si el comentario no es aceptable; null si está bien. */
export function revisarComentario(texto: string | null): string | null {
  if (!texto) return null;
  if (tieneGroserias(texto)) return "Tu comentario tiene palabras no permitidas. Corrígelo e intenta de nuevo.";
  if (tieneDatosPersonales(texto)) return "Por privacidad no se permiten teléfonos, correos ni enlaces en los comentarios.";
  return null;
}
