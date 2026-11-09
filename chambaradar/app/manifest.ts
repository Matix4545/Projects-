import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ChambaRadar",
    short_name: "ChambaRadar",
    description: "Vacantes en México, LATAM y home office, directo de las páginas de empleo de las empresas.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2563eb",
    lang: "es-MX",
    icons: [
      { src: "/icono-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icono-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icono.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
