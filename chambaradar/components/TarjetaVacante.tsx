"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { VacanteVista } from "@/lib/muro";
import { formatoSueldo, haceCuanto } from "@/lib/formato";
import { NOMBRE_CATEGORIA, NOMBRE_NIVEL, PAISES } from "@/lib/tipos";
import { Candado, Capas, Dinero, Flecha, Reloj, Ubicacion } from "./Iconos";
import { BotonPagarSemana } from "./Desbloquear";
import { Modal } from "./Modal";

const MODALIDAD = { remoto: "Remoto", hibrido: "Híbrido", presencial: "Presencial" } as const;
const IDIOMA = { es: "español", pt: "portugués", en: "inglés" } as const;

export interface ContextoTarjeta {
  conSesion: boolean;
  pagosActivos: boolean;
  /** ¿Se ofrece OXXO? (solo en México) */
  oxxo?: boolean;
  /** "3,177 vacantes de 129 empresas" para la ventana de registro */
  resumen: string;
}

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Mexico_City" });
}

/** "Brazil · Peru · Colombia y 19 más" → "México · Brazil · Peru…" cuando la vacante también es en México. */
function ubicacionVisible(v: VacanteVista): string {
  if (v.paises.includes("MX") && v.paises.length > 1 && !/m[eé]xic|cdmx/i.test(v.ubicacion)) return `México · ${v.ubicacion}`;
  return v.ubicacion;
}

/** Renglones de datos de la tarjeta: sueldo, ubicación y fecha, cada uno con su ícono. */
function Datos({ v, compacto = false }: { v: VacanteVista; compacto?: boolean }) {
  const sueldo = formatoSueldo(v.sueldo_min, v.sueldo_max, v.moneda, v.periodo);
  return (
    <div className={`space-y-1 ${compacto ? "text-sm" : "text-[15px]"}`}>
      {sueldo && (
        <p className="flex items-center gap-1.5 font-medium text-amber-600">
          <Dinero className="size-4 shrink-0" />
          {sueldo}
        </p>
      )}
      {!compacto && (
        <p className="flex items-center gap-1.5 text-slate-600">
          <Ubicacion className="size-4 shrink-0" />
          <span className="truncate">{ubicacionVisible(v)}</span>
        </p>
      )}
      <p className="flex items-center gap-1.5 text-slate-500" suppressHydrationWarning>
        <Reloj className="size-4 shrink-0" />
        {fechaCorta(v.publicada)} <span className="text-slate-400">· {haceCuanto(v.publicada)}</span>
      </p>
    </div>
  );
}

function Empresa({ v }: { v: VacanteVista }) {
  return v.bloqueada ? (
    <span className="inline-flex items-center gap-1 text-[15px] text-slate-500">
      <Candado className="size-3.5 shrink-0" /> {v.empresa_nombre}
    </span>
  ) : (
    <span className="text-[15px] font-medium text-slate-700">{v.empresa_nombre}</span>
  );
}

/** Contenido de la ventana cuando alguien sin acceso toca "Aplicar". */
function VentanaDesbloquear({ ctx }: { ctx: ContextoTarjeta }) {
  return (
    <div className="space-y-4">
      {ctx.pagosActivos ? (
        <>
          <p className="text-gris">Por $49 MXN ves la empresa, la descripción completa y el enlace para aplicar directo, en esta y en todas las vacantes, durante 1 semana.</p>
          <BotonPagarSemana className="boton w-full" mxn={ctx.oxxo === false} />
          <Link href="/precios" className="boton-secundario w-full">
            Ver otros planes (1 mes $129) <Flecha className="size-4" />
          </Link>
          <p className="text-center text-xs text-gris">Pago único {ctx.oxxo === false ? "con tarjeta (en tu moneda)" : "con tarjeta u OXXO"}, no se renueva solo. No necesitas crear cuenta antes: tu acceso queda en el correo con el que pagues.</p>
          {!ctx.conSesion && (
            <p className="text-center text-sm text-gris">
              ¿Ya pagaste?{" "}
              <Link href="/entrar?siguiente=/vacantes" className="font-semibold text-radar-oscuro hover:underline">
                Entra con tu correo
              </Link>
            </p>
          )}
        </>
      ) : (
        <>
          <p className="text-gris">
            Muy pronto vas a poder desbloquear empresas y enlaces. Mientras tanto, crea una alerta con tus filtros y te avisamos por correo de las vacantes nuevas.
          </p>
          <Link href="/precios" className="boton-secundario w-full">
            Ver planes
          </Link>
        </>
      )}
    </div>
  );
}

