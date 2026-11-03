import { Suspense } from "react";
import { Contador } from "@/components/Contador";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { urlSitio } from "@/lib/sitio";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

const descripcion =
  "Encuentra vacantes que no están en LinkedIn, OCC ni Indeed: las sacamos directo de las páginas de empleo de empresas en México, LATAM y de empresas que contratan remoto en dólares.";

export const metadata: Metadata = {
  metadataBase: new URL(urlSitio()),
  title: { default: "ChambaRadar · Vacantes ocultas en México y LATAM", template: "%s · ChambaRadar" },
  description: descripcion,
  openGraph: { title: "ChambaRadar", description: descripcion, locale: "es_MX", type: "website", siteName: "ChambaRadar" },
  twitter: { card: "summary", title: "ChambaRadar", description: descripcion },
  icons: { icon: [{ url: "/favicon.ico", sizes: "48x48" }, { url: "/icon.png", type: "image/png", sizes: "512x512" }, { url: "/icono.svg", type: "image/svg+xml" }], apple: "/apple-icon.png" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX" className={inter.variable}>
      <body className="min-h-screen antialiased">
        {children}
        <Suspense fallback={null}>
          <Contador />
        </Suspense>
      </body>
    </html>
  );
}
