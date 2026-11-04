import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";
import { TIENDA, urlSitio } from "@/lib/config";
import { tiposDeCambio } from "@/lib/tipos-cambio";
import { ProveedorTienda } from "@/components/Tienda";
import { Encabezado } from "@/components/Encabezado";
import { Pie } from "@/components/Pie";
import { BotonWhatsApp } from "@/components/BotonWhatsApp";

const titulo = Fraunces({ subsets: ["latin"], variable: "--fuente-titulo", display: "swap" });
const texto = DM_Sans({ subsets: ["latin"], variable: "--fuente-texto", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(urlSitio()),
  title: { default: `${TIENDA.nombre} · ${TIENDA.lema}`, template: `%s · ${TIENDA.nombre}` },
  description: TIENDA.descripcion,
  openGraph: { siteName: TIENDA.nombre, locale: "es_MX", type: "website", description: TIENDA.descripcion },
  icons: { icon: "/icono.svg" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#fbf7f2" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const tasas = await tiposDeCambio();
  return (
    <html lang="es" className={`${titulo.variable} ${texto.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <ProveedorTienda tasas={tasas}>
          <Encabezado />
          <main>{children}</main>
          <Pie />
          <BotonWhatsApp />
        </ProveedorTienda>
      </body>
    </html>
  );
}
