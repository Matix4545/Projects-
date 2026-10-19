import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Acerca de · Reporta Cajeme",
  description: "Qué es Reporta Cajeme, cómo se usan los datos y aviso de privacidad.",
};

const contacto = process.env.NEXT_PUBLIC_CONTACTO;

export default function Acerca() {
  return (
    <main className="mx-auto max-w-2xl bg-white px-5 pb-16 pt-6 leading-relaxed text-gray-800 sm:my-6 sm:rounded-2xl sm:shadow">
      <Link href="/" className="font-semibold text-blue-700 underline">
        ← Volver al mapa
      </Link>

      <h1 className="mt-4 text-2xl font-extrabold text-gray-900">Acerca de Reporta Cajeme</h1>

      <p className="mt-3">
        Reporta Cajeme es un mapa ciudadano donde los vecinos de Ciudad Obregón y el municipio de Cajeme, Sonora,
        comparten lo que viven con los servicios públicos: falta de agua, baja presión, agua sucia, baches,
        problemas de drenaje, alumbrado público, banquetas en mal estado y baldíos con basura.
      </p>

      <div className="mt-4 rounded-xl border-l-4 border-amber-500 bg-amber-50 p-4">
        <p className="font-bold">Importante</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>
            <strong>No tenemos ninguna afiliación</strong> con el Ayuntamiento de Cajeme, OOMAPASC, el Gobierno de
            Sonora ni ningún partido político.
          </li>
          <li>
            Los datos son la <strong>percepción de los vecinos</strong>. No son análisis oficiales ni de laboratorio.
            Que una colonia aparezca con “agua sucia” significa que vecinos así lo reportaron, no que se haya medido la
            calidad del agua.
          </li>
          <li>
            Reportar aquí <strong>no sustituye</strong> el reporte oficial ante el organismo correspondiente.
          </li>
        </ul>
      </div>

      <h2 className="mt-8 text-xl font-bold text-gray-900">¿Cómo funciona?</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>
          <strong>Agua:</strong> se reporta por colonia. El color de cada colonia es el estado que más se reportó en las
          últimas 24 horas (en empate gana el más grave). Gris significa que no hay reportes recientes.
        </li>
        <li>
          <strong>Baches, drenaje, alumbrado, banquetas y baldíos:</strong> se marcan con un punto en el lugar exacto. Otros vecinos pueden confirmar
          con “+1”. Cuando 3 vecinos indican que ya lo arreglaron, el punto se muestra en gris durante 7 días y luego
          desaparece. Los reportes sin actividad en 60 días se archivan.
        </li>
        <li>
          Para evitar abusos: cada dispositivo puede reportar el agua de una misma colonia una vez cada 6 horas, y cada
          conexión puede enviar hasta 10 reportes al día.
        </li>
      </ul>

      <h2 id="privacidad" className="mt-8 text-xl font-bold text-gray-900">
        Aviso de privacidad
      </h2>
      <p className="mt-2">
        Este aviso explica qué datos se recaban y para qué, en apego a la Ley Federal de Protección de Datos Personales
        en Posesión de los Particulares.
      </p>

      <h3 className="mt-4 font-bold">Lo que NO pedimos</h3>
      <p>No pedimos nombre, teléfono, correo electrónico ni ninguna cuenta. Los reportes son anónimos.</p>

      <h3 className="mt-4 font-bold">Lo que sí guardamos</h3>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        <li>
          <strong>El reporte:</strong> tipo de problema, fecha y hora, y comentario si lo escribiste.
        </li>
        <li>
          <strong>Ubicación:</strong> en reportes de agua solo guardamos la colonia, no tu punto exacto. En los demás
          reportes guardamos el punto del problema que marcaste, que es público en el mapa.
        </li>
        <li>
          <strong>Fotos:</strong> antes de guardarlas eliminamos todos sus metadatos (EXIF), incluida la ubicación GPS y
          el modelo del teléfono. Evita fotografiar rostros o placas.
        </li>
        <li>
          <strong>Datos técnicos anónimos:</strong> para frenar el spam guardamos una “huella” cifrada e irreversible
          (hash) de tu dirección IP y de un identificador aleatorio que se guarda en una cookie de tu navegador. No
          guardamos tu IP real y estas huellas nunca se muestran públicamente.
        </li>
      </ul>

      <h3 className="mt-4 font-bold">Servicios de terceros</h3>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        <li>
          <strong>Cloudflare Turnstile</strong> verifica que quien envía sea una persona y no un robot. Cloudflare
          procesa datos técnicos de tu navegador según su propia política de privacidad.
        </li>
        <li>
          <strong>Supabase</strong> (base de datos y fotos), <strong>Vercel</strong> (hospedaje) y los mapas de{" "}
          <strong>OpenStreetMap</strong>.
        </li>
      </ul>

      <h3 className="mt-4 font-bold">Para qué se usan</h3>
      <p>
        Únicamente para mostrar en el mapa el estado de los servicios públicos y para evitar abusos. No vendemos ni
        compartimos datos. La información agregada (conteos por colonia) es pública.
      </p>

      <h3 className="mt-4 font-bold">Comentarios</h3>
      <p>
        No escribas datos personales tuyos ni de otras personas. Los comentarios con groserías, teléfonos, correos o
        enlaces se rechazan. Cualquier vecino puede denunciar un comentario o una foto: con 3 denuncias se oculta
        automáticamente.
      </p>

      <h3 className="mt-4 font-bold">Tus derechos</h3>
      <p>
        Como no pedimos datos de identificación, no podemos asociar un reporte a una persona. Si crees que un reporte o
        foto expone datos personales, escríbenos para retirarlo
        {contacto ? (
          <>
            {" "}
            a <a className="text-blue-700 underline" href={`mailto:${contacto}`}>{contacto}</a>
          </>
        ) : null}
        .
      </p>

      <p className="mt-8 text-sm text-gray-500">
        Mapa © colaboradores de{" "}
        <a className="underline" href="https://www.openstreetmap.org/copyright">
          OpenStreetMap
        </a>
        . Límites de colonias: mapa público de colonias del municipio de Cajeme publicado por el{" "}
        <a className="underline" href="https://imipcajeme.org">
          IMIP Cajeme
        </a>
        . Proyecto ciudadano sin fines de lucro.
      </p>
    </main>
  );
}
