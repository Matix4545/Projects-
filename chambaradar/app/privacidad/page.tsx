import type { Metadata } from "next";
import { Encabezado, Pie } from "@/components/Marco";
import { CORREO_CONTACTO, DOMICILIO, RESPONSABLE, ULTIMA_ACTUALIZACION } from "@/lib/legal";
import { usuarioActual } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Aviso de privacidad" };

export default async function Privacidad() {
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
        <h1 className="text-3xl font-extrabold text-tinta">Aviso de privacidad integral</h1>
        <p className="text-sm text-gris">Última actualización: {ULTIMA_ACTUALIZACION}</p>

        <h2>1. Quién es el responsable de tus datos</h2>
        <p>
          {RESPONSABLE}, persona física con domicilio en {DOMICILIO}, México (en adelante, “ChambaRadar”), es responsable del tratamiento
          de tus datos personales, conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares y su
          normatividad aplicable. Para cualquier tema de privacidad escríbenos a {correo}.
        </p>

        <h2>2. Qué datos recabamos</h2>
        <ul>
          <li>
            <strong>Identificación y contacto:</strong> tu correo electrónico, que usas para crear tu cuenta y entrar sin contraseña.
          </li>
          <li>
            <strong>Datos de tu compra:</strong> el plan que compraste, la fecha, el monto y el identificador del pago. Los datos de tu tarjeta o
            de tu pago en OXXO los recibe y procesa directamente Stripe; ChambaRadar <strong>nunca</strong> ve ni guarda los números de tu
            tarjeta.
          </li>
          <li>
            <strong>Datos técnicos:</strong> la cookie de sesión que te mantiene conectado y los registros técnicos (dirección IP, navegador,
            fecha y hora) que generan automáticamente nuestros proveedores de alojamiento por seguridad.
          </li>
        </ul>
        <p>No recabamos datos personales sensibles. No necesitas subir tu CV ni datos laborales para usar el sitio.</p>

        <h2>3. Para qué los usamos</h2>
        <p>Finalidades necesarias para darte el servicio:</p>
        <ul>
          <li>Crear y administrar tu cuenta, y enviarte el enlace para entrar.</li>
          <li>Activar, verificar y llevar el control del plan que compraste.</li>
          <li>Atender tus dudas, aclaraciones de pagos y solicitudes de reembolso.</li>
          <li>Proteger el sitio contra abusos y fraudes.</li>
          <li>Cumplir obligaciones legales, fiscales y contables.</li>
        </ul>
        <p>
          Finalidad adicional (no necesaria): enviarte, solo si lo pides, avisos de vacantes nuevas o novedades de ChambaRadar. Puedes
          negarte en cualquier momento escribiendo a {correo} o con el enlace para darte de baja que viene en cada correo. Negarte no
          afecta tu acceso.
        </p>

        <h2>4. Con quién compartimos tus datos</h2>
        <p>
          Solo con proveedores que nos ayudan a operar el servicio y que tratan los datos por cuenta nuestra, bajo sus propias medidas de
          seguridad y confidencialidad:
        </p>
        <ul>
          <li>
            <strong>Supabase</strong> (base de datos y cuentas de usuario).
          </li>
          <li>
            <strong>Stripe</strong> (procesamiento de pagos con tarjeta y OXXO).
          </li>
          <li>
            <strong>Netlify</strong> (alojamiento del sitio).
          </li>
        </ul>
        <p>
          Estos proveedores pueden guardar la información en servidores fuera de México, principalmente en Estados Unidos. No vendemos,
          rentamos ni compartimos tus datos con las empresas que publican vacantes ni con terceros para publicidad. Solo los entregaríamos a
          una autoridad si una ley o una orden válida nos obliga.
        </p>

        <h2>5. Tus derechos ARCO y cómo ejercerlos</h2>
        <p>
          Tienes derecho a <strong>Acceder</strong> a tus datos, <strong>Rectificarlos</strong> si son inexactos, <strong>Cancelarlos</strong>{" "}
          cuando ya no sean necesarios y <strong>Oponerte</strong> a su uso para fines específicos. Para ejercerlos manda un correo a {correo}{" "}
          con:
        </p>
        <ul>
          <li>Tu nombre y el correo con el que usas ChambaRadar (para responderte).</li>
          <li>Un documento que acredite tu identidad o, en su caso, la de tu representante.</li>
          <li>Qué derecho quieres ejercer y sobre qué datos, con una descripción clara.</li>
        </ul>
        <p>
          Te responderemos en un máximo de 20 días hábiles y, si procede, lo haremos efectivo dentro de los 15 días hábiles siguientes. Si no
          estás conforme con la respuesta, puedes acudir ante la autoridad competente en materia de protección de datos personales.
        </p>

        <h2>6. Cómo revocar tu consentimiento o limitar el uso</h2>
        <p>
          Puedes revocar tu consentimiento o pedir que limitemos el uso de tus datos escribiendo a {correo}. Ten en cuenta que, si revocas el
          uso de tu correo, ya no podremos darte acceso a tu cuenta. Algunos datos de pagos debemos conservarlos el tiempo que marcan las
          leyes fiscales.
        </p>

        <h2>7. Cookies</h2>
        <p>
          Usamos solo las cookies necesarias para mantener tu sesión iniciada. No usamos cookies de publicidad ni de rastreo de terceros. Si
          las bloqueas en tu navegador, podrás ver la vista previa pero no iniciar sesión.
        </p>

        <h2>8. Cuánto tiempo guardamos tus datos</h2>
        <p>
          Mientras tengas una cuenta. Si pides cancelarla, borramos tus datos, salvo los registros de pagos que la ley nos obliga a guardar,
          que se conservan bloqueados solo para ese fin.
        </p>

        <h2>9. Cambios a este aviso</h2>
        <p>Si cambiamos este aviso lo publicaremos en esta misma página, con la nueva fecha de actualización.</p>
      </main>
      <Pie />
    </>
  );
}
