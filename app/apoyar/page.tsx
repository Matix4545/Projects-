import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { DibujoParabrisas } from "@/components/DibujoParabrisas";
import { Pagina } from "@/components/Pagina";
import { MOSTRAR_APOYAR, NIVELES_BACHE } from "@/lib/constantes";

// Para voluntarios: qué es medir baches con la cámara, qué se necesita y cómo se hace.
// El botón del mapa que trae aquí se prende con MOSTRAR_APOYAR (después de la prueba en calle).
export const metadata: Metadata = {
  title: "Apoya a Reporta Cajeme · Mide baches con tu celular",
  description: "Con tu celular en el parabrisas encuentras los baches de tu camino mientras manejas y se suben solos al mapa de Reporta Cajeme.",
  robots: MOSTRAR_APOYAR ? undefined : { index: false, follow: false },
};

const contacto = process.env.NEXT_PUBLIC_CONTACTO;

export default function PaginaApoyar() {
  return (
    <Pagina
      titulo="Apoya a Reporta Cajeme"
      ancho="max-w-md"
      subtitulo="Con tu celular en el parabrisas encuentras los baches de tu camino mientras manejas, y se suben solos al mapa. Así todos sabemos qué calles están peor."
    >
      <section className="overflow-hidden rounded-3xl bg-white">
        <DibujoParabrisas id="apoyar-portada" />
        <div className="grid grid-cols-3 divide-x divide-ios-separador py-3 text-center">
          {[
            ["Detecta", "cada bache"],
            ["Mide", "su tamaño"],
            ["Lo sube", "a su calle"],
          ].map(([a, b]) => (
            <p key={a} className="px-2 text-[13px] leading-tight text-ios-secundario">
              <strong className="block text-[16px] font-semibold text-ios-etiqueta">{a}</strong>
              {b}
            </p>
          ))}
        </div>
      </section>

      <section>
        <h2 className="titulo-grupo">Qué necesitas</h2>
        <ul className="grupo">
          {(
            [
              ["celular", "Un celular con cámara", "Android o iPhone de los últimos años, con internet."],
              ["soporte", "Un soporte para el parabrisas", "Que lo sostenga firme, acostado y viendo al frente."],
              ["cargador", "Cargador para el carro", "La cámara y el GPS gastan batería."],
              ["sol", "Manejar de día", "De noche la cámara casi no ve los baches."],
              ["llave", "Tu código de voluntario", "Te lo da el equipo de Reporta Cajeme."],
            ] as const
          ).map(([icono, titulo, texto]) => (
            <li key={titulo} className="flex items-center gap-3 px-4 py-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ios-azul/10 text-ios-azul" aria-hidden>
                <Icono nombre={icono} />
              </span>
              <span className="text-[16px] leading-tight">
                {titulo}
                <span className="block text-[14px] text-ios-secundario">{texto}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="titulo-grupo">Cómo se hace</h2>
        <Paso n={1} titulo="Coloca el celular">
          <p>
            <strong className="font-semibold text-ios-etiqueta">Acostado</strong>, en el soporte del parabrisas, con la cámara viendo la calle. Hazlo antes de arrancar y
            conéctalo al cargador.
          </p>
        </Paso>
        <Paso n={2} titulo="Revisa la cámara">
          <p>
            Abre <strong className="font-semibold text-ios-etiqueta">reportacajeme.org/medir</strong>, toca <strong className="font-semibold text-ios-etiqueta">Entrar</strong>{" "}
            y escribe tu código. Luego toca <strong className="font-semibold text-ios-etiqueta">Revisar la cámara</strong>: cuando diga “Bien colocado”, toca Listo.
          </p>
          <div className="flex justify-center rounded-2xl bg-ios-fondo py-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#248a3d] px-3 py-1.5 text-[14px] font-semibold text-white">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                <path d="M3 8.5l3.2 3L13 4.5" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Bien colocado
            </span>
          </div>
        </Paso>
        <Paso n={3} titulo="Maneja">
          <p>
            Toca <strong className="font-semibold text-ios-etiqueta">Empezar a medir</strong> y maneja normal: no tienes que tocar nada. Ya estacionado, toca{" "}
            <strong className="font-semibold text-ios-etiqueta">Terminar</strong> y verás cuántos baches encontraste.
          </p>
        </Paso>
      </section>

      <section>
        <h2 className="titulo-grupo">Así se ven los baches</h2>
        <div className="grupo">
          {NIVELES_BACHE.map((n) => (
            <div key={n.clave} className="flex items-center gap-3 px-4 py-3 text-[16px]">
              <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: n.color }} aria-hidden />
              <span className="flex-1">Bache {n.nombre.toLowerCase()}</span>
              <span className="text-[14px] text-ios-secundario">{n.rango}</span>
            </div>
          ))}
        </div>
        <p className="nota-grupo">
          Así se marcan en la cámara mientras manejas. En el mapa se suben como “Bache chico, mediano o grande” en su calle, igual que si lo reportara un vecino. Si ya
          estaba reportado, se suma tu pasada. Una llanta mide unos 60 cm.
        </p>
      </section>

      <Tarjeta titulo="Tu seguridad primero" tono="naranja">
        <li>No uses el celular mientras manejas: déjalo listo antes de arrancar.</li>
        <li>Si vas acompañado, que el copiloto lo revise.</li>
        <li>Que el soporte no te tape la vista.</li>
      </Tarjeta>

      <Tarjeta titulo="Tu privacidad" tono="gris">
        <li>Nunca se envía el video: solo un recorte de cada bache.</li>
        <li>No pedimos tu nombre. No guardamos dónde empieza ni dónde termina tu viaje.</li>
      </Tarjeta>

      <section className="space-y-3 rounded-3xl bg-white p-5 text-center">
        <p className="text-[20px] font-semibold tracking-tight">¿Ya tienes tu código?</p>
        <Link href="/medir" className="boton boton-principal h-14 w-full text-[18px] shadow-[0_8px_20px_rgba(0,122,255,0.25)]">
          Ir a medir
        </Link>
        <p className="text-[15px] text-ios-secundario">
          ¿No tienes código?{" "}
          {contacto ? (
            <>
              Escríbenos a{" "}
              <a href={`mailto:${contacto}?subject=${encodeURIComponent("Quiero ser voluntario para medir baches")}`} className="text-ios-azul">
                {contacto}
              </a>{" "}
              y te lo mandamos.
            </>
          ) : (
            "Pídelo al equipo de Reporta Cajeme."
          )}
        </p>
      </section>
    </Pagina>
  );
}

function Paso({ n, titulo, children }: { n: number; titulo: string; children: ReactNode }) {
  return (
    <div className="rounded-3xl bg-white p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ios-azul text-[15px] font-bold text-white" aria-hidden>
          {n}
        </span>
        <h3 className="text-[19px] font-semibold tracking-tight">{titulo}</h3>
      </div>
      <div className="mt-2.5 space-y-3 text-[15px] leading-snug text-ios-secundario">{children}</div>
    </div>
  );
}

function Tarjeta({ titulo, tono, children }: { titulo: string; tono: "naranja" | "gris"; children: ReactNode }) {
  return (
    <section className={`rounded-3xl p-4 ${tono === "naranja" ? "bg-ios-naranja/12" : "bg-white"}`}>
      <h2 className={`text-[17px] font-semibold ${tono === "naranja" ? "text-[#c93400]" : ""}`}>{titulo}</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] leading-snug text-ios-etiqueta/80">{children}</ul>
    </section>
  );
}

