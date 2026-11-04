import type { Metadata } from "next";
import Link from "next/link";
import { LICENCIAS, TIENDA } from "@/lib/config";
import { formatearCobro } from "@/lib/dinero";

export const metadata: Metadata = {
  title: "Preguntas frecuentes",
  description: "Cómo recibo mi patrón, formas de pago, pagos desde otros países, tallas, impresión y licencias.",
};

const PREGUNTAS: { p: string; r: React.ReactNode }[] = [
  {
    p: "¿Cómo recibo mi patrón?",
    r: "Al terminar el pago regresas a nuestra página y ahí mismo aparecen tus descargas. También te llega un correo con la liga para que puedas volver a descargar cuando quieras.",
  },
  {
    p: "¿Qué formas de pago aceptan?",
    r: "Tarjeta de crédito o débito, OXXO, transferencia SPEI y saldo de Mercado Pago. Desde otros países puedes pagar con tarjeta Visa, Mastercard o American Express.",
  },
  {
    p: "Pagué en OXXO o por transferencia, ¿cuándo me llega?",
    r: "En cuanto se acredite el pago (de unos minutos a 1 día hábil) te mandamos el correo con tus descargas. No tienes que hacer nada más.",
  },
  {
    p: "No vivo en México, ¿puedo comprar?",
    r: `Sí. Los precios se cobran en ${TIENDA.monedaCobro} y tu banco hace la conversión a tu moneda. En la parte de arriba puedes elegir tu país para ver un precio aproximado.`,
  },
  {
    p: "¿Qué talla elijo?",
    r: (
      <>
        Mídete y compara con la <Link href="/medidas">tabla de medidas</Link>. Si estás entre dos tallas, puedes combinarlas porque el PDF
        viene por capas.
      </>
    ),
  },
  {
    p: "No tengo impresora, ¿qué hago?",
    r: "Lleva el archivo de plotter a cualquier papelería o centro de copiado que imprima planos. Sale en una sola hoja y no tienes que pegar nada.",
  },
  {
    p: "¿Los patrones incluyen margen de costura?",
    r: "Sí, 1 cm en todas las orillas, salvo donde el instructivo indique otra medida.",
  },
  {
    p: "¿Puedo vender lo que coso con sus patrones?",
    r: (
      <>
        Sí, con la licencia emprendedora ({formatearCobro(LICENCIAS.emprendedora.extra)} adicionales por patrón). Con la licencia personal
        solo puedes coser para ti, tu familia o regalar. <Link href="/licencia">Ver detalles</Link>.
      </>
    ),
  },
  {
    p: "¿Puedo compartir el archivo con una amiga?",
    r: "No. Cada compra es para una persona (o un taller, en la licencia emprendedora). Si a tu amiga le gustó, recomiéndanos: así podemos seguir haciendo patrones a precio latino.",
  },
  {
    p: "¿Hacen reembolsos?",
    r: `Como son archivos digitales que se entregan al instante, no hacemos reembolsos una vez descargados. Pero si un archivo no abre, tiene un error o te equivocaste de patrón, escríbenos a ${TIENDA.correo} y lo resolvemos.`,
  },
];

export default function Preguntas() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: PREGUNTAS.filter((q) => typeof q.r === "string").map((q) => ({
      "@type": "Question",
      name: q.p,
      acceptedAnswer: { "@type": "Answer", text: q.r },
    })),
  };
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <h1 className="font-titulo text-4xl font-semibold">Preguntas frecuentes</h1>
      <div className="mt-8 divide-y divide-borde rounded-3xl border border-borde bg-tarjeta">
        {PREGUNTAS.map((q) => (
          <details key={q.p} className="group p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
              {q.p}
              <span className="text-xl text-acento transition group-open:rotate-45" aria-hidden>+</span>
            </summary>
            <div className="prosa mt-3 text-suave">{q.r}</div>
          </details>
        ))}
      </div>
      <p className="mt-8 text-center text-suave">
        ¿No encontraste tu respuesta? Escríbenos a <a href={`mailto:${TIENDA.correo}`} className="underline">{TIENDA.correo}</a>
        {TIENDA.whatsapp ? (
          <>
            {" "}o por <a href={`https://wa.me/${TIENDA.whatsapp}`} className="underline">WhatsApp</a>
          </>
        ) : null}
        .
      </p>
    </div>
  );
}
