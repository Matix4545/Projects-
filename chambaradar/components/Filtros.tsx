"use client";

import Link from "next/link";
import { useState } from "react";
import { CATEGORIAS, ESTADOS, NIVELES, NOMBRE_CATEGORIA, NOMBRE_NIVEL, PAISES } from "@/lib/tipos";
import type { Filtros as TFiltros } from "@/lib/vacantes";
import { Ajustes, Lupa } from "./Iconos";
import { Modal } from "./Modal";

/** El filtro "¿Dónde?" resume zona y modalidad en una sola opción. */
export function dondeDe(f: TFiltros): string {
  if (f.zona) return f.zona;
  if (f.alcance === "cerca") return "cerca";
  if (f.modalidad === "remoto") return "remoto";
  if (f.pais === "MX") return "mx";
  return "todo";
}

/** No mandar campos vacíos, para que la URL quede limpia (/vacantes?pais=MX). */
function limpiarAlEnviar(e: React.FormEvent<HTMLFormElement>) {
  const campos = [...e.currentTarget.elements] as HTMLInputElement[];
  const vacios = campos.filter((c) => c.name && !c.value);
  vacios.forEach((c) => (c.disabled = true));
  setTimeout(() => vacios.forEach((c) => (c.disabled = false)));
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold text-tinta">{etiqueta}</span>
      {children}
    </label>
  );
}

