import { crearAlerta } from "@/app/alertas/acciones";
import { describirFiltros, type FiltrosAlerta } from "@/lib/alertas";
import { Campana } from "./Iconos";

const MENSAJES: Record<string, { texto: string; clase: string }> = {
  creada: { texto: "Listo: te mandaremos estas vacantes por correo en cuanto aparezcan nuevas (máximo un correo al día).", clase: "bg-radar-claro text-radar-oscuro" },
  limite: { texto: "Ya tienes 10 alertas. Borra alguna en Mi cuenta para crear otra.", clase: "bg-amber-50 text-amber-900" },
  error: { texto: "No pudimos guardar la alerta. Inténtalo de nuevo en un momento.", clase: "bg-red-50 text-red-800" },
};

/** Botón para guardar la búsqueda actual como alerta por correo. */
export function BotonAlerta({ filtros, vuelta, estado, correoActivo }: { filtros: FiltrosAlerta; vuelta: string; estado?: string; correoActivo: boolean }) {
  const mensaje = estado ? MENSAJES[estado] : undefined;
  return (
    <div className="space-y-2">
      <form action={crearAlerta} className="flex items-center gap-3 rounded-2xl border border-borde bg-white px-4 py-3">
        <input type="hidden" name="filtros" value={JSON.stringify(filtros)} />
        <input type="hidden" name="vuelta" value={vuelta} />
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-radar-claro text-radar-oscuro">
          <Campana className="size-4" />
        </span>
        <p className="min-w-0 flex-1 text-sm leading-snug">
          <span className="font-semibold">Recibe las nuevas por correo</span>
          <span className="block truncate text-gris">{describirFiltros(filtros)}</span>
        </p>
        <button className="boton-contorno shrink-0 border-radar/40 bg-white text-radar-oscuro hover:bg-radar-claro">Crear alerta</button>
      </form>
      {mensaje && <p className={`rounded-xl p-3 text-sm ${mensaje.clase}`}>{mensaje.texto}</p>}
      {estado === "creada" && !correoActivo && (
        <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">Los correos de alertas empiezan a salir en los próximos días; tu alerta ya quedó guardada.</p>
      )}
    </div>
  );
}
