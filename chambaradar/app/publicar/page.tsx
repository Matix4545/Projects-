import type { Metadata } from "next";
import Link from "next/link";
import { enviarEnlace } from "@/app/entrar/acciones";
import { FormVacante } from "@/components/FormVacante";
import { Encabezado, Pie } from "@/components/Marco";
import { supabaseSesion, usuarioActual } from "@/lib/supabase/servidor";
import { enviarVacante } from "./acciones";

export const metadata: Metadata = {
  title: "Publica tu vacante gratis",
  description: "¿Tienes un negocio en Cd. Obregón? Publica tus vacantes gratis en ChambaRadar y recibe solicitudes por WhatsApp o correo.",
};

const ESTADO: Record<string, { texto: string; clase: string }> = {
  pendiente: { texto: "En revisión", clase: "bg-amber-100 text-amber-800" },
  publicada: { texto: "Publicada", clase: "bg-radar-claro text-radar-oscuro" },
  rechazada: { texto: "No aprobada", clase: "bg-red-100 text-red-800" },
  retirada: { texto: "Retirada", clase: "bg-slate-100 text-slate-600" },
};

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function Publicar({ searchParams }: Props) {
  const { enviada, error } = await searchParams;
  const usuario = await usuarioActual();
  const mias = usuario
    ? ((await (await supabaseSesion()).from("publicaciones").select("id, puesto, empresa, estado, creada").eq("creada_por", usuario.id).order("creada", { ascending: false }).limit(20)).data ?? [])
    : [];

  return (
    <>
      <Encabezado usuario={usuario} />
      <main className="contenedor max-w-3xl space-y-6 py-8 sm:py-12">
        <div>
          <p className="text-sm font-semibold text-radar-oscuro">Para negocios de Cd. Obregón</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Publica tu vacante gratis</h1>
          <p className="mt-2 text-gris">
            Llega a la gente de Obregón que busca trabajo. Las solicitudes te llegan directo por WhatsApp o correo. La revisamos en menos de 24 horas y
            dura 30 días publicada.
          </p>
        </div>

        {enviada && (
          <p className="rounded-2xl bg-radar-claro p-4 text-sm text-radar-oscuro">
            <strong>¡Recibida!</strong> La revisamos y en cuanto la aprobemos aparece en ChambaRadar. Puedes ver cómo va aquí abajo.
          </p>
        )}
        {error && <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}

        {!usuario ? (
          <div className="space-y-4 rounded-3xl border border-borde bg-white p-6">
            <h2 className="text-lg font-bold">Primero entra con tu correo</h2>
            <p className="text-sm text-gris">Te mandamos un enlace, sin contraseña. Así puedes ver y administrar tus vacantes.</p>
            <form action={enviarEnlace} className="flex flex-col gap-2 sm:flex-row">
              <input type="hidden" name="siguiente" value="/publicar" />
              <input type="email" name="email" required autoComplete="email" placeholder="tu@correo.com" className="campo py-3 text-base" aria-label="Correo" />
              <button className="boton shrink-0">Mandarme el enlace</button>
            </form>
          </div>
        ) : (
          <div className="rounded-3xl border border-borde bg-white p-5 sm:p-7">
            <FormVacante accion={enviarVacante} boton="Enviar vacante" conAviso />
          </div>
        )}

        {mias.length > 0 && (
          <section className="space-y-3 rounded-3xl border border-borde bg-white p-5 sm:p-7">
            <h2 className="text-lg font-bold">Tus vacantes</h2>
            <ul className="divide-y divide-borde">
              {mias.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                  <span className="min-w-0">
                    <span className="block font-medium">{p.puesto}</span>
                    <span className="block text-sm text-gris">{p.empresa}</span>
                  </span>
                  <span className={`chip shrink-0 ${ESTADO[p.estado]?.clase ?? ""}`}>{ESTADO[p.estado]?.texto ?? p.estado}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-sm text-gris">
          ¿Dudas? Escríbenos desde <Link href="/terminos" className="underline">términos y contacto</Link>. Nunca cobres a los candidatos por un empleo.
        </p>
      </main>
      <Pie />
    </>
  );
}
