import type { Metadata } from "next";
import { Medidor } from "@/components/Medidor";
import { ProveedorTurnstile } from "@/components/Turnstile";

// En prueba: la página existe pero no se anuncia ni aparece en buscadores.
// Tiene su propio manifiesto: al agregarla a la pantalla de inicio queda como la app "Medir baches",
// que abre directo aquí (y no en el mapa).
export const metadata: Metadata = {
  title: "Medir baches · Reporta Cajeme",
  description: "Ábrela, toca Empezar y maneja: encuentra los baches, los mide y los sube a Reporta Cajeme.",
  robots: { index: false, follow: false },
  manifest: "/medir.webmanifest",
  icons: { icon: [{ url: "/medir-192.png", sizes: "192x192" }], apple: "/medir-apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Medir baches", statusBarStyle: "default" },
};

export default function PaginaMedir() {
  return (
    <ProveedorTurnstile>
      <Medidor />
    </ProveedorTurnstile>
  );
}
