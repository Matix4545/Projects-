import type { Metadata } from "next";
import { LICENCIAS, TIENDA } from "@/lib/config";
import { formatearCobro } from "@/lib/dinero";

export const metadata: Metadata = {
  title: "Licencias, términos y privacidad",
  description: "Qué puedes hacer con cada licencia, términos de compra y aviso de privacidad.",
};

// NOTA PARA LA DUEÑA/EL DUEÑO DE LA TIENDA: este texto es una base razonable,
// pero revísalo con un abogado o contador de tu país antes de publicar.

export default function Licencia() {
  return (
    <div className="prosa mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-titulo text-4xl font-semibold">Licencias y términos</h1>

      <h2>Licencia personal (incluida)</h2>
      <ul>
        <li>Puedes imprimir el patrón las veces que quieras y coser todas las prendas que quieras para ti, tu familia o para regalar.</li>
        <li>Puedes mostrar tus prendas en redes sociales (¡nos encanta que nos etiquetes!).</li>
        <li>No puedes vender las prendas cosidas con este patrón.</li>
      </ul>

      <h2>Licencia emprendedora (+{formatearCobro(LICENCIAS.emprendedora.extra)} por patrón)</h2>
      <ul>
        <li>Todo lo de la licencia personal.</li>
        <li>Puedes vender las prendas terminadas, sin límite de piezas, en tienda física, en línea o en bazares.</li>
        <li>Aplica para ti o un taller de hasta 5 personas. Para producción mayor, escríbenos.</li>
        <li>Puedes usar el nombre del patrón al vender (por ejemplo &ldquo;hecho con el patrón Amapola de {TIENDA.nombre}&rdquo;), pero no es obligatorio.</li>
      </ul>

      <h2>Ninguna licencia permite</h2>
      <ul>
        <li>Compartir, revender, regalar o subir los archivos (PDF, DXF o instructivo), completos o en partes, impresos o digitales.</li>
        <li>Usar el patrón para dar clases o talleres sin nuestro permiso por escrito.</li>
        <li>Modificar el patrón y venderlo como un patrón propio.</li>
      </ul>

      <h2>Compra y entrega</h2>
      <p>
        Los precios están en pesos mexicanos ({TIENDA.monedaCobro}) e incluyen impuestos. Los pagos se procesan con Mercado Pago o
        Stripe; nosotros nunca vemos ni guardamos los datos de tu tarjeta. Los archivos se entregan en formato digital al confirmarse
        el pago. Por ser productos digitales de entrega inmediata, no hay devoluciones una vez descargados; si hay un error en el
        archivo, lo corregimos o te damos otro patrón.
      </p>

      <h2 id="privacidad">Aviso de privacidad</h2>
      <p>
        {TIENDA.nombre} es responsable del tratamiento de tus datos personales. Solo recibimos tu nombre y correo electrónico a
        través del proveedor de pago, y los usamos para entregarte tus patrones, darte soporte y, si lo aceptas, avisarte de patrones
        nuevos. No vendemos ni compartimos tus datos con terceros, salvo los proveedores necesarios para cobrar y enviar correos.
      </p>
      <p>
        Para acceder, corregir, cancelar u oponerte al uso de tus datos (derechos ARCO), escríbenos a{" "}
        <a href={`mailto:${TIENDA.correo}`}>{TIENDA.correo}</a>.
      </p>
    </div>
  );
}
