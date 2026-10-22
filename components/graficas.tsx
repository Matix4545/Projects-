// Piezas de tablero compartidas por /panel (privado) y /estadisticas (público).
// Sin "use client": se dibujan en el servidor.

export const num = (n: number) => n.toLocaleString("es-MX");

export function Caja({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto mt-16 max-w-sm rounded-2xl bg-white p-6 shadow">{children}</main>;
}

export function Tarjeta({ titulo, valor, nota }: { titulo: string; valor: string; nota: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 p-3 print:break-inside-avoid">
      <p className="text-xs font-semibold text-gray-500">{titulo}</p>
      <p className="mt-1 text-3xl font-extrabold tabular-nums">{valor}</p>
      <p className="mt-1 text-xs text-gray-500">{nota}</p>
    </div>
  );
}

export function Seccion({ titulo, nota, className = "", children }: { titulo: string; nota?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={`mt-8 print:break-inside-avoid ${className}`}>
      <h2 className="text-lg font-bold">{titulo}</h2>
      {nota && <p className="text-xs text-gray-500">{nota}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function Vacio({ texto = "Sin reportes en este periodo." }: { texto?: string }) {
  return <p className="text-sm text-gray-500">{texto}</p>;
}

export function Barras({
  filas,
  colorBarra = "#2563eb",
}: {
  filas: { etiqueta: string; valor: number; extra?: string; muestra?: string }[];
  colorBarra?: string;
}) {
  if (filas.length === 0) return <Vacio />;
  const max = Math.max(1, ...filas.map((f) => f.valor));
  return (
    <ul className="space-y-2">
      {filas.map((f) => (
        <li key={f.etiqueta} title={`${f.etiqueta}: ${num(f.valor)}${f.extra ? ` (${f.extra})` : ""}`}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="flex items-center gap-2">
              {f.muestra && <span className="inline-block h-3 w-3 rounded-sm" style={{ background: f.muestra }} />}
              {f.etiqueta}
            </span>
            <span className="tabular-nums text-gray-700">
              <strong>{num(f.valor)}</strong>
              {f.extra && <span className="ml-1 text-xs text-gray-500">· {f.extra}</span>}
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-gray-100">
            <div className="h-2 rounded-full" style={{ width: `${(f.valor / max) * 100}%`, background: colorBarra }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Tabla({ encabezados, filas, numericas = [] }: { encabezados: string[]; filas: React.ReactNode[][]; numericas?: number[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-300 text-left text-xs text-gray-500">
            {encabezados.map((e, i) => (
              <th key={e} className={`py-2 pr-3 font-semibold ${numericas.includes(i) ? "text-right" : ""}`}>{e}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i} className="border-b border-gray-100">
              {f.map((c, j) => (
                <td key={j} className={`py-2 pr-3 ${numericas.includes(j) ? "text-right tabular-nums" : ""}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
