// Herramientas gratis, sin registro, que resuelven algo cercano a los reportes y terminan
// invitando a reportar. Se listan en /herramientas, en el sitemap y en /llms.txt.

export type Herramienta = { slug: string; emoji: string; titulo: string; tituloSeo: string; descripcion: string };

export const HERRAMIENTAS: Herramienta[] = [
  {
    slug: "tinaco",
    emoji: "🛢️",
    titulo: "¿Cuántos días te dura el agua del tinaco?",
    tituloSeo: "Calculadora: ¿cuántos días me dura el agua del tinaco?",
    descripcion: "Pon el tamaño de tu tinaco o cisterna y cuántos viven en tu casa: te dice cuántos días te alcanza el agua.",
  },
  {
    slug: "carta",
    emoji: "✍️",
    titulo: "Escrito de petición o reclamación",
    tituloSeo: "Generador de escrito de petición al Ayuntamiento de Cajeme",
    descripcion:
      "Arma en 2 minutos un escrito formal (art. 8 constitucional) para pedir que reparen un bache, el agua o el alumbrado, o para reclamar daños a tu carro.",
  },
  {
    slug: "costo-baches",
    emoji: "🧮",
    titulo: "¿Cuánto te cuestan los baches al año?",
    tituloSeo: "Calculadora: ¿cuánto me cuestan los baches al año?",
    descripcion: "Estima cuánto gastas de más en gasolina, llantas y suspensión por manejar en calles en mal estado.",
  },
];

export const herramientaPorSlug = (slug: string) => HERRAMIENTAS.find((h) => h.slug === slug);
