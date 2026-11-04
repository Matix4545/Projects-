// Logo: aguja con hilo que traza una curva de patrón. Cámbialo por el tuyo.
export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" fill="#c2552d" />
      <path d="M7 23c4-1 6-5 9-9s6-6 9-6" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeDasharray="2.6 2.6" />
      <path d="M21 6.5l4.5 4.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="7" cy="23" r="2.2" fill="#fff" />
    </svg>
  );
}
