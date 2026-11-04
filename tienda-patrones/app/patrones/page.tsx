import type { Metadata } from "next";
import Link from "next/link";
import { CATEGORIAS, NIVELES, PATRONES, type Categoria, type Nivel } from "@/lib/catalogo";
import { TarjetaPatron } from "@/components/TarjetaPatron";

export const metadata: Metadata = {
  title: "Patrones de costura digitales",
  description: "Catálogo de patrones de costura en PDF y DXF: vestidos, blusas, faldas, pantalones, overoles e infantil. Descarga inmediata.",
};

type Filtros = { categoria?: string; nivel?: string; precio?: string; q?: string; orden?: string };

const ORDENES = { destacados: "Destacados", "precio-menor": "Precio: menor a mayor", "precio-mayor": "Precio: mayor a menor", nombre: "Nombre" };

function quitarAcentos(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function enlace(actual: Filtros, cambio: Partial<Filtros>): string {
  const p = new URLSearchParams();
  const todo = { ...actual, ...cambio };
  for (const [k, v] of Object.entries(todo)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `/patrones?${s}` : "/patrones";
}

export default async function Catalogo({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const uno = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const f: Filtros = { categoria: uno("categoria"), nivel: uno("nivel"), precio: uno("precio"), q: uno("q"), orden: uno("orden") };

  let lista = PATRONES.filter((p) => {
    if (f.categoria && p.categoria !== f.categoria) return false;
    if (f.nivel && p.nivel !== f.nivel) return false;
    if (f.precio === "gratis" && p.precio !== 0) return false;
    if (f.precio === "menos-100" && p.precio >= 100) return false;
    if (f.q) {
      const texto = quitarAcentos(`${p.nombre} ${p.tipo} ${p.resumen} ${CATEGORIAS[p.categoria]}`);
      if (!quitarAcentos(f.q).split(/\s+/).every((palabra) => texto.includes(palabra))) return false;
    }
    return true;
  });
  if (f.orden === "precio-menor") lista = [...lista].sort((a, b) => a.precio - b.precio);
  if (f.orden === "precio-mayor") lista = [...lista].sort((a, b) => b.precio - a.precio);
  if (f.orden === "nombre") lista = [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  const titulo = f.categoria && f.categoria in CATEGORIAS ? CATEGORIAS[f.categoria as Categoria] : f.precio === "gratis" ? "Patrones gratis" : "Todos los patrones";
  const chip = (activo: boolean) =>
    `whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium ${activo ? "border-tinta bg-tinta text-white" : "border-borde bg-tarjeta hover:border-tinta"}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-titulo text-4xl font-semibold">{titulo}</h1>
      <p className="mt-2 text-suave">PDF con capas por talla, plotter, proyector, DXF e instructivo en español.</p>

      <div className="-mx-4 mt-8 flex gap-2 overflow-x-auto px-4 pb-2">
        <Link href={enlace(f, { categoria: undefined })} className={chip(!f.categoria)}>Todo</Link>
        {(Object.entries(CATEGORIAS) as [Categoria, string][]).map(([k, v]) => (
          <Link key={k} href={enlace(f, { categoria: k })} className={chip(f.categoria === k)}>{v}</Link>
        ))}
      </div>

      <form action="/patrones" className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-borde bg-tarjeta p-3">
        {f.categoria ? <input type="hidden" name="categoria" value={f.categoria} /> : null}
        <label className="flex min-w-[12rem] flex-1 items-center gap-2 rounded-xl bg-fondo px-3">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-suave" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
          </svg>
          <span className="sr-only">Buscar</span>
          <input name="q" defaultValue={f.q} placeholder="Buscar: vestido, palazzo, niña…" className="w-full bg-transparent py-2.5 outline-none" />
        </label>
        <label className="text-sm">
          <span className="sr-only">Nivel</span>
          <select name="nivel" defaultValue={f.nivel ?? ""} className="rounded-xl bg-fondo px-3 py-2.5">
            <option value="">Cualquier nivel</option>
            {(Object.entries(NIVELES) as [Nivel, { nombre: string }][]).map(([k, v]) => (
              <option key={k} value={k}>{v.nombre}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="sr-only">Precio</span>
          <select name="precio" defaultValue={f.precio ?? ""} className="rounded-xl bg-fondo px-3 py-2.5">
            <option value="">Cualquier precio</option>
            <option value="gratis">Gratis</option>
            <option value="menos-100">Menos de $100 MXN</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="sr-only">Ordenar</span>
          <select name="orden" defaultValue={f.orden ?? "destacados"} className="rounded-xl bg-fondo px-3 py-2.5">
            {Object.entries(ORDENES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <button className="boton boton-principal !py-2.5">Filtrar</button>
      </form>

      {lista.length ? (
        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
          {lista.map((p) => (
            <TarjetaPatron key={p.slug} patron={p} />
          ))}
        </div>
      ) : (
        <div className="mt-16 text-center">
          <p className="text-lg">No encontramos patrones con esos filtros.</p>
          <Link href="/patrones" className="boton boton-secundario mt-5">Ver todos</Link>
        </div>
      )}
    </div>
  );
}
