import type { Metadata } from "next";
import Link from "next/link";
import { version } from "@/package.json";

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
        problemas de drenaje, alumbrado público, banquetas en mal estado, baldíos con basura y calles cerradas o llenas de baches.
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
          <strong>Agua:</strong> se reporta por colonia. El color de cada colonia es el estado que más se reportó en
          los últimos 7 días (abajo en el mapa también puedes ver solo 24 o 72 horas). En empate gana el más grave. Si
          un vecino reporta que ya hay agua, la colonia se pone en verde y solo cuentan los reportes que lleguen después.
          Si nadie reporta en 7 días, la colonia vuelve a gris. Los reportes no se borran: solo cambia lo que se muestra.
        </li>
        <li>
          <strong>Baches, drenaje, alumbrado, banquetas y baldíos:</strong> se marcan con un punto en el lugar exacto. Otros vecinos pueden confirmar
          con “+1”. Cuando 3 vecinos indican que ya lo arreglaron, el punto se muestra en gris durante 7 días y luego
          desaparece. Los reportes sin actividad en 60 días se archivan.
        </li>
        <li>
          <strong>Calles cerradas y calles con baches:</strong> se marcan tocando dónde empieza y dónde termina el tramo;
          la línea sigue la calle usando las rutas de OpenStreetMap. Rojo: calle cerrada. Amarillo: más de la mitad de
          la calle con baches. Se quitan cuando 3 vecinos confirman que ya la abrieron o la arreglaron.
        </li>
        <li>
          Para evitar abusos: cada dispositivo puede reportar el agua de una misma colonia una vez cada 6 horas, y cada
          teléfono puede enviar hasta 10 reportes al día.
        </li>
      </ul>

      <h2 id="rugosidad" className="mt-8 text-xl font-bold text-gray-900">
        Cómo medimos el estado de las calles <span className="text-sm font-normal text-gray-500">(en prueba)</span>
      </h2>
      <p className="mt-2">
        Con <Link href="/medir" className="text-blue-700 underline">Medir mi recorrido</Link>, el celular en un soporte firme mide qué tanto se
        sacude el vehículo mientras manejas:
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>
          El acelerómetro separa la sacudida vertical de la gravedad (así no importa si el celular va inclinado) y solo
          se usan las lecturas a más de 15 km/h.
        </li>
        <li>
          Cada tramo de unos 100 m recibe un valor de <strong>rugosidad</strong>: la sacudida vertical promedio (RMS, en
          m/s²), la misma forma de resumir vibraciones que usa la norma ISO 2631. Las sacudidas muy fuertes se marcan
          como golpes (baches, topes o vados).
        </li>
        <li>
          Es un método “tipo respuesta”, como los que describe el Banco Mundial: el número depende del vehículo y de la
          velocidad, así que <strong>todavía no es el IRI oficial</strong> (Índice de Rugosidad Internacional, en m/km).
          Para convertirlo hay que calibrarlo con calles cuyo IRI esté medido con perfilómetro. Por ahora sirve para
          comparar calles entre sí.
        </li>
      </ul>
      <p className="mt-2 text-sm text-gray-600">
        Fuentes: Sayers, Gillespie y Queiroz, <em>Guidelines for Conducting and Calibrating Road Roughness
        Measurements</em> (Banco Mundial, Technical Paper 46, 1986) y norma ASTM E1926 (definición del IRI);{" "}
        <a className="text-blue-700 underline" href="https://softteco.com/projects/roadlab" target="_blank" rel="noreferrer">RoadLab Pro</a> (app del
        Banco Mundial que estima el IRI con celulares); estudios de calibración con celulares de la{" "}
        <a className="text-blue-700 underline" href="https://www.ideals.illinois.edu/items/98616" target="_blank" rel="noreferrer">Universidad de Illinois</a>{" "}
        y la{" "}
        <a className="text-blue-700 underline" href="https://repositorio.ufc.br/handle/riufc/52918?mode=full" target="_blank" rel="noreferrer">Universidad Federal de Ceará</a>; y, para el costo que la rugosidad causa a los vehículos, el modelo HDM-4 del Banco Mundial y el{" "}
        <a className="text-blue-700 underline" href="https://www.nap.edu/read/22808/chapter/8" target="_blank" rel="noreferrer">NCHRP (National Academies)</a>.
      </p>

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
        <li>
          <strong>Medir mi recorrido:</strong> solo los tramos de calle con su rugosidad, velocidad promedio, golpes, la
          fecha (sin hora), el tipo de vehículo, dónde va el celular, si es Android o iPhone (no el modelo) y, si la
          escribes, la nota de un recorrido de prueba. No se guarda nada de 150 a 250 m alrededor de donde empiezas, terminas
          o te detienes más de 2 minutos, para no revelar tu casa ni otros lugares a los que vas.
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
      <p className="mt-2 text-xs text-gray-400">Versión {version.split(".").slice(0, 2).join(".")}</p>
    </main>
  );
}
