import type { Metadata } from "next";
import { Medidor } from "@/components/Medidor";
import { ProveedorTurnstile } from "@/components/Turnstile";

// En prueba: la página existe pero no se anuncia ni aparece en buscadores
export const metadata: Metadata = {
  title: "Medir mi recorrido · Reporta Cajeme",
  description: "Mide el estado de las calles de Cajeme con tu celular mientras manejas.",
  robots: { index: false, follow: false },
};

export default function PaginaMedir() {
  return (
    <ProveedorTurnstile>
      <Medidor />
    </ProveedorTurnstile>
  );
}
