import type { Metadata } from "next";
import Link from "next/link";
import { Confianza } from "@/components/Confianza";
import { Flecha } from "@/components/Iconos";
import { Encabezado, Pie } from "@/components/Marco";
import { usuarioActual } from "@/lib/supabase/servidor";

export const metadata: Metadata = {
  title: "Cómo detectar estafas de trabajo desde casa (y qué hace ChambaRadar distinto)",
  description:
    "Señales claras de una oferta falsa de home office: te piden dinero, datos bancarios o un depósito; te contactan por WhatsApp sin entrevista; el correo no es de la empresa. Cómo verificar una vacante antes de aplicar.",
  alternates: { canonical: "/guias/estafas-trabajo-desde-casa" },
};

const SENALES: [string, string][] = [
  ["Te piden dinero", "Para “capacitación”, “uniforme”, “kit de trabajo”, “verificación” o “liberar tu pago”. Ninguna empresa seria cobra por contratarte. Nunca."],
  ["Te piden datos bancarios o tu tarjeta antes de contratarte", "Una empresa real te pide tu CLABE hasta que ya firmaste contrato, para depositarte la nómina. Nunca el número completo de tu tarjeta ni el CVV."],
  ["Te contactan por WhatsApp o Telegram sin que hayas aplicado", "“Vi tu perfil y tenemos una vacante de medio tiempo ganando $8,000 a la semana”. Las empresas publican en su página y te escriben desde un correo de su dominio."],
  ["Te piden “dar like”, “calificar productos” o “hacer tareas” y depositar para subir de nivel", "Es la estafa más común de 2025-2026 en México. Al principio te pagan poquito para que confíes; después te piden que deposites tú."],
  ["Sueldo altísimo sin requisitos", "“Gana $30,000 al mes desde casa sin experiencia, solo con tu celular”. El trabajo remoto real pide algo: inglés, experiencia, horario o una habilidad concreta."],
  ["El correo o el enlace no son de la empresa", "Revisa el dominio: rh-empresa@gmail.com no es la empresa. Si el enlace para aplicar no está en la página oficial, desconfía."],
  ["Te presionan: “solo hoy”, “quedan 2 lugares”", "La urgencia es para que no verifiques. Una vacante real sigue abierta mañana."],
  ["Te mandan un cheque o transferencia y te piden regresar una parte", "Es lavado de dinero o un cheque sin fondos. Si “te depositaron de más”, es estafa."],
];

const PASOS: string[] = [
  "Busca la empresa en Google con la palabra “estafa” o “fraude” y revisa que tenga sitio propio, dirección y presencia real.",
  "Entra a la página de empleo oficial de la empresa (normalmente empresa.com/careers o /empleos) y busca ahí la vacante. Si no está, pregunta a la empresa por sus canales oficiales.",
  "Aplica solo desde la página oficial o desde un portal reconocido. Nunca mandes tu CV ni tu INE a un número de WhatsApp que te escribió primero.",
  "Pide siempre entrevista (videollamada o presencial) antes de dar cualquier dato personal más allá de tu CV.",
  "Si ya diste datos de tu tarjeta o hiciste un depósito, llama a tu banco de inmediato y reporta en la Policía Cibernética (088) o en la Condusef.",
];

export default async function GuiaEstafas() {
  const usuario = await usuarioActual();
  return (
    <>
      <Encabezado usuario={usuario} />
      <main className="contenedor max-w-3xl space-y-8 py-8">
        <div className="space-y-3">
          <p className="text-sm font-semibold text-radar-oscuro">Guía</p>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Cómo detectar estafas de trabajo desde casa</h1>
          <p className="text-gris">
            El home office real existe y paga bien, pero el 80 % de los anuncios de “gana dinero desde tu celular” son fraude. Estas son las señales para no caer, y
            cómo verificar una vacante en 5 minutos.
          </p>
        </div>

        <Confianza />

        <section className="space-y-3">
          <h2 className="text-xl font-bold tracking-tight">8 señales de que es estafa</h2>
          <ol className="space-y-3">
            {SENALES.map(([t, d], i) => (
              <li key={t} className="flex gap-3 rounded-2xl border border-borde bg-white p-4">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-red-50 text-sm font-bold text-red-700">{i + 1}</span>
                <div>
                  <p className="font-semibold">{t}</p>
                  <p className="mt-0.5 text-sm text-slate-600">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold tracking-tight">Cómo verificar una vacante antes de aplicar</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700 sm:text-base">
            {PASOS.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
        </section>

        <section className="space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-950">
          <h2 className="text-lg font-bold">Fuentes seguras y gratuitas para buscar trabajo</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <a href="https://www.empleo.gob.mx/" target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                Portal del Empleo (empleo.gob.mx)
              </a>
              : la bolsa de trabajo oficial del Servicio Nacional de Empleo, gratis, con decenas de miles de vacantes operativas y ferias de empleo en todo México.
            </li>
            <li>La página de empleo oficial de cada empresa (normalmente empresa.com/careers o /empleos). Es de donde ChambaRadar toma sus vacantes.</li>
            <li>Portales conocidos (OCC, Computrabajo, LinkedIn, Indeed): seguros para aplicar, aunque con mucha competencia; desconfía de quien te escriba fuera de ellos.</li>
          </ul>
        </section>

        <section className="space-y-3 rounded-2xl border border-borde bg-white p-5 text-sm text-slate-700">
          <h2 className="text-lg font-bold">¿Y ChambaRadar? ¿Por qué cobra?</h2>
          <p>
            ChambaRadar <strong>no es una empresa que contrata</strong> ni una agencia: es un buscador. Revisamos todos los días las páginas de empleo oficiales de
            cientos de empresas y te mostramos las vacantes que aceptan gente de México y LATAM. Cuando aplicas, lo haces <strong>en la página de la empresa</strong>,
            gratis, y la empresa nunca sabe que llegaste por aquí.
          </p>
          <p>
            Lo único que cobramos es el plan para ver qué empresa es y el enlace directo ($49 por una semana, pago único con tarjeta u OXXO, sin suscripción). No pedimos
            tu INE, tu CLABE ni el número completo de tu tarjeta: el pago lo procesa Stripe, igual que en Amazon o Uber, y nosotros nunca vemos tus datos bancarios.
          </p>
          <p>
            Si una “vacante” que encontraste aquí te pide dinero, escríbenos a contacto@chambaradar.com y la quitamos ese mismo día.
          </p>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link href="/remoto-dolares" className="boton">
            Ver vacantes remotas con sueldo en dólares <Flecha className="size-4" />
          </Link>
          <Link href="/vacantes" className="boton-secundario">
            Todas las vacantes
          </Link>
        </div>
      </main>
      <Pie />
    </>
  );
}
