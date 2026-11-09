"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { HojaCv } from "@/components/HojaCv";
import { CV_VACIO, ESTUDIO_VACIO, EXPERIENCIA_VACIA, limpiarCv, NIVELES_IDIOMA, TEXTOS, tituloArchivo, type Cv, type Nivel } from "@/lib/cv";

const LLAVE = "chambaradar-cv";

type Estado = "" | "guardando" | "guardado" | "error";

function leerBorrador(): Cv | null {
  try {
    const t = window.localStorage.getItem(LLAVE);
    return t ? limpiarCv(JSON.parse(t)) : null;
  } catch {
    return null;
  }
}

function Campo({ etiqueta, ayuda, children, className = "" }: { etiqueta: string; ayuda?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block space-y-1 ${className}`}>
      <span className="text-sm font-semibold">{etiqueta}</span>
      {children}
      {ayuda && <span className="block text-xs text-gris">{ayuda}</span>}
    </label>
  );
}

function Bloque({ titulo, texto, children }: { titulo: string; texto?: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4 rounded-3xl border border-borde bg-white p-5 sm:p-6">
      <div>
        <legend className="text-lg font-bold">{titulo}</legend>
        {texto && <p className="text-sm text-gris">{texto}</p>}
      </div>
      {children}
    </fieldset>
  );
}

function Quitar({ alClic, texto }: { alClic: () => void; texto: string }) {
  return (
    <button type="button" onClick={alClic} className="text-sm font-medium text-red-600 hover:underline">
      {texto}
    </button>
  );
}

/**
 * Editor del CV con vista previa en vivo. Siempre guarda un borrador en este
 * navegador; si hay sesión, además lo guarda en la cuenta (unos segundos
 * después del último cambio).
 */
export function EditorCv({
  inicial,
  conSesion,
  guardar,
}: {
  inicial: Cv | null;
  conSesion: boolean;
  guardar: (cv: Cv) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [cv, setCv] = useState<Cv>(inicial ?? CV_VACIO);
  const [listo, setListo] = useState(false);
  const [vista, setVista] = useState<"editar" | "ver">("editar");
  const [estado, setEstado] = useState<Estado>("");
  const cambiado = useRef(false);

  // Al abrir: lo de la cuenta manda; si no hay, el borrador de este navegador
  useEffect(() => {
    if (!inicial) {
      const b = leerBorrador();
      if (b) {
        setCv(b);
        cambiado.current = conSesion; // un borrador sin cuenta se sube al entrar
      }
    }
    setListo(true);
  }, [inicial, conSesion]);

  useEffect(() => {
    if (!listo) return;
    try {
      window.localStorage.setItem(LLAVE, JSON.stringify(cv));
    } catch {
      // modo privado o almacenamiento lleno: solo se pierde el borrador local
    }
    if (!conSesion || !cambiado.current) return;
    setEstado("guardando");
    const t = setTimeout(async () => {
      try {
        const r = await guardar(cv);
        setEstado(r.ok ? "guardado" : "error");
        if (r.ok) cambiado.current = false;
      } catch {
        setEstado("error");
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [cv, listo, conSesion, guardar]);

  const cambiar = (f: (c: Cv) => Cv) => {
    cambiado.current = true;
    setCv((c) => f(c));
  };
  const poner = <K extends keyof Cv>(k: K, v: Cv[K]) => cambiar((c) => ({ ...c, [k]: v }));
  const enLista = <K extends "experiencia" | "educacion" | "idiomas">(k: K, i: number, cambio: Partial<Cv[K][number]>) =>
    cambiar((c) => ({ ...c, [k]: c[k].map((x, j) => (j === i ? { ...x, ...cambio } : x)) }));
  const quitarDe = (k: "experiencia" | "educacion" | "idiomas", i: number) => cambiar((c) => ({ ...c, [k]: c[k].filter((_, j) => j !== i) }));
  const mover = (i: number, d: -1 | 1) =>
    cambiar((c) => {
      const e = [...c.experiencia];
      const j = i + d;
      if (j < 0 || j >= e.length) return c;
      [e[i], e[j]] = [e[j], e[i]];
      return { ...c, experiencia: e };
    });

  const descargar = () => {
    const antes = document.title;
    document.title = tituloArchivo(cv); // el navegador lo usa como nombre del PDF
    window.print();
    document.title = antes;
  };

  const ingles = cv.idioma === "en";
  const t = TEXTOS[cv.idioma];

  return (
    <div className="space-y-5">
      {/* Barra de acciones */}
      <div className="sticky top-16 z-30 -mx-4 flex flex-wrap items-center gap-2 border-b border-borde bg-fondo/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-4 print:hidden">
        <div className="flex rounded-full border border-borde bg-white p-1 text-sm font-semibold" role="group" aria-label="Idioma del CV">
          {(["es", "en"] as const).map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => poner("idioma", i)}
              className={`rounded-full px-3 py-1.5 transition ${cv.idioma === i ? "bg-noche text-white" : "text-gris hover:text-tinta"}`}
              aria-pressed={cv.idioma === i}
            >
              {i === "es" ? "Español" : "English"}
            </button>
          ))}
        </div>
        <div className="flex rounded-full border border-borde bg-white p-1 text-sm font-semibold lg:hidden" role="group" aria-label="Vista">
          {(["editar", "ver"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVista(v)}
              className={`rounded-full px-3 py-1.5 transition ${vista === v ? "bg-radar text-white" : "text-gris hover:text-tinta"}`}
              aria-pressed={vista === v}
            >
              {v === "editar" ? "Editar" : "Vista previa"}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-gris" aria-live="polite">
          {conSesion
            ? { "": "Se guarda en tu cuenta", guardando: "Guardando…", guardado: "Guardado en tu cuenta ✓", error: "No se pudo guardar; sigue en este navegador" }[estado]
            : "Guardado en este navegador"}
        </span>
        <button type="button" onClick={descargar} className="boton px-4 py-2 text-sm">
          Descargar PDF
        </button>
      </div>

      {!conSesion && (
        <p className="rounded-2xl bg-radar-claro px-4 py-3 text-sm text-radar-oscuro print:hidden">
          Tu CV se queda en este navegador.{" "}
          <Link href="/entrar?siguiente=/cv" className="font-semibold underline">
            Entra con tu correo
          </Link>{" "}
          para guardarlo en tu cuenta y abrirlo desde cualquier celular o computadora.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Formulario */}
        <div className={`space-y-5 print:hidden ${vista === "ver" ? "hidden lg:block" : ""}`}>
          {ingles && (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Los títulos del CV ya salen en inglés. Escribe también tus puestos, logros y perfil en inglés: así lo piden las empresas que pagan en dólares.
            </p>
          )}

          <Bloque titulo="Tus datos">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Nombre completo" className="sm:col-span-2">
                <input className="campo" value={cv.nombre} onChange={(e) => poner("nombre", e.target.value)} autoComplete="name" placeholder="Ana López García" />
              </Campo>
              <Campo etiqueta={ingles ? "Puesto que buscas (en inglés)" : "Puesto que buscas"} className="sm:col-span-2">
                <input className="campo" value={cv.titular} onChange={(e) => poner("titular", e.target.value)} placeholder={ingles ? "Customer Support Specialist" : "Auxiliar contable"} />
              </Campo>
              <Campo etiqueta="Ciudad">
                <input className="campo" value={cv.ciudad} onChange={(e) => poner("ciudad", e.target.value)} autoComplete="address-level2" placeholder="Hermosillo, Sonora" />
              </Campo>
              <Campo etiqueta="Teléfono / WhatsApp">
                <input className="campo" value={cv.telefono} onChange={(e) => poner("telefono", e.target.value)} autoComplete="tel" inputMode="tel" placeholder="644 123 4567" />
              </Campo>
              <Campo etiqueta="Correo">
                <input className="campo" value={cv.correo} onChange={(e) => poner("correo", e.target.value)} autoComplete="email" inputMode="email" placeholder="ana@gmail.com" />
              </Campo>
              <Campo etiqueta="LinkedIn o portafolio" ayuda="Opcional">
                <input className="campo" value={cv.enlace} onChange={(e) => poner("enlace", e.target.value)} placeholder="linkedin.com/in/ana-lopez" />
              </Campo>
            </div>
            <p className="text-xs text-gris">No pongas tu CURP, RFC, foto, estado civil ni domicilio completo: no hacen falta y te protegen de fraudes.</p>
          </Bloque>

          <Bloque titulo={t.perfil} texto="2 a 4 renglones: quién eres, en qué eres bueno y qué buscas.">
            <textarea
              className="campo min-h-28"
              value={cv.perfil}
              onChange={(e) => poner("perfil", e.target.value)}
              placeholder={
                ingles
                  ? "Customer support specialist with 3 years of experience in bilingual call centers. Fast learner, great with people and CRM tools."
                  : "Auxiliar contable con 3 años de experiencia en facturación y conciliaciones. Responsable, ordenada y con manejo avanzado de Excel y CONTPAQi."
              }
            />
          </Bloque>

          <Bloque titulo={t.experiencia} texto="Empieza por el trabajo más reciente. Si no tienes experiencia formal, pon prácticas, negocio propio o trabajos de temporada.">
            {cv.experiencia.map((e, i) => (
              <div key={i} className="space-y-3 rounded-2xl border border-borde bg-fondo/60 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Campo etiqueta="Puesto">
                    <input className="campo" value={e.puesto} onChange={(x) => enLista("experiencia", i, { puesto: x.target.value })} />
                  </Campo>
                  <Campo etiqueta="Empresa">
                    <input className="campo" value={e.empresa} onChange={(x) => enLista("experiencia", i, { empresa: x.target.value })} />
                  </Campo>
                  <Campo etiqueta="Ciudad">
                    <input className="campo" value={e.lugar} onChange={(x) => enLista("experiencia", i, { lugar: x.target.value })} />
                  </Campo>
                  <div className="grid grid-cols-2 gap-3">
                    <Campo etiqueta="Desde">
                      <input className="campo" value={e.inicio} onChange={(x) => enLista("experiencia", i, { inicio: x.target.value })} placeholder="2022" />
                    </Campo>
                    <Campo etiqueta="Hasta">
                      <input className="campo" value={e.fin} onChange={(x) => enLista("experiencia", i, { fin: x.target.value })} placeholder={t.actual} />
                    </Campo>
                  </div>
                </div>
                <Campo etiqueta="Qué hacías y qué lograste" ayuda="Un renglón por punto. Usa números cuando puedas: “Atendía 60 clientes al día”.">
                  <textarea className="campo min-h-24" value={e.logros} onChange={(x) => enLista("experiencia", i, { logros: x.target.value })} />
                </Campo>
                <div className="flex flex-wrap gap-4">
                  {i > 0 && (
                    <button type="button" onClick={() => mover(i, -1)} className="text-sm font-medium text-gris hover:text-tinta">
                      ↑ Subir
                    </button>
                  )}
                  {i < cv.experiencia.length - 1 && (
                    <button type="button" onClick={() => mover(i, 1)} className="text-sm font-medium text-gris hover:text-tinta">
                      ↓ Bajar
                    </button>
                  )}
                  <Quitar alClic={() => quitarDe("experiencia", i)} texto="Quitar" />
                </div>
              </div>
            ))}
            {cv.experiencia.length < 12 && (
              <button type="button" onClick={() => poner("experiencia", [...cv.experiencia, { ...EXPERIENCIA_VACIA }])} className="boton-secundario px-4 py-2 text-sm">
                + Agregar trabajo
              </button>
            )}
          </Bloque>

          <Bloque titulo={t.educacion}>
            {cv.educacion.map((e, i) => (
              <div key={i} className="space-y-3 rounded-2xl border border-borde bg-fondo/60 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Campo etiqueta="Carrera o nivel">
                    <input className="campo" value={e.titulo} onChange={(x) => enLista("educacion", i, { titulo: x.target.value })} placeholder="Lic. en Administración" />
                  </Campo>
                  <Campo etiqueta="Escuela">
                    <input className="campo" value={e.escuela} onChange={(x) => enLista("educacion", i, { escuela: x.target.value })} placeholder="ITSON" />
                  </Campo>
                  <Campo etiqueta="Ciudad">
                    <input className="campo" value={e.lugar} onChange={(x) => enLista("educacion", i, { lugar: x.target.value })} />
                  </Campo>
                  <div className="grid grid-cols-2 gap-3">
                    <Campo etiqueta="Desde">
                      <input className="campo" value={e.inicio} onChange={(x) => enLista("educacion", i, { inicio: x.target.value })} placeholder="2018" />
                    </Campo>
                    <Campo etiqueta="Hasta">
                      <input className="campo" value={e.fin} onChange={(x) => enLista("educacion", i, { fin: x.target.value })} placeholder="2022" />
                    </Campo>
                  </div>
                </div>
                <Quitar alClic={() => quitarDe("educacion", i)} texto="Quitar" />
              </div>
            ))}
            {cv.educacion.length < 8 && (
              <button type="button" onClick={() => poner("educacion", [...cv.educacion, { ...ESTUDIO_VACIO }])} className="boton-secundario px-4 py-2 text-sm">
                + Agregar estudios
              </button>
            )}
          </Bloque>

          <Bloque titulo={t.habilidades} texto="Separadas por comas. Programas, máquinas, licencias, certificaciones de seguridad…">
            <textarea
              className="campo min-h-20"
              value={cv.habilidades}
              onChange={(e) => poner("habilidades", e.target.value)}
              placeholder={ingles ? "Zendesk, Excel, customer service, data entry" : "Excel avanzado, CONTPAQi, atención a clientes, licencia de manejo tipo B"}
            />
          </Bloque>

          <Bloque titulo={t.idiomas}>
            {cv.idiomas.map((idioma, i) => (
              <div key={i} className="flex flex-wrap items-end gap-3">
                <Campo etiqueta="Idioma" className="min-w-32 flex-1">
                  <input className="campo" value={idioma.idioma} onChange={(x) => enLista("idiomas", i, { idioma: x.target.value })} placeholder="Inglés" />
                </Campo>
                <Campo etiqueta="Nivel" className="min-w-32 flex-1">
                  <select className="campo" value={idioma.nivel} onChange={(x) => enLista("idiomas", i, { nivel: x.target.value as Nivel })}>
                    {NIVELES_IDIOMA.map((n) => (
                      <option key={n} value={n}>
                        {TEXTOS.es.nivel[n]}
                      </option>
                    ))}
                  </select>
                </Campo>
                <div className="pb-2">
                  <Quitar alClic={() => quitarDe("idiomas", i)} texto="Quitar" />
                </div>
              </div>
            ))}
            {cv.idiomas.length < 8 && (
              <button type="button" onClick={() => poner("idiomas", [...cv.idiomas, { idioma: "", nivel: "intermedio" }])} className="boton-secundario px-4 py-2 text-sm">
                + Agregar idioma
              </button>
            )}
          </Bloque>

          <Bloque titulo={t.cursos} texto="Opcional. Un renglón por curso.">
            <textarea className="campo min-h-20" value={cv.cursos} onChange={(e) => poner("cursos", e.target.value)} placeholder="Curso de Excel intermedio · Fundación Carlos Slim · 2024" />
          </Bloque>
        </div>

        {/* Vista previa */}
        <div className={`lg:block print:block ${vista === "editar" ? "hidden" : ""}`}>
          <div className="lg:sticky lg:top-36">
            <div className="overflow-hidden rounded-2xl border border-borde shadow-xl print:rounded-none print:border-0 print:shadow-none">
              <HojaCv cv={cv} />
            </div>
            <p className="mt-3 text-center text-xs text-gris print:hidden">
              “Descargar PDF” abre la ventana de impresión: elige <strong>Guardar como PDF</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
