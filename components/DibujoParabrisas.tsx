/**
 * Cómo va el celular: acostado en el parabrisas, viendo la calle.
 * id: prefijo de los ids internos del SVG (distinto si hay dos dibujos en la misma página).
 */
export function DibujoParabrisas({ className = "block w-full", id = "parabrisas" }: { className?: string; id?: string }) {
  return (
    <svg viewBox="0 0 320 132" role="img" aria-label="Celular acostado en el parabrisas, viendo la calle" className={className}>
      <defs>
        <clipPath id={`${id}-p`}>
          <rect width="320" height="132" rx="18" />
        </clipPath>
        <linearGradient id={`${id}-c`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#cfe3fb" />
          <stop offset="1" stopColor="#eef5fd" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${id}-p)`}>
        <rect width="320" height="132" fill={`url(#${id}-c)`} />
        <rect y="70" width="320" height="62" fill="#e4e1d9" />
        <path d="M44 132 L150 70 L170 70 L276 132 Z" fill="#9a9aa0" />
        <path d="M160 74 V132" stroke="#ffffff" strokeWidth="2.5" strokeDasharray="7 8" />
        <ellipse cx="194" cy="96" rx="9" ry="3.2" fill="#48484a" />
        <path d="M0 0 H320 V9 H0 Z" fill="#2c2c2e" />
        <path d="M0 0 L30 0 L6 132 L0 132 Z" fill="#2c2c2e" />
        <path d="M320 0 L290 0 L314 132 L320 132 Z" fill="#2c2c2e" />
        <rect x="138" y="8" width="44" height="13" rx="5" fill="#3a3a3c" />
        <path d="M0 132 V118 Q160 100 320 118 V132 Z" fill="#3a3a3c" />
        <circle cx="160" cy="79" r="6" fill="#48484a" />
        <rect x="156" y="79" width="8" height="10" fill="#48484a" />
        <rect x="116" y="86" width="88" height="42" rx="8" fill="#1c1c1e" />
        <rect x="121" y="90" width="78" height="34" rx="4" fill="#cfe3fb" />
        <path d="M121 108 H199 V124 H121 Z" fill="#e4e1d9" />
        <path d="M128 124 L157 108 L163 108 L192 124 Z" fill="#9a9aa0" />
        <path d="M136 120 L155 110 L165 110 L184 120 Z" fill="#34c759" fillOpacity="0.55" />
        <ellipse cx="166" cy="116" rx="5" ry="1.8" fill="#facc15" stroke="#1c1c1e" strokeWidth="0.6" />
      </g>
      <rect x="0.5" y="0.5" width="319" height="131" rx="17.5" fill="none" stroke="rgba(0,0,0,0.06)" />
    </svg>
  );
}
