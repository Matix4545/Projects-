import type { Metadata } from "next";
import { Encabezado, Pie } from "@/components/Marco";
import { CORREO_CONTACTO, DOMICILIO, RESPONSABLE, ULTIMA_ACTUALIZACION } from "@/lib/legal";
import { PLANES } from "@/lib/planes";
import { usuarioActual } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Términos y condiciones" };

export default async function Terminos() {
  const usuario = await usuarioActual();
  const correo = (
    <a href={`mailto:${CORREO_CONTACTO}`} className="font-medium text-radar-oscuro underline">
      {CORREO_CONTACTO}
    </a>
  );
  return (
    <>
      <Encabezado usuario={usuario} />
      <main className="contenedor max-w-3xl space-y-4 py-10 leading-relaxed text-slate-700 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-tinta [&_li]:ml-5 [&_li]:list-disc">
        <h1 className="text-3xl font-extrabold text-tinta">Términos y condiciones</h1>
        <p className="text-sm text-gris">Última actualización: {ULTIMA_ACTUALIZACION}</p>

        <h2>1. Quiénes somos</h2>
        <p>
          ChambaRadar es un servicio operado por {RESPONSABLE}, con domicilio en {DOMICILIO}, México. Contacto: {correo}. Al usar el sitio
          aceptas estos términos; si no estás de acuerdo, por favor no lo uses.
        </p>

        <h2>2. Qué hace ChambaRadar</h2>
        <p>
          Reunimos vacantes que las empresas publican en sus propias páginas de empleo y te enviamos a esas páginas para que apliques
          directamente. <strong>No somos agencia de colocación ni de reclutamiento</strong>, no representamos a las empresas, no participamos
          en sus procesos de selección y no garantizamos que consigas entrevistas o un empleo.
        </p>

        <h2>3. Información de las vacantes</h2>
        <p>
          La información de cada vacante (puesto, requisitos, sueldo, ubicación y modalidad) la publica la empresa. Revisamos las vacantes
          todos los días y las clasificamos de forma automática, pero pueden cerrarse, cambiar o contener errores en cualquier momento.
          Verifica siempre los detalles en la página oficial de la empresa antes de aplicar.
        </p>
        <p>
          <strong>Ninguna empresa legítima te debe cobrar por contratarte.</strong> Si alguien te pide dinero a cambio de un empleo, no pagues
          y avísanos a {correo}.
        </p>

        <h2>4. Cuenta</h2>
        <p>
          Para comprar un plan necesitas una cuenta con tu correo. Entras con un enlace que te mandamos; no lo compartas. Tu cuenta y tu
          acceso son personales e intransferibles.
        </p>

        <h2>5. Planes, precios y pagos</h2>
        <ul>
          {PLANES.map((p) => (
            <li key={p.id}>
              {p.nombre}: ${p.precio} MXN (precio final) por {p.dias} días de acceso.
            </li>
          ))}
        </ul>
        <p>
          Son <strong>pagos únicos</strong>: no se renuevan ni se cobran de forma automática. El acceso empieza cuando se confirma el pago (con
          tarjeta, al momento; con OXXO, cuando pagas la ficha en tienda, lo que puede tardar algunas horas). Si compras otro plan mientras
          tienes uno activo, los días se suman. Los pagos los procesa Stripe.
        </p>

        <h2>6. Reembolsos</h2>
        <p>
          Si se te cobró dos veces, si pagaste y no recibiste acceso, o si el servicio no funcionó durante tu plan por causas atribuibles a
          nosotros, escríbenos a {correo} dentro de los 30 días siguientes y te reembolsamos o compensamos con días de acceso, a tu elección.
          Fuera de esos casos, por tratarse de un servicio digital que se entrega de inmediato, no hay reembolsos por días no usados. Esto
          no limita los derechos que te otorga la Ley Federal de Protección al Consumidor.
        </p>

        <h2>7. Uso permitido</h2>
        <p>No está permitido:</p>
        <ul>
          <li>Compartir tu cuenta o revender el acceso.</li>
          <li>Copiar, descargar o redistribuir de forma masiva la información del sitio, incluso con programas automáticos.</li>
          <li>Intentar saltarte el muro de pago o afectar el funcionamiento del sitio.</li>
        </ul>
        <p>Si detectamos estos usos podemos suspender la cuenta sin reembolso.</p>

        <h2>8. Marcas y empresas</h2>
        <p>
          Los nombres y marcas de las empresas que aparecen en ChambaRadar pertenecen a sus dueños y se usan solo para identificar sus
          vacantes; no implican relación ni patrocinio. Si representas a una empresa y quieres que corrijamos o retiremos tus vacantes,
          escríbenos a {correo} y lo haremos a la brevedad.
        </p>

        <h2>9. Responsabilidad</h2>
        <p>
          Hacemos nuestro mejor esfuerzo para que el sitio funcione siempre, pero puede haber interrupciones. No somos responsables de las
          decisiones de contratación de las empresas ni del contenido de sus páginas. En todo caso, nuestra responsabilidad máxima frente a ti
          es el monto que pagaste por tu plan vigente.
        </p>

        <h2>10. Privacidad</h2>
        <p>
          El uso de tus datos se rige por nuestro{" "}
          <a href="/privacidad" className="font-medium text-radar-oscuro underline">
            aviso de privacidad
          </a>
          .
        </p>

        <h2>11. Cambios y ley aplicable</h2>
        <p>
          Podemos actualizar estos términos; los cambios aplican desde que se publican en esta página y no afectan los planes ya pagados.
          Estos términos se rigen por las leyes de los Estados Unidos Mexicanos. Para cualquier controversia, las partes se someten a los
          tribunales competentes del domicilio del responsable, sin perjuicio de tu derecho de acudir a la Procuraduría Federal del
          Consumidor (PROFECO).
        </p>
      </main>
      <Pie />
    </>
  );
}