/** Ventana "Más": detalles, descripción y otras vacantes de la misma empresa. */
function VentanaMas({ v, alAplicar }: { v: VacanteVista; alAplicar: (o: VacanteVista) => void }) {
  const [otras, setOtras] = useState<{ total: number; vacantes: VacanteVista[] } | null>(null);
  const [cargando, setCargando] = useState(false);
  const [fallo, setFallo] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await fetch(`/api/vacantes/relacionadas?id=${encodeURIComponent(v.id)}`);
      if (!r.ok) throw new Error(String(r.status));
      setOtras(await r.json());
    } catch {
      setFallo(true);
    } finally {
      setCargando(false);
    }
  }, [v.id]);

  // La ventana solo existe mientras está abierta: se pide al abrirla
  useEffect(() => {
    void cargar();
  }, [cargar]);

  const paises = v.paises.map((p) => PAISES[p] ?? p);
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-xl font-semibold leading-snug">{v.titulo}</p>
        <Empresa v={v} />
        <Datos v={v} />
        <div className="flex flex-wrap gap-1.5">
          <span className={`chip ${v.modalidad === "remoto" ? "bg-radar-claro text-radar-oscuro" : ""}`}>{MODALIDAD[v.modalidad]}</span>
          {v.empresa_tipo === "remoto" && <span className="chip bg-amber-100 text-amber-800">Empresa extranjera</span>}
          <span className="chip">{NOMBRE_CATEGORIA[v.categoria]}</span>
          <span className="chip">{NOMBRE_NIVEL[v.nivel]}</span>
          {v.idioma !== "es" && <span className="chip">En {IDIOMA[v.idioma]}</span>}
          {paises.length > 0 && paises.length <= 4 && paises.map((p) => <span key={p} className="chip">{p}</span>)}
          {paises.length > 4 && <span className="chip">{paises.length} países</span>}
        </div>
        {v.descripcion && (
          <p className={`whitespace-pre-line text-sm leading-relaxed text-slate-600 ${v.bloqueada ? "borroso select-none" : ""}`}>
            {v.bloqueada ? v.descripcion : `${v.descripcion.slice(0, 1500)}${v.descripcion.length > 1500 ? "…" : ""}`}
          </p>
        )}
        <BotonAplicar v={v} alAplicar={alAplicar} />
      </div>

      <div className="space-y-3 border-t border-borde pt-5">
        <p className="font-semibold">Más vacantes de esta empresa{otras && otras.total > 0 ? ` (${otras.total})` : ""}</p>
        {cargando && <p className="text-sm text-gris">Buscando…</p>}
        {fallo && <p className="text-sm text-gris">No pudimos cargar las otras vacantes. Inténtalo de nuevo en un momento.</p>}
        {otras && otras.vacantes.length === 0 && <p className="text-sm text-gris">Esta empresa no tiene otras vacantes para ti ahora.</p>}
        {otras?.vacantes.map((o) => (
          <div key={o.id} className="space-y-2 rounded-2xl border border-borde p-4">
            <p className="font-semibold leading-snug">{o.titulo}</p>
            <Datos v={o} compacto />
            <BotonAplicar v={o} alAplicar={alAplicar} />
          </div>
        ))}
      </div>
    </div>
  );
}

function BotonAplicar({ v, alAplicar }: { v: VacanteVista; alAplicar: (v: VacanteVista) => void }) {
  return v.bloqueada || !v.url ? (
    <button onClick={() => alAplicar(v)} className="boton-oscuro" data-evento="aplicar_bloqueada" data-vacante={v.id}>
      <Candado className="size-3.5" /> Aplicar
    </button>
  ) : (
    <a href={v.url} target="_blank" rel="noopener noreferrer nofollow" className="boton-oscuro" data-evento="aplicar" data-vacante={v.id} data-empresa={v.empresa_nombre}>
      Aplicar <Flecha className="size-3.5" />
    </a>
  );
}

export function TarjetaVacante({ v, ctx }: { v: VacanteVista; ctx: ContextoTarjeta }) {
  const [modo, setModo] = useState<null | "mas" | "aplicar">(null);
  const cerrar = useCallback(() => setModo(null), []);
  const abrirAplicar = useCallback(() => setModo("aplicar"), []);

  return (
    <article className="rounded-2xl border border-borde bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:shadow-md sm:p-6">
      <h3 className="text-lg font-semibold leading-snug tracking-tight text-tinta sm:text-xl">
        {v.id.startsWith("directa:") ? (
          <Link href={`/vacante/${v.id.slice("directa:".length)}`} className="hover:text-radar-oscuro hover:underline">
            {v.titulo}
          </Link>
        ) : (
          v.titulo
        )}
      </h3>
      <div className="mt-0.5">
        <Empresa v={v} />
      </div>
      <div className="mt-3">
        <Datos v={v} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <BotonAplicar v={v} alAplicar={abrirAplicar} />
        <button onClick={() => setModo("mas")} className="boton-contorno">
          <Capas className="size-4" /> Más
        </button>
        <span className={`ml-auto hidden text-xs font-medium sm:inline ${v.modalidad === "remoto" ? "text-radar-oscuro" : "text-gris"}`}>
          {MODALIDAD[v.modalidad]}
          {v.empresa_tipo === "remoto" ? " · empresa extranjera" : ""}
        </span>
      </div>

      <Modal abierto={modo === "mas"} alCerrar={cerrar} titulo="Detalles de la vacante">
        <VentanaMas v={v} alAplicar={abrirAplicar} />
      </Modal>
      <Modal abierto={modo === "aplicar"} alCerrar={cerrar} titulo="Desbloquea esta vacante" ancho="sm:max-w-md">
        <VentanaDesbloquear ctx={ctx} />
      </Modal>
    </article>
  );
}
