// Íconos de línea (estilo uniforme, 24×24). Heredan el color del texto.
type P = { className?: string };
const base = (className = "size-4") => ({
  className,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const Reloj = ({ className }: P) => (
  <svg {...base(className)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
export const Dinero = ({ className }: P) => (
  <svg {...base(className)}><circle cx="12" cy="12" r="9" /><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .9-3 2s1.3 1.7 3 2 3 .9 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6v12" /></svg>
);
export const Ubicacion = ({ className }: P) => (
  <svg {...base(className)}><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z" /><circle cx="12" cy="9" r="2.5" /></svg>
);
export const Capas = ({ className }: P) => (
  <svg {...base(className)}><path d="m12 3 9 5-9 5-9-5 9-5z" /><path d="m3 13 9 5 9-5" /></svg>
);
export const Lupa = ({ className }: P) => (
  <svg {...base(className)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
);
export const Ajustes = ({ className }: P) => (
  <svg {...base(className)}><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></svg>
);
export const Cerrar = ({ className }: P) => (
  <svg {...base(className)}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const Candado = ({ className }: P) => (
  <svg {...base(className)}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
);
export const Campana = ({ className }: P) => (
  <svg {...base(className)}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>
);
export const Flecha = ({ className }: P) => (
  <svg {...base(className)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const Salir = ({ className }: P) => (
  <svg {...base(className)}><path d="M14 4h5v16h-5M10 17l5-5-5-5M15 12H4" /></svg>
);
export const Palomita = ({ className }: P) => (
  <svg {...base(className)}><path d="m5 12 5 5L20 7" /></svg>
);
export const Tache = ({ className }: P) => (
  <svg {...base(className)}><path d="M7 7l10 10M17 7 7 17" /></svg>
);
