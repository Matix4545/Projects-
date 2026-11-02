import type { Metadata } from "next";
import { Encabezado, Pie } from "@/components/Marco";
import { usuarioActual } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Términos y condiciones" };

// PLANTILLA: antes de lanzar, completa los datos entre [corchetes] y que la revise un abogado.
export default async function Terminos() {
  const usuario = await usuarioActual();
  return (
    <>
      <Encabezado usuario={usuario} />
      <main className="contenedor max-w-3xl space-y-4 py-10 leading-relaxed text-slate-700 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-tinta">
        <h1 className="text-3xl font-extrabold text-tinta">Términos y condiciones</h1>
        <h2>Qué es ChambaRadar</h2>
        <p>
          ChambaRadar reúne vacantes publicadas por las empresas en sus propias páginas de empleo y te envía a esas páginas para que apliques.
          No somos agencia de colocación, no representamos a las empresas y no garantizamos que te contraten.
        </p>
        <h2>Información de las vacantes</h2>
        <p>
          Las vacantes, sueldos y requisitos los publica cada empresa. Hacemos lo posible por mantenerlas al día (se revisan diario), pero pueden
          cerrarse o cambiar en cualquier momento. Verifica siempre los detalles en la página de la empresa. Nunca pagues a nadie por un
          empleo.
        </p>
        <h2>Planes y pagos</h2>
        <p>
          Los planes son pagos únicos por el periodo indicado (7, 30 o 365 días) y no se renuevan automáticamente. El acceso empieza cuando se
          confirma el pago. Si tienes un problema con tu pago escríbenos a [correo de soporte] dentro de los primeros 7 días.
        </p>
        <h2>Uso permitido</h2>
        <p>Tu acceso es personal. No está permitido compartir tu cuenta ni copiar o revender de forma masiva la información del sitio.</p>
        <h2>Empresas</h2>
        <p>Si eres una empresa y quieres que actualicemos o retiremos tus vacantes, escríbenos a [correo] y lo haremos a la brevedad.</p>
        <h2>Contacto</h2>
        <p>[Nombre o razón social] · [domicilio] · [correo]. Última actualización: [fecha].</p>
      </main>
      <Pie />
    </>
  );
}