/** Íconos de línea (mismo trazo que el resto de la app) */
function Icono({ nombre }: { nombre: "celular" | "soporte" | "cargador" | "sol" | "llave" }) {
  const p = { stroke: "currentColor", strokeWidth: 1.7, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg width="22" height="22" viewBox="0 0 24 24">
      {nombre === "celular" && (
        <>
          <rect x="3" y="7" width="18" height="10" rx="2.2" {...p} />
          <circle cx="7" cy="12" r="1.6" {...p} />
          <path d="M18 10.5v3" {...p} />
        </>
      )}
      {nombre === "soporte" && (
        <>
          <path d="M3 5h18l-2 9H5z" {...p} />
          <rect x="8" y="15.5" width="8" height="4.5" rx="1" {...p} />
          <path d="M12 14v1.5" {...p} />
        </>
      )}
      {nombre === "cargador" && (
        <>
          <path d="M9 3v4M15 3v4M7 7h10v4a5 5 0 0 1-10 0z" {...p} />
          <path d="M12 16v5" {...p} />
        </>
      )}
      {nombre === "sol" && (
        <>
          <circle cx="12" cy="12" r="4" {...p} />
          <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" {...p} />
        </>
      )}
      {nombre === "llave" && (
        <>
          <circle cx="8" cy="14" r="4" {...p} />
          <path d="M11 11l9-9M16.5 5.5l2.5 2.5M14 8l2 2" {...p} />
        </>
      )}
    </svg>
  );
}
