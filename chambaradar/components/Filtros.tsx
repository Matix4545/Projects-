"use client";

import { CATEGORIAS, NIVELES, NOMBRE_CATEGORIA, NOMBRE_NIVEL, PAISES } from "@/lib/tipos";
import type { Filtros as TFiltros } from "@/lib/vacantes";

/** Formulario GET: cada cambio actualiza la URL, y la página lee los filtros de ahí. */
export function Filtros({ f }: { f: TFiltros }) {
  const enviar = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => e.currentTarget.form?.requestSubmit();

  return (
    <form
      action="/vacantes"
      // No mandar los filtros vacíos, para que la URL quede limpia (/vacantes?pais=MX)
      onSubmit={(e) => {
        const campos = [...e.currentTarget.elements] as HTMLInputElement[];
        const vacios = campos.filter((c) => c.name && !c.value);
        vacios.forEach((c) => (c.disabled = true));
        setTimeout(() => vacios.forEach((c) => (c.disabled = false)));
      }}
      className="space-y-3 rounded-2xl border border-borde bg-white p-4 shadow-sm">
      <div className="flex gap-2">
        <input name="q" defaultValue={f.q} placeholder="Puesto: desarrollador, ventas, diseño…" className="campo" aria-label="Buscar puesto" />
        <button className="boton px-4 py-2 text-sm">Buscar</button>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <select name="tipo" defaultValue={f.tipo} onChange={enviar} className="campo" aria-label="Tipo de empresa">
          <option value="">Todas las empresas</option>
          <option value="local">Empresas de LATAM</option>
          <option value="remoto">Extranjeras (USD)</option>
        </select>
        <select name="pais" defaultValue={f.pais} onChange={enviar} className="campo" aria-label="País">
          <option value="">Cualquier país</option>
          {Object.entries(PAISES).map(([codigo, nombre]) => (
            <option key={codigo} value={codigo}>
              {nombre}
            </option>
          ))}
        </select>
        <select name="modalidad" defaultValue={f.modalidad} onChange={enviar} className="campo" aria-label="Modalidad">
          <option value="">Cualquier modalidad</option>
          <option value="remoto">Remoto</option>
          <option value="hibrido">Híbrido</option>
          <option value="presencial">Presencial</option>
        </select>
        <select name="categoria" defaultValue={f.categoria} onChange={enviar} className="campo" aria-label="Área">
          <option value="">Todas las áreas</option>
          {CATEGORIAS.map((c) => (
            <option key={c} value={c}>
              {NOMBRE_CATEGORIA[c]}
            </option>
          ))}
        </select>
        <select name="nivel" defaultValue={f.nivel} onChange={enviar} className="campo" aria-label="Nivel">
          <option value="">Cualquier nivel</option>
          {NIVELES.map((n) => (
            <option key={n} value={n}>
              {NOMBRE_NIVEL[n]}
            </option>
          ))}
        </select>
        <select name="dias" defaultValue={f.dias || ""} onChange={enviar} className="campo" aria-label="Fecha de publicación">
          <option value="">Cualquier fecha</option>
          <option value="1">Últimas 24 horas</option>
          <option value="7">Última semana</option>
          <option value="30">Último mes</option>
        </select>
      </div>
      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-gris">
        <input type="checkbox" name="sueldo" value="1" defaultChecked={f.conSueldo} onChange={enviar} className="size-4 accent-radar" />
        Solo con sueldo publicado
      </label>
    </form>
  );
}
