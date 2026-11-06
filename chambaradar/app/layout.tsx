import { Suspense } from "react";
import { Contador } from "@/components/Contador";
import { MetaPixel } from "@/components/MetaPixel";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

const TITULO_COMPARTIR = "ChambaRadar · Vacantes que no están en OCC ni LinkedIn";

const descripcion =
  "Encuentra vacantes que no están en LinkedIn, OCC ni Indeed: las sacamos directo de las páginas de empleo de empresas en México, LATAM y de empresas que contratan remoto en dólares.";

export const metadata: Metadata = {
  // Siempre el dominio de producción, para que og:image y las canónicas sean absolutas
  metadataBase: new URL("https://chambaradar.com"),
  title: { default: "ChambaRadar · Vacantes ocultas en México y LATAM", template: "%s · ChambaRadar" },
  description: descripcion,
  openGraph: { title: TITULO_COMPARTIR, description: descripcion, locale: "es_MX", type: "website", siteName: "ChambaRadar" },
  twitter: { card: "summary_large_image", title: TITULO_COMPARTIR, description: descripcion },
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
          <MetaPixel />
        </Suspense>
      </body>
    </html>
  );
}
