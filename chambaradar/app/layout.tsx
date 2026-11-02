import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { urlSitio } from "@/lib/sitio";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

const descripcion =
  "Empleos en Ciudad Obregón y trabajos remotos (home office) para todo México, sacados directo de las páginas de empleo de las empresas. Menos competencia que en LinkedIn u OCC.";

export const metadata: Metadata = {
  metadataBase: new URL(urlSitio()),
  title: { default: "ChambaRadar · Empleos en Cd. Obregón y home office", template: "%s · ChambaRadar" },
  description: descripcion,
  openGraph: { title: "ChambaRadar", description: descripcion, locale: "es_MX", type: "website", siteName: "ChambaRadar" },
  twitter: { card: "summary", title: "ChambaRadar", description: descripcion },
  icons: { icon: [{ url: "/icono.svg", type: "image/svg+xml" }] },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0b1324" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX" className={inter.variable}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
