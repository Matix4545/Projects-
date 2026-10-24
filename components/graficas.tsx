// Piezas de tablero compartidas por /panel (privado) y /estadisticas (público).
// Sin "use client": se dibujan en el servidor.

export const num = (n: number) => n.toLocaleString("es-MX");

export function Caja({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-ios-fondo px-4 pt-[18vh]">
      <main className="mx-auto max-w-sm rounded-3xl bg-white p-6 shadow-[0_8px_40px_rgba(0,0,0,0.08)]">{children}</main>
    </div>
  );
}

export function Tarjeta({ titulo, valor, nota }: { titulo: string; valor: string; nota: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-4 print:break-inside-avoid print:border print:border-gray-200">
      <p className="text-[13px] font-medium text-ios-secundario">{titulo}</p>
      <p className="mt-1 text-[28px] font-bold leading-tight tracking-tight tabular-nums">{valor}</p>
      <p className="mt-1 text-xs text-ios-secundario">{nota}</p>
    </div>
  );
}

export function Seccion({ titulo, nota, className = "", children }: { titulo: string; nota?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={`mt-7 print:break-inside-avoid ${className}`}>
      <h2 className="px-1 pb-2 text-[20px] font-bold tracking-tight">{titulo}</h2>
      <div className="rounded-2xl bg-white p-4 print:border print:border-gray-200">{children}</div>
      {nota && <p className="px-4 pt-1.5 text-[13px] text-ios-secundario">{nota}</p>}
    </section>
  );
}

export function Vacio({ texto = "Sin reportes en este periodo." }: { texto?: string }) {
  return <p className="text-[15px] text-ios-secundario">{texto}</p>;
}

export function Barras({
  filas,
  colorBarra = "#007aff",
}: {
  filas: { etiqueta: string; valor: number; extra?: string; muestra?: string }[];
  colorBarra?: string;
}) {
  if (filas.length === 0) return <Vacio />;
  const max = Math.max(1, ...filas.map((f) => f.valor));
  return (
    <ul className="space-y-3">
      {filas.map((f) => (
        <li key={f.etiqueta} title={`${f.etiqueta}: ${num(f.valor)}${f.extra ? ` (${f.extra})` : ""}`}>
          <div className="flex items-baseline justify-between gap-2 text-[15px]">
            <span className="flex items-center gap-2">
              {f.muestra && <span className="inline-block h-3 w-3 rounded-sm" style={{ background: f.muestra }} />}
              {f.etiqueta}
            </span>
            <span className="tabular-nums">
              <strong className="font-semibold">{num(f.valor)}</strong>
              {f.extra && <span className="ml-1 text-xs text-ios-secundario">· {f.extra}</span>}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-ios-relleno">
            <div className="h-1.5 rounded-full" style={{ width: `${(f.valor / max) * 100}%`, background: colorBarra }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Tabla({ encabezados, filas, numericas = [] }: { encabezados: string[]; filas: React.ReactNode[][]; numericas?: number[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[15px]">
        <thead>
          <tr className="text-left text-[12px] uppercase tracking-wide text-ios-secundario">
            {encabezados.map((e, i) => (
              <th key={e} className={`pb-2 pr-3 font-medium ${numericas.includes(i) ? "text-right" : ""}`}>{e}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i} className="border-t-[0.5px] border-ios-separador">
              {f.map((c, j) => (
                <td key={j} className={`py-2.5 pr-3 ${numericas.includes(j) ? "text-right tabular-nums" : ""}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
