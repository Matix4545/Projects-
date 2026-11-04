import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Cómo imprimir tu patrón",
  description: "Imprime tu patrón en casa (Carta o A4), en plotter o con proyector. Cuadro de prueba, capas por talla y cómo unir las hojas.",
};

export default function ComoImprimir() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-titulo text-4xl font-semibold">Cómo imprimir tu patrón</h1>
      <p className="mt-2 text-suave">Cada patrón trae varios archivos. Elige el que te acomode según dónde vas a imprimir.</p>

      <div className="mt-6 flex flex-wrap gap-3">
        <a href="/cuadro-de-prueba.pdf" className="boton boton-principal" download>
          Descargar hoja de prueba (Carta)
        </a>
        <a href="/cuadro-de-prueba-a4.pdf" className="boton boton-secundario" download>
          Hoja de prueba A4
        </a>
      </div>

      <div className="prosa mt-4">
        <h2>1. En casa, tamaño Carta o A4</h2>
        <ol>
          <li>
            Abre el PDF con <strong>Adobe Acrobat Reader</strong> (gratis). Otros visores no muestran las capas por talla.
          </li>
          <li>
            En el panel <strong>Capas</strong> (ícono de hojas apiladas) apaga las tallas que no necesitas. Deja siempre encendida la
            capa &ldquo;Información&rdquo;.
          </li>
          <li>
            Al imprimir elige <strong>Tamaño real</strong> o <strong>Escala 100 %</strong>. Nunca &ldquo;Ajustar&rdquo; ni
            &ldquo;Reducir páginas grandes&rdquo;.
          </li>
          <li>
            Imprime primero solo la hoja 1 y mide el <strong>cuadro de prueba: 5 × 5 cm</strong>. Si mide distinto, revisa la escala
            antes de imprimir lo demás.
          </li>
          <li>
            Recorta el margen derecho e inferior de cada hoja y únelas con cinta siguiendo las letras y números de las orillas (A1 con
            A2, A1 con B1…). Los triángulos de las orillas deben formar rombos completos.
          </li>
        </ol>

        <h2>2. En plotter (una sola hoja grande)</h2>
        <p>
          Lleva el archivo <strong>PDF plotter 90 cm</strong> a cualquier centro de copiado o papelería que imprima planos. Pide que
          lo impriman <strong>al 100 %, sin escalar</strong>, en papel bond. Es la forma más rápida: no hay que pegar hojas.
        </p>

        <h2>3. Con proyector</h2>
        <p>
          El <strong>PDF para proyector</strong> tiene líneas más gruesas y una cuadrícula de calibración de 10 cm. Proyecta sobre tu
          mesa de corte, ajusta el zoom hasta que los cuadros midan 10 cm y corta directo sobre la tela.
        </p>

        <h2>4. En programas CAD</h2>
        <p>
          El archivo <strong>DXF</strong> está a escala 1:1 en milímetros, con una capa por talla. Ábrelo en AutoCAD, Audaces,
          Optitex, Gerber, Valentina o Inkscape, o mándalo directo a tu plotter de corte.
        </p>

        <h2>¿Incluye margen de costura?</h2>
        <p>
          Sí: todos nuestros patrones incluyen <strong>1 cm de margen de costura</strong> (salvo donde el instructivo indique otra
          medida). La línea de corte es la exterior.
        </p>

        <p className="mt-8">
          ¿Algo no salió bien? Revisa las <Link href="/preguntas">preguntas frecuentes</Link> o escríbenos.
        </p>
      </div>
    </div>
  );
}
