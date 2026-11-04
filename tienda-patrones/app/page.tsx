import Link from "next/link";
import { CATEGORIAS, PATRONES, type Categoria } from "@/lib/catalogo";
import { LICENCIAS, TIENDA } from "@/lib/config";
import { formatearCobro } from "@/lib/dinero";
import { DibujoPlano } from "@/components/DibujoPlano";
import { TarjetaPatron } from "@/components/TarjetaPatron";

const PASOS = [
  { titulo: "Elige tu patrón", texto: "Revisa la tabla de medidas y el consumo de tela de cada modelo." },
  { titulo: "Paga como quieras", texto: "Tarjeta, OXXO, transferencia SPEI o saldo de Mercado Pago." },
  { titulo: "Descarga al instante", texto: "Recibes tus archivos en la pantalla y en tu correo." },
  { titulo: "Imprime y cose", texto: "En casa (Carta o A4), en una papelería con plotter o con proyector." },
];

const VENTAJAS = [
  {
    titulo: "Precio latino",
    texto: `Patrones desde ${formatearCobro(Math.min(...PATRONES.filter((p) => p.precio > 0).map((p) => p.precio)))}. Sin pagar en dólares ni euros.`,
    icono: "M12 3v18M16.5 7.5c0-1.9-2-3-4.5-3s-4.5 1.2-4.5 3.2c0 4.6 9 2.4 9 7.1 0 2-2 3.2-4.5 3.2s-4.5-1.1-4.5-3",
  },
  {
    titulo: "Hechos para cuerpos latinos",
    texto: "Estatura base de 1.60 m y tallas de XS a 4XL, con ajuste de largo marcado en el patrón.",
    icono: "M12 4a2 2 0 1 0 0 .01M7 9h10M12 9v6m0 0l-3 6m3-6l3 6",
  },
  {
    titulo: "Todos los formatos",
    texto: "Carta (la hoja de tu papelería), A4, plotter de 90 cm, proyector y DXF para tu programa CAD.",
    icono: "M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 15h5M10 18h3",
  },
  {
    titulo: "Imprime solo tu talla",
    texto: "Los PDF vienen con capas: apagas las tallas que no usas y ahorras papel y tinta.",
    icono: "M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5",
  },
  {
    titulo: "Licencia emprendedora",
    texto: `¿Coses para vender? Por ${formatearCobro(LICENCIAS.emprendedora.extra)} más vendes las prendas sin límite de piezas.`,
    icono: "M4 7h16v12H4zM9 7V5h6v2M4 12h16",
  },
  {
    titulo: "Instructivo en español",
    texto: "Paso a paso con dibujos, escrito en el español que usamos en la mesa de corte.",
    icono: "M4 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H4zM20 5h-6M20 5v13h-6",
  },
];

const COMPARATIVA: [string, string, string][] = [
  ["Precio por patrón", "US$8 a US$15 o €5 a €12", `Desde ${formatearCobro(69)}`],
  ["Moneda de cobro", "Dólares o euros, más comisión de tu banco", "Pesos mexicanos, con precio aproximado en tu moneda"],
  ["Formas de pago", "Tarjeta internacional o PayPal", "Tarjeta, OXXO, SPEI y Mercado Pago"],
  ["Tamaños de impresión", "Casi siempre A4 y A0", "Carta, A4, plotter 90 cm, proyector y DXF"],
  ["Estatura base", "Muchas usan 1.68 m (europea)", "1.60 m, con línea para alargar o acortar"],
  ["Vender lo que coses", "Casi nunca permitido", "Sí, con licencia emprendedora"],
];

