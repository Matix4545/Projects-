import type { Metadata, Viewport } from "next";
import "./globals.css";

// Dominio público para los enlaces de la vista previa (Vercel lo da automáticamente)
const dominio =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

const descripcion =
  "Mapa ciudadano donde vecinos de Ciudad Obregón reportan falta de agua, baches y problemas de drenaje. Anónimo y sin afiliación al gobierno.";

export const metadata: Metadata = {
  metadataBase: new URL(dominio),
  title: "Reporta Cajeme · Agua, baches y drenaje en Ciudad Obregón",
  description: descripcion,
  openGraph: {
    title: "Reporta Cajeme",
    description: descripcion,
    locale: "es_MX",
    type: "website",
    siteName: "Reporta Cajeme",
  },
  twitter: { card: "summary_large_image", title: "Reporta Cajeme", description: descripcion },
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icono.svg", apple: "/icono.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1d4ed8",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX">
      <body className="antialiased">{children}</body>
    </html>
  );
}
