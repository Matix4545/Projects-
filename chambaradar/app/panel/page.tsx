import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormVacante } from "@/components/FormVacante";
import { Encabezado, Pie } from "@/components/Marco";
import { formatoSueldo, haceCuanto } from "@/lib/formato";
import { supabaseConfigurado, supabaseSesion, usuarioActual } from "@/lib/supabase/servidor";
import type { Periodo } from "@/lib/tipos";
import { capturarVacante, revisarVacante } from "./acciones";

export const metadata: Metadata = { title: "Panel", robots: { index: false } };

interface Publicacion {
  id: string;
  estado: string;
  origen: string;
  empresa: string;
  puesto: string;
  ubicacion: string;
  sueldo_min: number | null;
  sueldo_max: number | null;
  periodo: Periodo | null;
  horario: string | null;
  descripcion: string;
  contacto_whatsapp: string | null;
  contacto_correo: string | null;
  contacto_url: string | null;
  creada: string;
}

function Boton({ id, accion, texto, clase }: { id: string; accion: string; texto: string; clase: string }) {
  return (
    <form action={revisarVacante}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="accion" value={accion} />
      <button className={clase}>{texto}</button>
    </form>
  );
}

function Tarjeta({ p, children }: { p: Publicacion; children: React.ReactNode }) {
  const sueldo = formatoSueldo(p.sueldo_min, p.sueldo_max, p.sueldo_min || p.sueldo_max ? "MXN" : null, p.periodo);
  return (
    <li className="space-y-2 rounded-2xl border border-borde bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{p.puesto}</p>
          <p className="text-sm text-gris">
            {p.empresa} · {p.ubicacion} · {p.origen === "captura" ? "capturada por ti" : "enviada por el negocio"} · <span suppressHydrationWarning>{haceCuanto(p.creada)}</span>
          </p>
        </div>
        <div className="flex gap-2">{children}</div>
      </div>
      {sueldo && <p className="text-sm font-medium text-amber-600">{sueldo}</p>}
      <p className="text-sm text-slate-600">
        {[p.horario && `Horario: ${p.horario}`, p.contacto_whatsapp && `WhatsApp: ${p.contacto_whatsapp}`, p.contacto_correo, p.contacto_url].filter(Boolean).join(" · ")}
      </p>
      {p.descripcion && (
        <details>
          <summary className="cursor-pointer text-sm text-gris">Descripción</summary>
          <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{p.descripcion}</p>
        </details>
      )}
    </li>
  );
}

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function Panel({ searchParams }: Props) {
  const { error, publicada } = await searchParams;
  if (!supabaseConfigurado()) notFound();
  const usuario = await usuarioActual();
  if (!usuario) notFound();
  const sb = await supabaseSesion();
  const { data: admin } = await sb.rpc("es_admin");
  if (!admin) notFound();

  const [{ data: pendientes }, { data: publicadas }] = await Promise.all([
    sb.from("publicaciones").select("*").eq("estado", "pendiente").order("creada"),
    sb.from("publicaciones").select("*").eq("estado", "publicada").order("revisada", { ascending: false }).limit(30),
  ]);

  return (
    <>
      <Encabezado usuario={usuario} />
      <main className="contenedor max-w-4xl space-y-10 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight">Panel</h1>
          <Link href="/panel/trafico" className="boton px-4 py-2 text-sm">
            Ver tráfico del sitio
          </Link>
        </div>
        {error && <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        {publicada && <p className="rounded-2xl bg-radar-claro p-4 text-sm text-radar-oscuro">Publicada. Ya aparece en Vacantes (primero en Obregón).</p>}

        <section className="space-y-3">
          <h2 className="text-xl font-bold">Pendientes de revisar ({pendientes?.length ?? 0})</h2>
          {!pendientes?.length ? (
            <p className="text-sm text-gris">No hay vacantes esperando.</p>
          ) : (
            <ul className="space-y-3">
              {(pendientes as Publicacion[]).map((p) => (
                <Tarjeta key={p.id} p={p}>
                  <Boton id={p.id} accion="aprobar" texto="Aprobar" clase="boton px-4 py-2 text-sm" />
                  <Boton id={p.id} accion="rechazar" texto="Rechazar" clase="boton-secundario px-4 py-2 text-sm" />
                </Tarjeta>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-xl font-bold">Capturar vacante</h2>
            <p className="text-sm text-gris">
              Pega el texto de una publicación y revisa los campos. Usa el contacto del negocio, no el teléfono personal de quien publicó, y de preferencia avísale al negocio.
            </p>
          </div>
          <div className="rounded-3xl border border-borde bg-white p-5 sm:p-7">
            <FormVacante accion={capturarVacante} boton="Publicar ahora" conCaptura />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">Publicadas recientemente</h2>
          {!publicadas?.length ? (
            <p className="text-sm text-gris">Todavía no hay vacantes publicadas directo.</p>
          ) : (
            <ul className="space-y-3">
              {(publicadas as Publicacion[]).map((p) => (
                <Tarjeta key={p.id} p={p}>
                  <Boton id={p.id} accion="retirar" texto="Retirar" clase="boton-secundario px-4 py-2 text-sm" />
                </Tarjeta>
              ))}
            </ul>
          )}
        </section>
      </main>
      <Pie />
    </>
  );
}
