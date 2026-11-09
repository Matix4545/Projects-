import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Encabezado, Pie } from "@/components/Marco";
import { rutaSegura } from "@/lib/sitio";
import { supabaseConfigurado, usuarioActual } from "@/lib/supabase/servidor";
import { enviarEnlace } from "./acciones";

export const metadata: Metadata = { title: "Entrar", robots: { index: false } };

const ERRORES: Record<string, string> = {
  correo: "Ese correo no parece válido.",
  envio: "No pudimos mandar el correo. Espera un minuto e inténtalo de nuevo.",
  enlace: "El enlace ya expiró o ya se usó. Pide uno nuevo.",
};

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function Entrar({ searchParams }: Props) {
  const { error, enviado, siguiente } = await searchParams;
  const usuario = await usuarioActual();
  if (usuario) redirect(rutaSegura(siguiente));

  return (
    <>
      <Encabezado usuario={null} />
      <main className="contenedor flex justify-center py-14">
        <div className="w-full max-w-md rounded-2xl border border-borde bg-white p-6 shadow-sm sm:p-8">
          {enviado ? (
            <div className="space-y-3 text-center">
              <p className="text-4xl">📬</p>
              <h1 className="text-2xl font-bold">Revisa tu correo</h1>
              <p className="text-gris">Te mandamos un enlace para entrar. Ábrelo desde este mismo dispositivo. Si no llega, revisa spam.</p>
            </div>
          ) : (
            <form action={enviarEnlace} className="space-y-4">
              <div>
                <h1 className="text-2xl font-bold">Entra a ChambaRadar</h1>
                <p className="mt-1 text-sm text-gris">Sin contraseña: te mandamos un enlace a tu correo.</p>
              </div>
              {!supabaseConfigurado() && (
                <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Las cuentas todavía no están activadas en este sitio.</p>
              )}
              {error && ERRORES[error] && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{ERRORES[error]}</p>}
              <input type="hidden" name="siguiente" value={rutaSegura(siguiente)} />
              <label className="block space-y-1 text-sm font-medium">
                Correo electrónico
                <input type="email" name="email" required autoComplete="email" placeholder="tu@correo.com" className="campo text-base" />
              </label>
              <button className="boton w-full" disabled={!supabaseConfigurado()}>
                Mandarme el enlace
              </button>
              <p className="text-xs text-gris">
                Al continuar aceptas los <a href="/terminos" className="underline">términos</a> y el{" "}
                <a href="/privacidad" className="underline">aviso de privacidad</a>.
              </p>
            </form>
          )}
        </div>
      </main>
      <Pie />
    </>
  );
}
