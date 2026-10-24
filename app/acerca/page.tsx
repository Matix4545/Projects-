import type { Metadata } from "next";
import Link from "next/link";
import { Bloque, Pagina } from "@/components/Pagina";
import { version } from "@/package.json";

export const metadata: Metadata = {
  title: "Acerca de · Reporta Cajeme",
  description: "Qué es Reporta Cajeme, cómo se usan los datos y aviso de privacidad.",
};

const contacto = process.env.NEXT_PUBLIC_CONTACTO;

export default function Acerca() {
  return (
    <Pagina titulo="Acerca de" subtitulo="Reporta Cajeme · Proyecto ciudadano">
      <Bloque>
      <div className="space-y-3 text-[16px] leading-relaxed">
      <p>
        Reporta Cajeme es un mapa ciudadano donde los vecinos de Ciudad Obregón y el municipio de Cajeme, Sonora,
        comparten lo que viven con los servicios públicos: falta de agua, baja presión, agua sucia, baches,
        problemas de drenaje, alumbrado público, banquetas en mal estado, baldíos con basura y calles cerradas o llenas de baches.
      </p>

      <div className="rounded-xl bg-ios-naranja/10 p-4">
        <p className="font-semibold text-[#c93400]">Importante</p>
        <ul className="list-disc space-y-1.5 pl-5">
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

      </div>
      </Bloque>

      <Bloque titulo="¿Cómo funciona?">
      <ul className="list-disc space-y-2 pl-5 text-[16px] leading-relaxed">
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

      </Bloque>

      <Bloque id="rugosidad" titulo="Cómo medimos el estado de las calles (en prueba)">
      <div className="space-y-2 text-[16px] leading-relaxed">
      <p>
        Con <Link href="/medir" className="text-ios-azul">Medir mi recorrido</Link>, el celular en un soporte firme mide qué tanto se
        sacude el vehículo mientras manejas:
      </p>
      <ul className="list-disc space-y-1.5 pl-5">
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
      <p className="text-[13px] text-ios-secundario">
        Fuentes: Sayers, Gillespie y Queiroz, <em>Guidelines for Conducting and Calibrating Road Roughness
        Measurements</em> (Banco Mundial, Technical Paper 46, 1986) y norma ASTM E1926 (definición del IRI);{" "}
        <a className="text-ios-azul" href="https://softteco.com/projects/roadlab" target="_blank" rel="noreferrer">RoadLab Pro</a> (app del
        Banco Mundial que estima el IRI con celulares); estudios de calibración con celulares de la{" "}
        <a className="text-ios-azul" href="https://www.ideals.illinois.edu/items/98616" target="_blank" rel="noreferrer">Universidad de Illinois</a>{" "}
        y la{" "}
        <a className="text-ios-azul" href="https://repositorio.ufc.br/handle/riufc/52918?mode=full" target="_blank" rel="noreferrer">Universidad Federal de Ceará</a>; y, para el costo que la rugosidad causa a los vehículos, el modelo HDM-4 del Banco Mundial y el{" "}
        <a className="text-ios-azul" href="https://www.nap.edu/read/22808/chapter/8" target="_blank" rel="noreferrer">NCHRP (National Academies)</a>.
      </p>

      </div>
      </Bloque>

      <Bloque id="privacidad" titulo="Aviso de privacidad">
      <div className="space-y-2 text-[16px] leading-relaxed">
      <p>
        Este aviso explica qué datos se recaban y para qué, en apego a la Ley Federal de Protección de Datos Personales
        en Posesión de los Particulares.
      </p>

      <h3 className="pt-2 text-[17px] font-semibold">Lo que NO pedimos</h3>
      <p>No pedimos nombre, teléfono, correo electrónico ni ninguna cuenta. Los reportes son anónimos.</p>

      <h3 className="pt-2 text-[17px] font-semibold">Lo que sí guardamos</h3>
      <ul className="list-disc space-y-1.5 pl-5">
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

      <h3 className="pt-2 text-[17px] font-semibold">Servicios de terceros</h3>
      <ul className="list-disc space-y-1.5 pl-5">
        <li>
          <strong>Cloudflare Turnstile</strong> verifica que quien envía sea una persona y no un robot. Cloudflare
          procesa datos técnicos de tu navegador según su propia política de privacidad.
        </li>
        <li>
          <strong>Supabase</strong> (base de datos y fotos), <strong>Vercel</strong> (hospedaje) y los mapas de{" "}
          <strong>OpenStreetMap</strong>.
        </li>
      </ul>

      <h3 className="pt-2 text-[17px] font-semibold">Para qué se usan</h3>
      <p>
        Únicamente para mostrar en el mapa el estado de los servicios públicos y para evitar abusos. No vendemos ni
        compartimos datos. La información agregada (conteos por colonia) es pública.
      </p>

      <h3 className="pt-2 text-[17px] font-semibold">Comentarios</h3>
      <p>
        No escribas datos personales tuyos ni de otras personas. Los comentarios con groserías, teléfonos, correos o
        enlaces se rechazan. Cualquier vecino puede denunciar un comentario o una foto: con 3 denuncias se oculta
        automáticamente.
      </p>

      <h3 className="pt-2 text-[17px] font-semibold">Tus derechos</h3>
      <p>
        Como no pedimos datos de identificación, no podemos asociar un reporte a una persona. Si crees que un reporte o
        foto expone datos personales, escríbenos para retirarlo
        {contacto ? (
          <>
            {" "}
            a <a className="text-ios-azul" href={`mailto:${contacto}`}>{contacto}</a>
          </>
        ) : null}
        .
      </p>

      </div>
      </Bloque>

      <p className="px-4 text-[13px] text-ios-secundario">
        Mapa © colaboradores de{" "}
        <a className="text-ios-azul" href="https://www.openstreetmap.org/copyright">
          OpenStreetMap
        </a>
        . Límites de colonias: mapa público de colonias del municipio de Cajeme publicado por el{" "}
        <a className="text-ios-azul" href="https://imipcajeme.org">
          IMIP Cajeme
        </a>
        . Proyecto ciudadano sin fines de lucro.
      </p>
      <p className="px-4 text-xs text-ios-terciario">Versión {version.split(".").slice(0, 2).join(".")}</p>
    </Pagina>
  );
}