export default function Inicio() {
  const destacados = PATRONES.filter((p) => p.precio > 0).slice(0, 4);
  const gratis = PATRONES.find((p) => p.precio === 0);
  const categorias = Object.entries(CATEGORIAS) as [Categoria, string][];

  return (
    <>
      {/* Portada */}
      <section className="papel-patron border-b border-borde">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-[1.1fr_1fr] md:py-20">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-acento">{TIENDA.lema}</p>
            <h1 className="mt-3 font-titulo text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Cose ropa que te queda.<br />
              <span className="text-acento">A precio latino.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-suave">
              Patrones profesionales trazados en CAD, con tallas de XS a 4XL pensadas para nuestra estatura. Compra, descarga al instante
              e imprime en casa o en plotter.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/patrones" className="boton boton-principal">Ver patrones</Link>
              {gratis ? (
                <Link href={`/patrones/${gratis.slug}`} className="boton boton-secundario">Descarga uno gratis</Link>
              ) : null}
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-suave">
              {["Instructivo en español", "PDF con capas + DXF", "Tarjeta, OXXO y Mercado Pago"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <svg viewBox="0 0 20 20" className="h-4 w-4 text-salvia" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                    <path d="M4 10.5l4 4 8-9" />
                  </svg>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative mx-auto grid w-full max-w-md grid-cols-2 gap-4">
            {PATRONES.slice(0, 4).map((p, i) => (
              <Link
                key={p.slug}
                href={`/patrones/${p.slug}`}
                className={`rounded-2xl p-2 shadow-sm ring-1 ring-black/5 transition hover:-translate-y-1 ${i % 2 ? "translate-y-6" : ""}`}
                style={{ backgroundColor: p.color }}
                aria-label={`${p.tipo} ${p.nombre}`}
              >
                <DibujoPlano dibujo={p.dibujo} className="aspect-[5/6] w-full" titulo={p.tipo} />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-titulo text-3xl font-semibold">Así de fácil</h2>
        <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PASOS.map((paso, i) => (
            <li key={paso.titulo} className="rounded-2xl border border-borde bg-tarjeta p-5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-acento font-titulo text-lg font-semibold text-white">{i + 1}</span>
              <h3 className="mt-4 font-semibold">{paso.titulo}</h3>
              <p className="mt-1 text-sm text-suave">{paso.texto}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Destacados */}
      <section className="mx-auto max-w-6xl px-4">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-titulo text-3xl font-semibold">Los más cosidos</h2>
          <Link href="/patrones" className="shrink-0 text-sm font-semibold text-acento-oscuro hover:underline">
            Ver los {PATRONES.length} patrones →
          </Link>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">
          {destacados.map((p) => (
            <TarjetaPatron key={p.slug} patron={p} />
          ))}
        </div>
      </section>

      {/* Ventajas */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="max-w-2xl font-titulo text-3xl font-semibold">Lo que las tiendas internacionales no te dan</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {VENTAJAS.map((v) => (
            <div key={v.titulo} className="rounded-2xl border border-borde bg-tarjeta p-6">
              <svg viewBox="0 0 24 24" className="h-8 w-8 text-acento" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={v.icono} />
              </svg>
              <h3 className="mt-4 text-lg font-semibold">{v.titulo}</h3>
              <p className="mt-1.5 text-suave">{v.texto}</p>
            </div>
          ))}
        </div>

        {/* Comparativa */}
        <div className="mt-12 overflow-hidden rounded-2xl border border-borde bg-tarjeta">
          <table className="w-full text-left text-sm sm:text-base">
            <thead className="bg-crema">
              <tr>
                <th className="p-4 font-semibold"><span className="sr-only">Concepto</span></th>
                <th className="p-4 font-semibold text-suave">Tiendas en dólares o euros</th>
                <th className="p-4 font-semibold text-acento-oscuro">{TIENDA.nombre}</th>
              </tr>
            </thead>
            <tbody>
              {COMPARATIVA.map(([concepto, ellos, nosotros]) => (
                <tr key={concepto} className="border-t border-borde align-top">
                  <th scope="row" className="p-4 font-medium">{concepto}</th>
                  <td className="p-4 text-suave">{ellos}</td>
                  <td className="p-4 font-medium">{nosotros}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Patrón gratis */}
      {gratis ? (
        <section className="mx-auto max-w-6xl px-4">
          <div className="grid items-center gap-8 overflow-hidden rounded-3xl bg-salvia-claro p-8 md:grid-cols-[1fr_auto] md:p-12">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-salvia">Regalo</p>
              <h2 className="mt-2 font-titulo text-3xl font-semibold sm:text-4xl">Prueba nuestras tallas gratis</h2>
              <p className="mt-3 max-w-lg text-suave">
                Descarga la {gratis.tipo.toLowerCase()} <strong>{gratis.nombre}</strong> sin costo, con todas las tallas e instructivo.
                Si te queda como esperas, ya sabes cómo te quedarán los demás.
              </p>
              <Link href={`/patrones/${gratis.slug}`} className="boton boton-principal mt-6">Descargar gratis</Link>
            </div>
            <div className="mx-auto w-48 rounded-2xl p-3 md:w-56" style={{ backgroundColor: gratis.color }}>
              <DibujoPlano dibujo={gratis.dibujo} className="w-full" titulo={gratis.tipo} />
            </div>
          </div>
        </section>
      ) : null}

      {/* Categorías */}
      <section className="mx-auto max-w-6xl px-4 pt-20">
        <h2 className="font-titulo text-3xl font-semibold">Busca por prenda</h2>
        <div className="mt-6 flex flex-wrap gap-3">
          {categorias.map(([clave, nombre]) => (
            <Link
              key={clave}
              href={`/patrones?categoria=${clave}`}
              className="rounded-full border border-borde bg-tarjeta px-5 py-2.5 font-medium hover:border-tinta"
            >
              {nombre}
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
