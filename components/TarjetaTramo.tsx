import { Equis } from "./HojaInferior";
import { COLOR_CLASE, UMBRALES, clasificar, type MedicionTramo } from "@/lib/rugosidad";

const NOMBRE = { buena: "Buena", regular: "Regular", mala: "Mala" } as const;
const VEHICULO: Record<string, string> = { auto: "Auto", camioneta: "Camioneta", pickup: "Pickup", moto: "Moto", otro: "Otro" };
const fecha = (f: string) => new Date(`${f}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
const n2 = (x: number) => x.toFixed(2);

/** Mapa del equipo: mediciones de rugosidad de la cuadra que se tocó (para calibrar). */
export function TarjetaTramo({ mediciones, onCerrar }: { mediciones: MedicionTramo[]; onCerrar: () => void }) {
  const [m, ...otras] = mediciones;
  const clase = clasificar(m.rms);
  const promedio = mediciones.reduce((s, x) => s + x.rms, 0) / mediciones.length;
  return (
    <div className="fixed inset-x-3 top-32 z-[1002] mx-auto max-w-sm material rounded-2xl px-4 py-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-base font-bold">
            <span className="inline-block h-2 w-6 rounded-full" style={{ background: COLOR_CLASE[clase] }} />
            Rugosidad {n2(m.rms)} · {NOMBRE[clase]}
          </p>
          <p className="mt-0.5 text-ios-secundario">
            {Math.round(m.vel_kmh)} km/h · {fecha(m.fecha)} · {VEHICULO[m.vehiculo] ?? m.vehiculo} · {m.n_golpes}{" "}
            {m.n_golpes === 1 ? "golpe" : "golpes"} · tramo de {m.largo_m} m
          </p>
          {m.nota && <p className="mt-0.5 text-xs font-semibold text-ios-azul">🧪 {m.nota}</p>}
        </div>
        <button onClick={onCerrar} aria-label="Cerrar" className="cerrar">
          <Equis />
        </button>
      </div>

      {otras.length > 0 && (
        <div className="mt-2 border-t border-gray-100 pt-2">
          <p className="text-xs font-semibold text-ios-secundario">
            {mediciones.length} pasadas por aquí · promedio {n2(promedio)}
          </p>
          <ul className="mt-1 space-y-0.5 tabular-nums">
            {otras.slice(0, 6).map((x, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: COLOR_CLASE[clasificar(x.rms)] }} />
                <strong>{n2(x.rms)}</strong> · {Math.round(x.vel_kmh)} km/h · {fecha(x.fecha)} · {VEHICULO[x.vehiculo] ?? x.vehiculo}
                {x.nota && <span className="truncate text-xs text-ios-azul">· 🧪 {x.nota}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-2 text-xs text-ios-terciario">
        Escala provisional (m/s²): buena &lt; {UMBRALES.regular.toFixed(1)} · regular {UMBRALES.regular.toFixed(1)}–{UMBRALES.mala.toFixed(1)} · mala
        ≥ {UMBRALES.mala.toFixed(1)}. Más velocidad suele dar números más altos.
      </p>
    </div>
  );
}