/** Formulario de filtros. `alCambiar` = se aplica en cuanto cambias algo (escritorio). */
function FormFiltros({ f, alCambiar, pie }: { f: TFiltros; alCambiar: boolean; pie?: React.ReactNode }) {
  const enviar = alCambiar ? (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => e.currentTarget.form?.requestSubmit() : undefined;
  return (
    <form action="/vacantes" onSubmit={limpiarAlEnviar} className="space-y-4">
      {f.q && <input type="hidden" name="q" value={f.q} />}
      <Campo etiqueta="Área">
        <select name="categoria" defaultValue={f.categoria} onChange={enviar} className="campo py-2.5">
          <option value="">Todas las áreas</option>
          {CATEGORIAS.map((c) => (
            <option key={c} value={c}>
              {NOMBRE_CATEGORIA[c]}
            </option>
          ))}
        </select>
      </Campo>
      <Campo etiqueta="¿Dónde?">
        <select name="donde" defaultValue={dondeDe(f)} onChange={enviar} className="campo py-2.5">
          <option value="todo">Todo México y LATAM</option>
          <option value="remoto">Remoto / home office</option>
          <option value="mx">En México</option>
          {f.local && <option value="cajeme">En Cd. Obregón (Cajeme)</option>}
          <optgroup label="Por estado">
            {Object.entries(ESTADOS).map(([slug, nombre]) => (
              <option key={slug} value={slug}>
                {nombre}
              </option>
            ))}
          </optgroup>
        </select>
      </Campo>
      {f.alcance === "todo" && (
        <Campo etiqueta="País">
          <select name="pais" defaultValue={f.pais} onChange={enviar} className="campo py-2.5">
            <option value="">Cualquier país</option>
            {Object.entries(PAISES).filter(([codigo]) => codigo !== "BR").map(([codigo, nombre]) => (
              <option key={codigo} value={codigo}>
                {nombre}
              </option>
            ))}
          </select>
        </Campo>
      )}
      {f.alcance === "todo" && (
        <Campo etiqueta="Modalidad">
          <select name="modalidad" defaultValue={f.modalidad} onChange={enviar} className="campo py-2.5">
            <option value="">Cualquiera</option>
            <option value="remoto">Remoto</option>
            <option value="hibrido">Híbrido</option>
            <option value="presencial">Presencial</option>
          </select>
        </Campo>
      )}
      <Campo etiqueta="Empresa">
        <select name="tipo" defaultValue={f.tipo} onChange={enviar} className="campo py-2.5">
          <option value="">Todas</option>
          <option value="local">Mexicanas y de LATAM</option>
          <option value="remoto">Extranjeras</option>
        </select>
      </Campo>
      <Campo etiqueta="Nivel">
        <select name="nivel" defaultValue={f.nivel} onChange={enviar} className="campo py-2.5">
          <option value="">Cualquier nivel</option>
          {NIVELES.map((n) => (
            <option key={n} value={n}>
              {NOMBRE_NIVEL[n]}
            </option>
          ))}
        </select>
      </Campo>
      <Campo etiqueta="Fecha">
        <select name="dias" defaultValue={f.dias || ""} onChange={enviar} className="campo py-2.5">
          <option value="">Cualquier fecha</option>
          <option value="1">Últimas 24 horas</option>
          <option value="7">Última semana</option>
          <option value="30">Último mes</option>
        </select>
      </Campo>
      <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
        <input type="checkbox" name="sueldo" value="1" defaultChecked={f.conSueldo} onChange={enviar} className="size-4 accent-radar" />
        Solo con sueldo publicado
      </label>
      {pie}
    </form>
  );
}

export function cuantosFiltros(f: TFiltros) {
  return [f.categoria, ["todo", "cerca"].includes(dondeDe(f)) ? "" : "x", f.alcance === "todo" && f.pais !== "MX" ? f.pais : "", f.alcance === "todo" && f.modalidad !== "remoto" ? f.modalidad : "", f.tipo, f.nivel, f.dias ? "x" : "", f.conSueldo ? "x" : ""].filter(Boolean).length;
}

/** Columna de filtros (escritorio). */
export function FiltrosLaterales({ f }: { f: TFiltros }) {
  const n = cuantosFiltros(f);
  return (
    <div className="rounded-2xl border border-borde bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="mb-4 flex items-center justify-between">
        <p className="font-bold">Filtros</p>
        {n > 0 && (
          <Link href={f.q ? `/vacantes?q=${encodeURIComponent(f.q)}` : "/vacantes"} className="text-sm font-medium text-radar-oscuro hover:underline">
            Limpiar
          </Link>
        )}
      </div>
      <FormFiltros f={f} alCambiar />
    </div>
  );
}

/** Botón "Filtros" que abre una hoja desde abajo (celular). */
export function FiltrosMovil({ f, total }: { f: TFiltros; total: string }) {
  const [abierto, setAbierto] = useState(false);
  const n = cuantosFiltros(f);
  return (
    <>
      <button onClick={() => setAbierto(true)} className="boton-contorno shrink-0 whitespace-nowrap bg-white lg:hidden">
        <Ajustes className="size-4" /> Filtros{n > 0 ? ` (${n})` : ""}
      </button>
      <Modal abierto={abierto} alCerrar={() => setAbierto(false)} titulo="Filtros" ancho="sm:max-w-md">
        <FormFiltros
          f={f}
          alCambiar={false}
          pie={
            <div className="sticky bottom-0 -mx-5 flex gap-2 border-t border-borde bg-white px-5 pt-4 sm:-mx-7 sm:px-7">
              <Link href="/vacantes" className="boton-secundario flex-1 px-4 py-2.5 text-sm">
                Limpiar
              </Link>
              <button className="boton flex-[2] px-4 py-2.5 text-sm">Ver vacantes</button>
            </div>
          }
        />
        <p className="sr-only">{total}</p>
      </Modal>
    </>
  );
}

/** Buscador grande del encabezado. Conserva los demás filtros. */
export function Buscador({ f, autoFocus = false }: { f: TFiltros; autoFocus?: boolean }) {
  return (
    <form action="/vacantes" onSubmit={limpiarAlEnviar} className="relative w-full" role="search">
      <Lupa className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-gris" />
      <input
        name="q"
        defaultValue={f.q}
        autoFocus={autoFocus}
        placeholder="Busca un puesto: ventas, enfermería, desarrollador…"
        aria-label="Buscar puesto"
        className="w-full rounded-full border border-borde bg-white py-2.5 pr-4 pl-11 text-[15px] outline-none transition placeholder:text-slate-400 focus:border-radar focus:ring-4 focus:ring-radar/15"
      />
      {f.categoria && <input type="hidden" name="categoria" value={f.categoria} />}
      {dondeDe(f) !== "cerca" && <input type="hidden" name="donde" value={dondeDe(f)} />}
      {f.alcance === "todo" && f.pais && <input type="hidden" name="pais" value={f.pais} />}
      {f.alcance === "todo" && f.modalidad && <input type="hidden" name="modalidad" value={f.modalidad} />}
      {f.tipo && <input type="hidden" name="tipo" value={f.tipo} />}
      {f.nivel && <input type="hidden" name="nivel" value={f.nivel} />}
      {f.dias > 0 && <input type="hidden" name="dias" value={f.dias} />}
      {f.conSueldo && <input type="hidden" name="sueldo" value="1" />}
    </form>
  );
}
