// Piezas de las páginas de contenido (guías, herramientas y colonias): migas, llamados a reportar,
// preguntas frecuentes y pie con enlaces. Sin "use client": se dibujan en el servidor.
import Link from "next/link";
import type { ReactNode } from "react";
import { NOMBRE_SITIO, urlAbsoluta } from "@/lib/sitio";

/** Datos estructurados (schema.org) para buscadores y asistentes de IA */
export function JsonLd({ datos }: { datos: object }) {
  // "<" escapado para que ningún texto pueda cerrar la etiqueta <script>
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datos).replace(/</g, "\\u003c") }} />;
}

/** Ruta de navegación visible + BreadcrumbList para Google */
export function Migas({ items }: { items: { nombre: string; href: string }[] }) {
  const todos = [{ nombre: "Mapa", href: "/" }, ...items];
  return (
    <>
      <nav aria-label="Ruta" className="-mt-2 px-1 text-[13px] text-ios-secundario print:hidden">
        {todos.map((m, i) => (
          <span key={m.href}>
            {i > 0 && <span className="mx-1.5">›</span>}
            {i === todos.length - 1 ? <span>{m.nombre}</span> : <Link href={m.href} className="text-ios-azul">{m.nombre}</Link>}
          </span>
        ))}
      </nav>
      <JsonLd
        datos={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: todos.map((m, i) => ({ "@type": "ListItem", position: i + 1, name: m.nombre, item: urlAbsoluta(m.href) })),
        }}
      />
    </>
  );
}

/** Bloque azul que invita a reportar en el mapa (la "conversión" de todas las páginas de contenido) */
export function Llamado({
  titulo,
  texto,
  href = "/?reportar=1",
  boton = "Reportar en el mapa",
  secundario,
}: {
  titulo: string;
  texto: ReactNode;
  href?: string;
  boton?: string;
  secundario?: { href: string; texto: string };
}) {
  return (
    <section className="rounded-3xl bg-ios-azul px-5 py-5 text-white print:hidden">
      <h2 className="text-[20px] font-bold leading-tight">{titulo}</h2>
      <p className="mt-1.5 text-[15px] leading-relaxed text-white/90">{texto}</p>
      <Link href={href} className="boton mt-4 w-full bg-white text-ios-azul">
        {boton}
      </Link>
      {secundario && (
        <Link href={secundario.href} className="mt-2 block py-2 text-center text-[15px] font-medium text-white">
          {secundario.texto}
        </Link>
      )}
    </section>
  );
}

/** Preguntas frecuentes visibles + FAQPage (lo que suelen citar los buscadores y las IA) */
export function Preguntas({ preguntas }: { preguntas: { p: string; r: string }[] }) {
  if (preguntas.length === 0) return null;
  return (
    <section>
      <h2 className="titulo-grupo">Preguntas frecuentes</h2>
      <div className="grupo">
        {preguntas.map((q) => (
          <details key={q.p} className="group px-4 py-3.5">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-[16px] font-medium">
              {q.p}
              <span className="mt-0.5 shrink-0 text-ios-terciario transition-transform group-open:rotate-90" aria-hidden>
                ›
              </span>
            </summary>
            <p className="mt-2 text-[15px] leading-relaxed text-ios-secundario">{q.r}</p>
          </details>
        ))}
      </div>
      <JsonLd
        datos={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: preguntas.map((q) => ({ "@type": "Question", name: q.p, acceptedAnswer: { "@type": "Answer", text: q.r } })),
        }}
      />
    </section>
  );
}

/** Texto en párrafos con estilo de lectura */
export function Texto({ children }: { children: ReactNode }) {
  return <div className="space-y-3 text-[16px] leading-relaxed [&_a]:text-ios-azul [&_strong]:font-semibold">{children}</div>;
}

const ENLACES_PIE = [
  { href: "/", texto: "Mapa de reportes" },
  { href: "/colonias", texto: "Agua por colonia" },
  { href: "/guias", texto: "Guías" },
  { href: "/herramientas", texto: "Herramientas gratis" },
  { href: "/datos", texto: "Datos" },
  { href: "/acerca", texto: "Acerca de y privacidad" },
];

/** Pie de las páginas de contenido: enlaces internos y aviso de que no es un sitio oficial */
export function PieContenido() {
  return (
    <footer className="mt-10 border-t-[0.5px] border-ios-separador px-1 pt-5 print:hidden">
      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-[14px]">
        {ENLACES_PIE.map((e) => (
          <li key={e.href}>
            <Link href={e.href} className="text-ios-azul">
              {e.texto}
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs leading-relaxed text-ios-secundario">
        {NOMBRE_SITIO} es un proyecto ciudadano sin afiliación al Ayuntamiento de Cajeme, OOMAPASC, el Gobierno de Sonora ni
        ningún partido. Reportar aquí no sustituye el reporte oficial. Esta información es orientativa y no es asesoría legal.
      </p>
    </footer>
  );
}

/** Tarjeta-enlace para listas de guías y herramientas */
export function TarjetaEnlace({ href, emoji, titulo, texto }: { href: string; emoji: string; titulo: string; texto: string }) {
  return (
    <Link href={href} className="flex items-start gap-3 px-4 py-3.5 active:bg-ios-relleno">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ios-fondo text-[20px]" aria-hidden>
        {emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-semibold leading-snug">{titulo}</span>
        <span className="mt-0.5 block text-[14px] leading-snug text-ios-secundario">{texto}</span>
      </span>
      <span className="mt-2 text-ios-terciario" aria-hidden>
        ›
      </span>
    </Link>
  );
}
