"use client";

import { useState } from "react";
import { leerPublicacion, type DatosVacante } from "@/lib/captura";
import { CATEGORIAS, NOMBRE_CATEGORIA } from "@/lib/tipos";

const VACIO: DatosVacante = {
  empresa: "",
  puesto: "",
  categoria: "otros",
  modalidad: "presencial",
  ubicacion: "",
  sueldo_min: null,
  sueldo_max: null,
  periodo: "semana",
  horario: "",
  descripcion: "",
  contacto_whatsapp: "",
  contacto_correo: "",
  contacto_url: "",
};

function Campo({ etiqueta, ayuda, children }: { etiqueta: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold">{etiqueta}</span>
      {children}
      {ayuda && <span className="block text-xs text-gris">{ayuda}</span>}
    </label>
  );
}

/**
 * Formulario de vacante. Con `conCaptura`, arriba aparece la caja para pegar el
 * texto de una publicación y llenar los campos solos (panel de administración).
 */
export function FormVacante({
  accion,
  boton,
  conCaptura = false,
  conAviso = false,
}: {
  accion: (f: FormData) => void | Promise<void>;
  boton: string;
  conCaptura?: boolean;
  conAviso?: boolean;
}) {
  const [d, setD] = useState<DatosVacante>(VACIO);
  const [texto, setTexto] = useState("");
  const [leido, setLeido] = useState(false);
  const poner = <K extends keyof DatosVacante>(k: K, v: DatosVacante[K]) => setD((x) => ({ ...x, [k]: v }));
  const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(/[^\d.]/g, "")) || null);

  return (
    <form action={accion} className="space-y-5">
      {conCaptura && (
        <div className="space-y-2 rounded-2xl border-2 border-dashed border-radar/40 bg-radar-claro/30 p-4">
          <p className="text-sm font-semibold">Pega aquí el texto de la publicación (Facebook, WhatsApp…)</p>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={6}
            placeholder={"SE SOLICITA: Ayudante de cocina\nSueldo $2,500 semanales\nWhatsApp 644 123 4567"}
            className="campo font-mono text-[13px]"
          />
          <button
            type="button"
            onClick={() => {
              setD({ ...VACIO, ...leerPublicacion(texto) });
              setLeido(true);
            }}
            disabled={!texto.trim()}
            className="boton-oscuro disabled:opacity-40"
          >
            Llenar campos
          </button>
          {leido && <p className="text-xs text-radar-oscuro">Listo. Revisa y corrige cada campo antes de publicar.</p>}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Negocio o empresa *">
          <input name="empresa" required value={d.empresa} onChange={(e) => poner("empresa", e.target.value)} className="campo py-2.5" placeholder="Ej. Mariscos El Faro" />
        </Campo>
        <Campo etiqueta="Puesto *">
          <input name="puesto" required value={d.puesto} onChange={(e) => poner("puesto", e.target.value)} className="campo py-2.5" placeholder="Ej. Ayudante de cocina" />
        </Campo>
        <Campo etiqueta="Área">
          <select name="categoria" value={d.categoria} onChange={(e) => poner("categoria", e.target.value as DatosVacante["categoria"])} className="campo py-2.5">
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {NOMBRE_CATEGORIA[c]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Modalidad">
          <select name="modalidad" value={d.modalidad} onChange={(e) => poner("modalidad", e.target.value as DatosVacante["modalidad"])} className="campo py-2.5">
            <option value="presencial">Presencial</option>
            <option value="hibrido">Híbrido</option>
            <option value="remoto">Home office</option>
          </select>
        </Campo>
        <Campo etiqueta="Ubicación">
          <input name="ubicacion" value={d.ubicacion} onChange={(e) => poner("ubicacion", e.target.value)} className="campo py-2.5" required placeholder="Ciudad, Estado" />
        </Campo>
        <Campo etiqueta="Horario">
          <input name="horario" value={d.horario} onChange={(e) => poner("horario", e.target.value)} className="campo py-2.5" placeholder="Ej. Lunes a sábado, 8 a 4" />
        </Campo>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Sueldo (opcional, en pesos)</legend>
        <div className="grid grid-cols-3 gap-2">
          <input name="sueldo_min" inputMode="numeric" value={d.sueldo_min ?? ""} onChange={(e) => poner("sueldo_min", num(e.target.value))} className="campo py-2.5" placeholder="Desde" aria-label="Sueldo desde" />
          <input name="sueldo_max" inputMode="numeric" value={d.sueldo_max ?? ""} onChange={(e) => poner("sueldo_max", num(e.target.value))} className="campo py-2.5" placeholder="Hasta" aria-label="Sueldo hasta" />
          <select name="periodo" value={d.periodo ?? "semana"} onChange={(e) => poner("periodo", e.target.value as DatosVacante["periodo"])} className="campo py-2.5" aria-label="Periodo">
            <option value="semana">por semana</option>
            <option value="mes">por mes</option>
            <option value="hora">por hora</option>
          </select>
        </div>
      </fieldset>

      <Campo etiqueta="Descripción y requisitos">
        <textarea name="descripcion" rows={6} value={d.descripcion} onChange={(e) => poner("descripcion", e.target.value)} className="campo" placeholder="Qué hará la persona, requisitos, prestaciones…" />
      </Campo>

      <fieldset className="space-y-3 rounded-2xl border border-borde p-4">
        <legend className="px-1 text-sm font-semibold">¿Cómo aplican? (al menos uno) *</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo etiqueta="WhatsApp" ayuda="10 dígitos. De preferencia el del negocio.">
            <input name="contacto_whatsapp" inputMode="tel" value={d.contacto_whatsapp} onChange={(e) => poner("contacto_whatsapp", e.target.value)} className="campo py-2.5" placeholder="644 123 4567" />
          </Campo>
          <Campo etiqueta="Correo">
            <input name="contacto_correo" type="email" value={d.contacto_correo} onChange={(e) => poner("contacto_correo", e.target.value)} className="campo py-2.5" placeholder="rh@negocio.com" />
          </Campo>
          <Campo etiqueta="Enlace">
            <input name="contacto_url" type="url" value={d.contacto_url} onChange={(e) => poner("contacto_url", e.target.value)} className="campo py-2.5" placeholder="https://…" />
          </Campo>
        </div>
      </fieldset>

      {conAviso && (
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" required className="mt-0.5 size-4 accent-radar" />
          <span>
            Confirmo que represento a este negocio, que la vacante es real y que no cobraré a nadie por el empleo. Acepto los{" "}
            <a href="/terminos" className="underline">
              términos
            </a>
            .
          </span>
        </label>
      )}

      <button className="boton w-full py-3.5 text-base sm:w-auto">{boton}</button>
    </form>
  );
}
