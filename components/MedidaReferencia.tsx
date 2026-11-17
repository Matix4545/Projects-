"use client";

import { useEffect, useRef, useState } from "react";
import { medirConReferencia, type Px } from "@/lib/baches/geometria";
import { nivelBache } from "@/lib/constantes";
import { HojaInferior } from "./HojaInferior";

const REFERENCIAS = [
  { clave: "carta", nombre: "Hoja carta", ancho: 21.6, largo: 27.9 },
  { clave: "carta4", nombre: "4 hojas carta (2 × 2)", ancho: 43.2, largo: 55.8 },
  { clave: "otra", nombre: "Otra medida", ancho: 100, largo: 100 },
] as const;

type Fase = "foto" | "hoja" | "bache" | "resultado";

/**
 * Medida de referencia de un bache (verdad de campo) con una foto tomada de pie, desde arriba,
 * con una hoja de tamaño conocido en el piso: 4 esquinas de la hoja → homografía → área en m².
 * Sirve para comprobar qué tan bien mide la cámara del parabrisas.
 */
export function MedidaReferencia({ onCerrar }: { onCerrar: () => void }) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [fase, setFase] = useState<Fase>("foto");
  const [ref, setRef] = useState<(typeof REFERENCIAS)[number]["clave"]>("carta");
  const [medida, setMedida] = useState({ ancho: 21.6, largo: 27.9 });
  const [hoja, setHoja] = useState<Px[]>([]);
  const [contorno, setContorno] = useState<Px[]>([]);
  const [lupa, setLupa] = useState<Px | null>(null);

  const puntos = fase === "hoja" ? hoja : contorno;
  const setPuntos = fase === "hoja" ? setHoja : setContorno;
  const resultado = fase === "resultado" ? medirConReferencia(hoja, medida.ancho / 100, medida.largo / 100, contorno) : null;
  const nivel = nivelBache(resultado?.area_m2);

  function cargar(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    const i = new Image();
    i.onload = () => {
      setImg(i);
      setHoja([]);
      setContorno([]);
      setFase("hoja");
    };
    i.src = URL.createObjectURL(archivo);
  }

  // Dibujo: foto, hoja (verde), contorno (rojo) y lupa al arrastrar
  useEffect(() => {
    const c = lienzo.current;
    if (!c || !img) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = (w * img.naturalHeight) / img.naturalWidth;
    c.style.height = `${h}px`;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(img, 0, 0, w, h);
    const k = w / img.naturalWidth;
    const trazo = (pts: Px[], color: string, cerrar: boolean) => {
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * k, y * k) : ctx.moveTo(x * k, y * k)));
      if (cerrar) ctx.closePath();
      ctx.stroke();
      pts.forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x * k, y * k, 3.5, 0, 2 * Math.PI);
        ctx.fill();
      });
    };
    trazo(hoja, "#34c759", hoja.length === 4);
    trazo(contorno, "#ff3b30", fase === "resultado");
    if (lupa) {
      // Lupa ×3 en la esquina contraria al dedo
      const r = 60;
      const cx = lupa[0] * k < w / 2 ? w - r - 8 : r + 8;
      const cy = r + 8;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 2 * Math.PI);
      ctx.clip();
      const z = 3;
      const lado = (2 * r) / (z * k);
      ctx.drawImage(img, lupa[0] - lado / 2, lupa[1] - lado / 2, lado, lado, cx - r, cy - r, 2 * r, 2 * r);
      ctx.restore();
      ctx.strokeStyle = "white";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.strokeStyle = fase === "hoja" ? "#34c759" : "#ff3b30";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy);
      ctx.lineTo(cx + 10, cy);
      ctx.moveTo(cx, cy - 10);
      ctx.lineTo(cx, cy + 10);
      ctx.stroke();
    }
  }, [img, hoja, contorno, fase, lupa]);

  const aImagen = (e: React.PointerEvent<HTMLCanvasElement>): Px => {
    const r = e.currentTarget.getBoundingClientRect();
    const k = img!.naturalWidth / r.width;
    return [(e.clientX - r.left) * k, (e.clientY - r.top) * k];
  };
  // Tocar pone un punto; arrastrar lo ajusta (con lupa)
  const abajo = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (fase !== "hoja" && fase !== "bache") return;
    if (fase === "hoja" && hoja.length >= 4) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = aImagen(e);
    setPuntos((q) => [...q, p]);
    setLupa(p);
  };
  const mover = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!lupa) return;
    const p = aImagen(e);
    setPuntos((q) => [...q.slice(0, -1), p]);
    setLupa(p);
  };

  return (
    <HojaInferior titulo="Medida de referencia" onCerrar={onCerrar}>
      <div className="space-y-3 pb-2">
        {fase === "foto" && (
          <>
            <p className="text-[15px] text-ios-secundario">
              Para comprobar qué tan bien mide la cámara: pon una hoja junto al bache (sobre el piso, no adentro), párate a un
              lado y toma una foto <strong className="text-ios-etiqueta">desde arriba</strong> donde se vean completos la hoja y el bache. Con 4 hojas
              juntas sale más precisa.
            </p>
            <label className="boton boton-principal w-full cursor-pointer">
              Tomar o elegir foto
              <input type="file" accept="image/*" capture="environment" onChange={cargar} className="hidden" />
            </label>
          </>
        )}

        {img && fase !== "foto" && (
          <canvas
            ref={lienzo}
            onPointerDown={abajo}
            onPointerMove={mover}
            onPointerUp={() => setLupa(null)}
            onPointerCancel={() => setLupa(null)}
            className="block w-full touch-none rounded-2xl bg-black"
          />
        )}

        {fase === "hoja" && (
          <>
            <div className="flex flex-wrap gap-2">
              {REFERENCIAS.map((r) => (
                <button
                  key={r.clave}
                  aria-pressed={ref === r.clave}
                  onClick={() => {
                    setRef(r.clave);
                    setMedida({ ancho: r.ancho, largo: r.largo });
                  }}
                  className={`rounded-full px-3 py-1.5 text-[14px] ${ref === r.clave ? "bg-ios-azul font-semibold text-white" : "bg-ios-relleno"}`}
                >
                  {r.nombre}
                </button>
              ))}
            </div>
            {ref === "otra" && (
              <div className="grid grid-cols-2 gap-2">
                {(["ancho", "largo"] as const).map((k) => (
                  <label key={k} className="campo flex items-center justify-between text-[15px]">
                    {k === "ancho" ? "Ancho (1→2)" : "Largo (2→3)"}
                    <span className="flex items-center gap-1">
                      <input
                        type="number"
                        inputMode="decimal"
                        value={medida[k]}
                        onChange={(e) => setMedida((m) => ({ ...m, [k]: Number(e.target.value) || 0 }))}
                        className="w-14 bg-transparent text-right outline-none"
                      />
                      cm
                    </span>
                  </label>
                ))}
              </div>
            )}
            <p className="text-[14px] text-ios-secundario">
              Toca las <strong className="text-ios-etiqueta">4 esquinas de la hoja</strong> dando la vuelta ({hoja.length}/4); 1→2 es el lado corto. Arrastra
              para afinar con la lupa.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => (hoja.length ? setHoja((q) => q.slice(0, -1)) : setFase("foto"))} className="boton boton-tenue">
                {hoja.length ? "Deshacer" : "Otra foto"}
              </button>
              <button disabled={hoja.length !== 4 || medida.ancho <= 0 || medida.largo <= 0} onClick={() => setFase("bache")} className="boton boton-principal">
                Siguiente
              </button>
            </div>
          </>
        )}

        {fase === "bache" && (
          <>
            <p className="text-[14px] text-ios-secundario">
              Ahora toca alrededor del <strong className="text-ios-etiqueta">borde del bache</strong> ({contorno.length} puntos). Entre más puntos, mejor.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => (contorno.length ? setContorno((q) => q.slice(0, -1)) : setFase("hoja"))} className="boton boton-tenue">
                {contorno.length ? "Deshacer" : "Atrás"}
              </button>
              <button disabled={contorno.length < 3} onClick={() => setFase("resultado")} className="boton boton-principal">
                Medir
              </button>
            </div>
          </>
        )}

        {resultado && (
          <>
            <div className="rounded-2xl bg-ios-fondo px-4 py-3 text-center">
              {nivel && (
                <p className="flex items-center justify-center gap-2 text-[13px]">
                  <span
                    className="rounded-full px-2.5 py-0.5 font-semibold"
                    style={{ background: nivel.color, color: nivel.clave === "grande" ? "#ffffff" : "#1c1c1e" }}
                  >
                    {nivel.nombre}
                  </span>
                  <span className="text-ios-secundario">{nivel.rango} de diámetro</span>
                </p>
              )}
              <p className="text-[34px] font-bold tabular-nums">{resultado.area_m2.toFixed(3)} m²</p>
              <p className="text-[15px] text-ios-secundario">
                {Math.round(resultado.largo_m * 100)} × {Math.round(resultado.ancho_m * 100)} cm · perímetro {resultado.perimetro_m.toFixed(2)} m
              </p>
            </div>
            <PlanoMetrico piso={resultado.piso} ancho={medida.ancho / 100} largo={medida.largo / 100} />
            <p className="text-[13px] text-ios-secundario">
              Compárala con la que dio la cámara para ese bache (en el mapa o en el CSV de /estadisticas). Error = (cámara − referencia) / referencia.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setFase("bache")} className="boton boton-tenue">
                Corregir
              </button>
              <button onClick={() => setFase("foto")} className="boton boton-principal">
                Otro bache
              </button>
            </div>
          </>
        )}
      </div>
    </HojaInferior>
  );
}

/** El bache y la hoja vistos desde arriba, a escala (plano ortorectificado) */
function PlanoMetrico({ piso, ancho, largo }: { piso: [number, number][]; ancho: number; largo: number }) {
  const todos = [...piso, [0, 0], [ancho, largo]] as [number, number][];
  const xs = todos.map((p) => p[0]);
  const ys = todos.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const m = 0.05;
  const vb = `${x0 - m} ${y0 - m} ${x1 - x0 + 2 * m} ${y1 - y0 + 2 * m}`;
  return (
    <svg viewBox={vb} role="img" aria-label="Bache visto desde arriba, a escala" className="mx-auto max-h-56 w-full rounded-2xl bg-[#0b1220]">
      <rect x={0} y={0} width={ancho} height={largo} fill="none" stroke="#34c759" strokeWidth={0.01} />
      <polygon points={piso.map((p) => p.join(",")).join(" ")} fill="rgba(255,59,48,0.35)" stroke="#ff3b30" strokeWidth={0.01} />
    </svg>
  );
}
