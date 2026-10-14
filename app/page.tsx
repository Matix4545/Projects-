import { App } from "@/components/App";
import { ProveedorTurnstile } from "@/components/Turnstile";

export default function Inicio() {
  return (
    <ProveedorTurnstile>
      <App />
    </ProveedorTurnstile>
  );
}
