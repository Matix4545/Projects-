import type { Metadata } from "next";
import { EditorCv } from "@/components/EditorCv";
import { Encabezado, Pie } from "@/components/Marco";
import { limpiarCv, type Cv } from "@/lib/cv";
import { supabaseConfigurado, supabaseSesion, usuarioActual } from "@/lib/supabase/servidor";
import { guardarCv } from "./acciones";

export const metadata: Metadata = {
  title: "Haz tu CV gratis",
  description: "Crea tu currículum en minutos, en español o en inglés, y descárgalo en PDF. Gratis y listo para los sistemas de reclutamiento.",
};

export default async function PaginaCv() {
  const usuario = await usuarioActual();
  let inicial: Cv | null = null;
  if (usuario && supabaseConfigurado()) {
    const { data } = await (await supabaseSesion()).rpc("mi_cv");
    if (data) inicial = limpiarCv(data);
  }

  return (
    <>
      <Encabezado usuario={usuario} />
      <main className="contenedor space-y-5 py-8 print:max-w-none print:p-0">
        <div className="max-w-2xl print:hidden">
          <p className="text-sm font-semibold text-radar-oscuro">Gratis</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">Haz tu CV</h1>
          <p className="mt-2 text-gris">
            Llena tus datos, míralo en vivo y descárgalo en PDF. Formato sencillo que leen bien los sistemas de reclutamiento. Para vacantes en dólares, cámbialo a
            inglés.
          </p>
        </div>
        <EditorCv inicial={inicial} conSesion={Boolean(usuario)} guardar={guardarCv} />
      </main>
      <Pie />
    </>
  );
}
