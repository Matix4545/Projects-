// Lectura del encabezado "x-nf-geo" de Netlify (JSON, normalmente en base64).

export interface Geo {
  city?: string;
  country?: { code?: string };
  subdivision?: { code?: string; name?: string };
}

export function leerGeo(valor: string | null | undefined): Geo | null {
  if (!valor) return null;
  for (const texto of [valor, Buffer.from(valor, "base64").toString("utf8")]) {
    try {
      const g = JSON.parse(texto);
      if (g && typeof g === "object") return g as Geo;
    } catch {
      // se intenta el otro formato
    }
  }
  return null;
}

export function esDeSonora(g: Geo | null): boolean {
  if (!g || g.country?.code !== "MX") return false;
  return g.subdivision?.code === "SON" || /sonora/i.test(g.subdivision?.name ?? "");
}
