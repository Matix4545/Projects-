import type { Metadata } from "next";
import { TablaMedidas } from "@/components/TablaMedidas";

export const metadata: Metadata = {
  title: "Tabla de medidas y cómo medirte",
  description: "Tabla de tallas de XS a 4XL y de 1 a 10 años, con estatura base de 1.60 m. Aprende a tomar tus medidas para elegir tu talla.",
};

const COMO = [
  { nombre: "Busto", texto: "Alrededor de la parte más llena del pecho, con la cinta paralela al piso y pasando por los omóplatos. Usa el brasier que usarás con la prenda." },
  { nombre: "Cintura", texto: "En la parte más angosta del torso, normalmente un par de dedos arriba del ombligo. Dobla el cuerpo hacia un lado: donde se forma el pliegue es tu cintura." },
  { nombre: "Cadera", texto: "Alrededor de la parte más ancha de los glúteos, con los pies juntos." },
  { nombre: "Estatura", texto: "Descalza, de espaldas a la pared. Nuestros patrones están calculados para 1.60 m y traen una línea para alargar o acortar." },
];

function Maniqui() {
  const linea = { stroke: "var(--color-acento)", strokeWidth: 2, strokeDasharray: "5 4" };
  const texto = { fontSize: 11, fill: "var(--color-acento-oscuro)", fontWeight: 600 };
  return (
    <svg viewBox="0 0 220 290" className="mx-auto w-full max-w-xs" role="img" aria-label="Maniquí con las líneas de busto, cintura y cadera">
      <path
        d="M96 20 h28 v14 c0 4 22 8 38 16 c6 10 4 30 0 44 c-6 18 -18 30 -20 46 c-2 14 12 28 16 50 c2 12 -2 26 -6 36 H64 c-4 -10 -8 -24 -6 -36 c4 -22 18 -36 16 -50 c-2 -16 -14 -28 -20 -46 c-4 -14 -6 -34 0 -44 c16 -8 38 -12 38 -16 z"
        fill="var(--lienzo)"
        stroke="var(--tinta)"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M110 226 v40 M86 270 h48" stroke="var(--tinta)" strokeWidth="3" strokeLinecap="round" />
      <path d="M50 92 h120" {...linea} />
      <path d="M68 142 h84" {...linea} />
      <path d="M58 194 h104" {...linea} />
      <text x="174" y="96" {...texto}>Busto</text>
      <text x="156" y="146" {...texto}>Cintura</text>
      <text x="166" y="198" {...texto}>Cadera</text>
    </svg>
  );
}

export default function Medidas() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-titulo text-4xl font-semibold">Tabla de medidas</h1>
      <p className="mt-2 max-w-2xl text-suave">
        Son medidas del <strong>cuerpo</strong>, no de la prenda terminada: cada patrón ya incluye la holgura que necesita.
        Todas en centímetros.
      </p>

      <section className="mt-10 grid items-center gap-10 md:grid-cols-[1fr_1.2fr]">
        <Maniqui />
        <div>
          <h2 className="font-titulo text-2xl font-semibold">Cómo medirte</h2>
          <p className="mt-1 text-sm text-suave">Usa una cinta métrica flexible, sin apretar, y pide ayuda si puedes.</p>
          <dl className="mt-5 space-y-4">
            {COMO.map((c) => (
              <div key={c.nombre}>
                <dt className="font-semibold">{c.nombre}</dt>
                <dd className="text-suave">{c.texto}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mt-14">
        <h2 className="font-titulo text-2xl font-semibold">Mujer · XS a 4XL</h2>
        <div className="mt-4"><TablaMedidas grupo="mujer" /></div>
      </section>
      <section className="mt-10">
        <h2 className="font-titulo text-2xl font-semibold">Infantil · 1 a 10 años</h2>
        <p className="mt-1 text-sm text-suave">En niñas y niños elige la talla por estatura y revisa el pecho.</p>
        <div className="mt-4"><TablaMedidas grupo="infantil" /></div>
      </section>

      <section className="prosa mt-12 rounded-3xl bg-crema p-6 sm:p-8">
        <h2 className="!mt-0">¿Estás entre dos tallas?</h2>
        <p>
          Como los PDF vienen por capas, puedes <strong>combinar tallas</strong>: por ejemplo, busto en M y cadera en L. Imprime las dos
          capas y une las líneas con una curva suave entre la cintura y la cadera.
        </p>
        <p>
          Si es una prenda holgada (kimono, blusa globo), elige por tu busto. Si es ajustada en la cadera (pantalón, falda), elige por
          tu cadera.
        </p>
      </section>
    </div>
  );
}
