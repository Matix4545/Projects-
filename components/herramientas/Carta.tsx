"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CARTA_VACIA, PROBLEMAS, armarCarta, type DatosCarta, type Problema, type TipoEscrito } from "@/lib/herramientas/carta";

const DESTINATARIO_DANOS = "H. Ayuntamiento de Cajeme";

function Campo({ etiqueta, nota, children }: { etiqueta: string; nota?: string; children: ReactNode }) {
  return (
    <label className="block px-4 py-3">
      <span className="text-[15px] font-medium">{etiqueta}</span>
      <div className="mt-1.5">{children}</div>
      {nota && <span className="mt-1 block text-[13px] text-ios-secundario">{nota}</span>}
    </label>
  );
}

/** Generador de escritos: arma el texto en el celular; no se envía ni se guarda nada */
export function Carta() {
  const [d, setD] = useState<DatosCarta>(CARTA_VACIA);
  const [destinatarioEditado, setDestinatarioEditado] = useState(false);
  const [copiado, setCopiado] = useState(false);

  // /herramientas/carta?tipo=danos (desde la guía de reclamación) abre ya en "Reclamar daños"
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tipo") === "danos") cambiarTipo("danos");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const poner = <K extends keyof DatosCarta>(campo: K, valor: DatosCarta[K]) => setD((x) => ({ ...x, [campo]: valor }));

  function cambiarTipo(tipo: TipoEscrito) {
    setD((x) => ({
      ...x,
      tipo,
      problema: tipo === "danos" ? "bache" : x.problema,
      destinatario: destinatarioEditado ? x.destinatario : tipo === "danos" ? DESTINATARIO_DANOS : PROBLEMAS[x.problema].destinatario,
    }));
  }

  function cambiarProblema(problema: Problema) {
    setD((x) => ({ ...x, problema, destinatario: destinatarioEditado ? x.destinatario : PROBLEMAS[problema].destinatario }));
  }

  const texto = useMemo(() => armarCarta(d), [d]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      /* sin permiso: queda el texto en pantalla para copiarlo a mano */
    }
  }

  const danos = d.tipo === "danos";

  return (
    <div className="space-y-6">
      <div className="space-y-6 print:hidden">
        <section>
          <h2 className="titulo-grupo">¿Qué necesitas?</h2>
          <div className="segmentado" role="group" aria-label="Tipo de escrito">
            <button type="button" aria-pressed={!danos} onClick={() => cambiarTipo("reparacion")}>
              Pedir que lo reparen
            </button>
            <button type="button" aria-pressed={danos} onClick={() => cambiarTipo("danos")}>
              Reclamar daños a mi carro
            </button>
          </div>
        </section>

        <section>
          <h2 className="titulo-grupo">El problema</h2>
          <div className="grupo">
            {!danos && (
              <Campo etiqueta="¿Qué pasa?">
                <select className="campo" value={d.problema} onChange={(e) => cambiarProblema(e.target.value as Problema)}>
                  {(Object.keys(PROBLEMAS) as Problema[]).map((p) => (
                    <option key={p} value={p}>
                      {PROBLEMAS[p].nombre}
                    </option>
                  ))}
                </select>
              </Campo>
            )}
            <Campo etiqueta="¿Dónde?" nota="Calle y número, o entre qué calles.">
              <input className="campo" value={d.ubicacion} onChange={(e) => poner("ubicacion", e.target.value)} placeholder="Calle Jalisco entre Hidalgo y Allende" />
            </Campo>
            <Campo etiqueta="Colonia">
              <input className="campo" value={d.colonia} onChange={(e) => poner("colonia", e.target.value)} placeholder="Centro" />
            </Campo>
            {danos ? (
              <>
                <Campo etiqueta="¿Cuándo pasó?">
                  <input type="date" className="campo" value={d.fechaIncidente} onChange={(e) => poner("fechaIncidente", e.target.value)} />
                </Campo>
                <Campo etiqueta="Tu vehículo" nota="Marca, modelo, color y placas.">
                  <input className="campo" value={d.vehiculo} onChange={(e) => poner("vehiculo", e.target.value)} />
                </Campo>
                <Campo etiqueta="¿Qué se dañó?">
                  <input className="campo" value={d.danos} onChange={(e) => poner("danos", e.target.value)} placeholder="Llanta delantera derecha y rin" />
                </Campo>
                <Campo etiqueta="Costo de la reparación (pesos)" nota="Según tu cotización o factura.">
                  <input className="campo" inputMode="decimal" value={d.monto} onChange={(e) => poner("monto", e.target.value)} placeholder="3,500" />
                </Campo>
              </>
            ) : (
              <Campo etiqueta="¿Desde cuándo?" nota="Opcional.">
                <input type="date" className="campo" value={d.desde} onChange={(e) => poner("desde", e.target.value)} />
              </Campo>
            )}
            <Campo etiqueta="Detalles" nota="Opcional. Qué tan grave es, a quién afecta, qué pasó.">
              <textarea className="campo min-h-24" maxLength={1200} value={d.descripcion} onChange={(e) => poner("descripcion", e.target.value)} />
            </Campo>
          </div>
        </section>

        <section>
          <h2 className="titulo-grupo">Evidencia (opcional)</h2>
          <div className="grupo">
            <Campo etiqueta="Enlace del reporte en Reporta Cajeme" nota="Toca el reporte en el mapa y usa “Copiar enlace”.">
              <input className="campo" inputMode="url" value={d.enlace} onChange={(e) => poner("enlace", e.target.value)} placeholder="https://…/?pin=123" />
            </Campo>
            <Campo etiqueta="Folio de un reporte oficial anterior">
              <input className="campo" value={d.folio} onChange={(e) => poner("folio", e.target.value)} />
            </Campo>
          </div>
        </section>

        <section>
          <h2 className="titulo-grupo">Tus datos</h2>
          <div className="grupo">
            <Campo etiqueta="Nombre completo">
              <input className="campo" autoComplete="name" value={d.nombre} onChange={(e) => poner("nombre", e.target.value)} />
            </Campo>
            <Campo etiqueta="Domicilio para recibir respuesta">
              <input className="campo" autoComplete="street-address" value={d.domicilio} onChange={(e) => poner("domicilio", e.target.value)} />
            </Campo>
            <Campo etiqueta="Teléfono o correo" nota="Opcional.">
              <input className="campo" value={d.contacto} onChange={(e) => poner("contacto", e.target.value)} />
            </Campo>
          </div>
          <p className="nota-grupo">La autoridad los necesita para contestarte. Aquí no se envían ni se guardan: el escrito se arma en tu celular.</p>
        </section>

        <section>
          <h2 className="titulo-grupo">Dirigido a</h2>
          <div className="grupo">
            <Campo etiqueta="Dependencia" nota="Puedes cambiarlo si te indicaron otra área.">
              <textarea
                className="campo min-h-16"
                value={d.destinatario}
                onChange={(e) => {
                  setDestinatarioEditado(true);
                  poner("destinatario", e.target.value);
                }}
              />
            </Campo>
          </div>
        </section>
      </div>

      <section>
        <h2 className="titulo-grupo print:hidden">Tu escrito</h2>
        <div id="carta-impresion" className="whitespace-pre-wrap rounded-2xl bg-white px-5 py-6 font-serif text-[15px] leading-relaxed print:p-0 print:text-[12pt]">
          {texto}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 print:hidden">
          <button type="button" className="boton boton-tenue" onClick={copiar}>
            {copiado ? "Copiado" : "Copiar texto"}
          </button>
          <button type="button" className="boton boton-principal" onClick={() => window.print()}>
            Imprimir o PDF
          </button>
        </div>
        <p className="nota-grupo print:hidden">
          Imprime dos copias y fírmalas. Entrega una en la oficialía de partes y pide que te sellen la otra con fecha: ese es
          tu acuse. Es un formato orientativo, no asesoría legal.
        </p>
      </section>
    </div>
  );
}
