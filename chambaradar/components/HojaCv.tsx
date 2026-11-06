import { periodo, renglones, separarHabilidades, TEXTOS, tieneAlgo, type Cv } from "@/lib/cv";

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 break-inside-avoid-page">
      <h2 className="border-b border-slate-300 pb-1 text-[0.8rem] font-bold tracking-[0.12em] text-slate-700 uppercase">{titulo}</h2>
      <div className="mt-2.5 space-y-3">{children}</div>
    </section>
  );
}

function Renglon({ izquierda, derecha }: { izquierda: React.ReactNode; derecha: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4">
      <div className="min-w-0">{izquierda}</div>
      {derecha && <p className="shrink-0 text-[0.8rem] text-slate-500">{derecha}</p>}
    </div>
  );
}

/**
 * La hoja del CV: una sola columna, sin tablas ni gráficos, para que los
 * sistemas de reclutamiento (ATS) la lean bien. Es la misma para la vista
 * previa y para imprimir / guardar como PDF.
 */
export function HojaCv({ cv }: { cv: Cv }) {
  const t = TEXTOS[cv.idioma];
  const contacto = [cv.ciudad, cv.telefono, cv.correo, cv.enlace].map((x) => x.trim()).filter(Boolean);
  const experiencia = cv.experiencia.filter(tieneAlgo);
  const educacion = cv.educacion.filter(tieneAlgo);
  const habilidades = separarHabilidades(cv.habilidades);
  const idiomas = cv.idiomas.filter((i) => i.idioma.trim());
  const cursos = renglones(cv.cursos);
  const vacio = !cv.nombre.trim() && !experiencia.length && !educacion.length && !cv.perfil.trim();

  return (
    <article id="hoja-cv" lang={cv.idioma} className="bg-white px-8 py-9 text-[0.875rem] leading-relaxed text-slate-800 sm:px-11 sm:py-11 print:p-0">
      <div>
        <h1 className="text-[1.75rem] leading-tight font-extrabold tracking-tight text-slate-900">{cv.nombre.trim() || (cv.idioma === "en" ? "Your name" : "Tu nombre")}</h1>
        {cv.titular.trim() && <p className="mt-0.5 text-base font-medium text-blue-700">{cv.titular}</p>}
        {contacto.length > 0 && <p className="mt-2 text-[0.8rem] text-slate-600">{contacto.join("  ·  ")}</p>}
      </div>

      {vacio && <p className="mt-8 text-slate-400">{cv.idioma === "en" ? "Fill in the form and your CV appears here." : "Llena el formulario y tu CV aparece aquí."}</p>}

      {cv.perfil.trim() && (
        <Seccion titulo={t.perfil}>
          <p className="whitespace-pre-line">{cv.perfil.trim()}</p>
        </Seccion>
      )}

      {experiencia.length > 0 && (
        <Seccion titulo={t.experiencia}>
          {experiencia.map((e, i) => (
            <div key={i} className="break-inside-avoid">
              <Renglon
                izquierda={
                  <p>
                    <strong className="font-semibold text-slate-900">{e.puesto || "—"}</strong>
                    {e.empresa && <span> · {e.empresa}</span>}
                    {e.lugar && <span className="text-slate-500"> · {e.lugar}</span>}
                  </p>
                }
                derecha={periodo(e.inicio, e.fin, cv.idioma)}
              />
              {renglones(e.logros).length > 0 && (
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {renglones(e.logros).map((l, j) => (
                    <li key={j}>{l}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </Seccion>
      )}

      {educacion.length > 0 && (
        <Seccion titulo={t.educacion}>
          {educacion.map((e, i) => (
            <Renglon
              key={i}
              izquierda={
                <p>
                  <strong className="font-semibold text-slate-900">{e.titulo || "—"}</strong>
                  {e.escuela && <span> · {e.escuela}</span>}
                  {e.lugar && <span className="text-slate-500"> · {e.lugar}</span>}
                </p>
              }
              derecha={periodo(e.inicio, e.fin, cv.idioma)}
            />
          ))}
        </Seccion>
      )}

      {habilidades.length > 0 && (
        <Seccion titulo={t.habilidades}>
          <p>{habilidades.join("  ·  ")}</p>
        </Seccion>
      )}

      {idiomas.length > 0 && (
        <Seccion titulo={t.idiomas}>
          <p>{idiomas.map((i) => `${i.idioma.trim()} (${t.nivel[i.nivel]})`).join("  ·  ")}</p>
        </Seccion>
      )}

      {cursos.length > 0 && (
        <Seccion titulo={t.cursos}>
          <ul className="list-disc space-y-0.5 pl-5">
            {cursos.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </Seccion>
      )}
      {/* Pie del PDF: cada CV que se envía es una recomendación del sitio */}
      <p className="mt-8 border-t border-slate-200 pt-2 text-center text-[0.68rem] text-slate-400 print:mt-6">
        {cv.idioma === "en" ? "Made for free at " : "Hecho gratis en "}
        <span className="font-semibold text-slate-500">chambaradar.com</span>
        {cv.idioma === "en" ? " · Jobs straight from company career pages" : " · Vacantes que no están en OCC ni LinkedIn"}
      </p>
    </article>
  );
}
