import type { Metadata } from "next";
import { Encabezado, Pie } from "@/components/Marco";
import { usuarioActual } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Aviso de privacidad" };

// PLANTILLA: antes de lanzar, completa los datos entre [corchetes] y que la revise un abogado.
export default async function Privacidad() {
  const usuario = await usuarioActual();
  return (
    <>
      <Encabezado usuario={usuario} />
      <main className="contenedor max-w-3xl space-y-4 py-10 leading-relaxed text-slate-700 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-tinta">
        <h1 className="text-3xl font-extrabold text-tinta">Aviso de privacidad</h1>
        <p>
          [Nombre o razón social del responsable], con domicilio en [domicilio], es responsable del tratamiento de tus datos personales en
          ChambaRadar, conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.
        </p>
        <h2>Datos que recabamos</h2>
        <p>Tu correo electrónico (para crear tu cuenta y enviarte el enlace de acceso) y el historial de pagos de tu plan. No guardamos los datos de tu tarjeta: los procesa Stripe.</p>
        <h2>Para qué los usamos</h2>
        <p>Para darte acceso a tu cuenta, activar el plan que compraste, enviarte avisos sobre tu cuenta y atender aclaraciones.</p>
        <h2>Con quién los compartimos</h2>
        <p>Con proveedores que nos ayudan a operar el servicio: Supabase (base de datos y cuentas) y Stripe (pagos). No vendemos tus datos.</p>
        <h2>Tus derechos ARCO</h2>
        <p>Puedes pedir acceso, rectificación, cancelación u oposición al uso de tus datos escribiendo a [correo de privacidad]. Te responderemos en un máximo de 20 días hábiles.</p>
        <h2>Cambios a este aviso</h2>
        <p>Publicaremos cualquier cambio en esta página. Última actualización: [fecha].</p>
      </main>
      <Pie />
    </>
  );
}
