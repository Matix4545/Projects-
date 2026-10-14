import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reporta Cajeme · Agua, baches y drenaje en Ciudad Obregón",
  description:
    "Mapa ciudadano donde vecinos de Ciudad Obregón reportan falta de agua, baches y problemas de drenaje. Sin afiliación al gobierno.",
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
