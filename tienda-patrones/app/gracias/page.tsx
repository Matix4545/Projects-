import type { Metadata } from "next";
import Link from "next/link";
import { FORMATOS, LICENCIAS, TIENDA } from "@/lib/config";
import { entregarPedido } from "@/lib/entrega";
import { crearTokenDescarga } from "@/lib/firma";
import { verificarPago } from "@/lib/pagos";
import { lineas } from "@/lib/precios";
import { secreto } from "@/lib/secreto";
import { DibujoPlano } from "@/components/DibujoPlano";
import { VaciarCarrito } from "@/components/VaciarCarrito";

export const metadata: Metadata = { title: "Tus descargas", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const DIA = 24 * 60 * 60 * 1000;

function Caja({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="font-titulo text-3xl font-semibold">{titulo}</h1>
      <div className="mt-4 space-y-4 text-suave">{children}</div>
    </div>
  );
}

export default async function Gracias({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const { resultado, articulos } = await verificarPago(params);

  if (resultado.estado === "invalido" || !articulos) {
    return (
      <Caja titulo="No encontramos tu pago">
        <p>Revisa que la liga esté completa. Si ya pagaste, escríbenos a {TIENDA.correo} con tu comprobante y te mandamos tus patrones.</p>
        <Link href="/carrito" className="boton boton-secundario">Volver al carrito</Link>
      </Caja>
    );
  }

  if (resultado.estado === "rechazado") {
    return (
      <Caja titulo="El pago no se completó">
        <p>No se hizo ningún cargo. Puedes intentarlo de nuevo con otra tarjeta o forma de pago.</p>
        <Link href="/carrito" className="boton boton-principal">Intentar de nuevo</Link>
      </Caja>
    );
  }

  if (resultado.estado === "pendiente") {
    return (
      <Caja titulo="Tu pago está pendiente">
        <p>
          Si pagas en OXXO o por transferencia, el pago puede tardar desde unos minutos hasta 1 día hábil en acreditarse.
          {resultado.correo ? ` En cuanto se acredite te mandaremos tus patrones a ${resultado.correo}.` : ""}
        </p>
        <p>
          También puedes <strong>guardar esta página</strong> en tus favoritos y volver a abrirla: cuando el pago se acredite, aquí
          aparecerán tus descargas.
        </p>
        <VaciarCarrito />
      </Caja>
    );
  }

  // Aprobado: registrar y mandar correo (una sola vez), y mostrar descargas
  try {
    await entregarPedido(resultado, articulos);
  } catch (e) {
    console.error("No se pudo registrar la entrega", e);
  }

  const vence = Date.now() + DIA;
  const compras = lineas(articulos);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <VaciarCarrito />
      <div className="text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-salvia text-white">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden>
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
        <h1 className="mt-4 font-titulo text-4xl font-semibold">¡Gracias por tu compra!</h1>
        <p className="mt-2 text-suave">
          {resultado.correo ? `También te mandamos la liga a ${resultado.correo}. ` : ""}
          Guarda esta página: puedes volver a descargar cuando quieras.
        </p>
        {resultado.id === "demo" ? (
          <p className="mx-auto mt-4 max-w-md rounded-xl bg-crema p-3 text-sm">
            Modo demo: este pago es simulado. Los archivos se descargan desde la carpeta <code>archivos-privados/</code>.
          </p>
        ) : null}
      </div>

      <div className="mt-10 space-y-6">
        {compras.map((l) => (
          <section key={l.patron.slug} className="rounded-3xl border border-borde bg-tarjeta p-5 sm:p-6">
            <div className="flex items-center gap-4">
              <div className="w-16 shrink-0 rounded-xl p-1" style={{ backgroundColor: l.patron.color }}>
                <DibujoPlano dibujo={l.patron.dibujo} className="w-full" />
              </div>
              <div>
                <h2 className="font-titulo text-2xl font-semibold">{l.patron.nombre}</h2>
                <p className="text-sm text-suave">
                  {l.patron.tipo} · Licencia {LICENCIAS[l.licencia].nombre.toLowerCase()}
                </p>
              </div>
            </div>
            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {l.patron.formatos.map((f) => (
                <li key={f}>
                  <a
                    href={`/api/descargar?t=${crearTokenDescarga(secreto(), { slug: l.patron.slug, formato: f, vence })}`}
                    className="flex items-center gap-3 rounded-xl border border-borde px-4 py-3 hover:border-tinta"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-acento" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" />
                    </svg>
                    <span>
                      <span className="block text-sm font-semibold">{FORMATOS[f].nombre}</span>
                      <span className="block text-xs text-suave">{FORMATOS[f].detalle}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-10 rounded-3xl bg-crema p-6">
        <h2 className="font-semibold">Antes de imprimir</h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-suave">
          <li>Imprime al <strong>100 % / tamaño real</strong> (nunca &ldquo;ajustar a la página&rdquo;).</li>
          <li>Mide el cuadro de prueba de la hoja 1: debe medir exactamente 5 × 5 cm.</li>
          <li>
            Abre el PDF con Adobe Acrobat Reader para apagar las tallas que no necesitas.{" "}
            <Link href="/como-imprimir" className="underline">Ver guía completa</Link>
          </li>
        </ol>
      </div>
    </div>
  );
}
