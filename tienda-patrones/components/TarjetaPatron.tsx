import Link from "next/link";
import { NIVELES, rangoTallas, type Patron } from "@/lib/catalogo";
import { DibujoPlano } from "./DibujoPlano";
import { Precio } from "./Precio";

export function Nivel({ nivel }: { nivel: Patron["nivel"] }) {
  const n = NIVELES[nivel];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-suave" title={`Nivel ${n.nombre.toLowerCase()}`}>
      <span className="flex gap-0.5" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span key={i} className={`h-1.5 w-3 rounded-full ${i <= n.puntos ? "bg-tinta" : "bg-borde"}`} />
        ))}
      </span>
      {n.nombre}
    </span>
  );
}

export function TarjetaPatron({ patron }: { patron: Patron }) {
  return (
    <Link href={`/patrones/${patron.slug}`} className="group block">
      <div
        className="relative aspect-[4/5] overflow-hidden rounded-2xl transition group-hover:shadow-lg"
        style={{ backgroundColor: patron.color }}
      >
        {patron.fotos?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={patron.fotos[0]} alt={`${patron.tipo} ${patron.nombre}`} className="h-full w-full object-cover" />
        ) : (
          <DibujoPlano
            dibujo={patron.dibujo}
            titulo={`Dibujo del ${patron.tipo.toLowerCase()} ${patron.nombre}`}
            className="absolute inset-0 m-auto h-[86%] w-[86%] transition duration-300 group-hover:scale-[1.04]"
          />
        )}
        <div className="absolute left-3 top-3 flex gap-1.5">
          {patron.precio === 0 ? (
            <span className="rounded-full bg-salvia px-2.5 py-1 text-xs font-bold text-white">Gratis</span>
          ) : null}
          {patron.nuevo ? (
            <span className="rounded-full bg-tinta px-2.5 py-1 text-xs font-bold text-white">Nuevo</span>
          ) : null}
          {patron.precioAntes && patron.precioAntes > patron.precio ? (
            <span className="rounded-full bg-acento px-2.5 py-1 text-xs font-bold text-white">
              -{Math.round((1 - patron.precio / patron.precioAntes) * 100)}%
            </span>
          ) : null}
        </div>
      </div>
      <div className="mt-3">
        <h3 className="font-titulo text-xl font-semibold leading-tight">{patron.nombre}</h3>
        <p className="truncate text-sm text-suave">{patron.tipo}</p>
        <Precio cantidad={patron.precio} antes={patron.precioAntes} className="mt-1.5" />
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Nivel nivel={patron.nivel} />
          <span className="text-xs text-suave">{rangoTallas(patron.tallas)}</span>
        </div>
      </div>
    </Link>
  );
}
