import type { Metadata, Viewport } from "next";
import { DOMINIO } from "@/lib/sitio";
import "./globals.css";

const descripcion =
  "Mapa ciudadano donde vecinos de Ciudad Obregón reportan falta de agua, baches, drenaje, alumbrado, banquetas y baldíos. Anónimo y sin afiliación al gobierno.";

export const metadata: Metadata = {
  metadataBase: new URL(DOMINIO),
  title: "Reporta Cajeme · Agua, baches, alumbrado y más en Ciudad Obregón",
  description: descripcion,
  // Google Search Console: para ver qué búsquedas traen gente a cada página (ver docs/estrategia-contenido.md)
  verification: process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : undefined,
  openGraph: {
    title: "Reporta Cajeme",
    description: descripcion,
    locale: "es_MX",
    type: "website",
    siteName: "Reporta Cajeme",
  },
  twitter: { card: "summary_large_image", title: "Reporta Cajeme", description: descripcion },
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/icono.svg", type: "image/svg+xml" }, { url: "/icono-192.png", sizes: "192x192" }], apple: "/apple-touch-icon.png" },
  // Al instalarla en iPhone: abre como app, con el nombre corto bajo el ícono
  appleWebApp: { capable: true, title: "Reporta", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f2f2f7",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX">
      <body className="antialiased">{children}</body>
    </html>
  );
}
