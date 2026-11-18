"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import {
  aLocal,
  camaraDesdeFov,
  deLocal,
  ejesSuelo,
  inclinacion,
  medirContorno,
  sueloALatLng,
  sueloAPixel,
  ZONA_DULCE,
  type Camara,
  type Ejes,
  type Medida,
  type Vec3,
} from "@/lib/baches/geometria";
import type { Detector } from "@/lib/baches/modelo";
import { nivelBache } from "@/lib/constantes";
import { Movimiento, ahora, horaDeLectura } from "@/lib/baches/movimiento";
import { Orientacion } from "@/lib/baches/sensores";
import { Seguimiento, type BacheConfirmado, type Observacion } from "@/lib/baches/seguimiento";
import { clasesDeBache, type Bache } from "@/lib/baches/yolo";

/** Lo que se ve y se sube de cada bache confirmado */
export type BacheSubido = {
  lat: number;
  lng: number;
  area_m2: number | null;
  area_sd: number | null;
  confianza: number;
  enviado: boolean;
  nuevo?: boolean;
  /** false: no se subió al mapa porque no se pudo medir y no había un bache ahí */
  publicado?: boolean;
  /** Calle donde quedó (de OpenStreetMap) */
  calle?: string | null;
  /** Se guardó como parte de un recorrido de prueba (no se publica) */
  prueba?: boolean;
};

export type ControlCamara = {
  /** Cierra lo que esté a la vista y envía todo lo pendiente */
  terminar: () => Promise<void>;
};

type Pendiente = Omit<BacheConfirmado<HTMLCanvasElement>, "pos" | "foto"> & { lat: number; lng: number; foto: Blob | null; i: number };

const ENVIO_CADA_MS = 20_000;
/** Precisión mínima del GPS para ubicar baches (m) */
const PRECISION_MAX_M = 20;
/** Un cuadro espera a la siguiente lectura del GPS para interpolar su posición, hasta este tiempo (s) */
const ESPERA_GPS_S = 1.5;

/** Lo que se midió de un bache en un cuadro, antes de saber dónde iba el vehículo */
type Medicion = Omit<Observacion<HTMLCanvasElement>, "t" | "pos" | "rumbo" | "precision"> & { centro: [number, number] };
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Cámara del parabrisas: detecta baches en cada cuadro, los mide sobre el plano de la calle,
 * junta las apariciones del mismo bache y sube los confirmados (solo equipo).
 */
export function CamaraBaches({
  stream,
  detector,
  alturaM,
  fovLargo,
  abajoRespaldo,
  sesion,
  plataforma,
  prueba,
  onBaches,
  ref,
}: {
  stream: MediaStream;
  detector: Detector;
  alturaM: number;
  fovLargo: number;
  /** "Abajo" guardado en la calibración, por si el celular no da orientación */
  abajoRespaldo: Vec3 | null;
  sesion: string;
  plataforma: string;
  /** Nota del recorrido de prueba: los baches se guardan pero no se publican; null = recorrido normal */
  prueba: string | null;
  onBaches: (b: BacheSubido[]) => void;
  ref?: Ref<ControlCamara>;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const [fps, setFps] = useState(0);
  const [pose, setPose] = useState<{ pitch: number; roll: number } | null>(null);
  const [gps, setGps] = useState<number | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [descartados, setDescartados] = useState(0);
  const [detalles, setDetalles] = useState(false);
  const verDetalles = useRef(false);
  verDetalles.current = detalles;

  const seguimiento = useRef(new Seguimiento<HTMLCanvasElement>(detector.info.confirmar ? { minConfianza: detector.info.confirmar } : {}));
  const orientacion = useRef(new Orientacion());
  const movimiento = useRef(new Movimiento());
  /** Cuadros con baches esperando la siguiente lectura del GPS */
  const pendientes = useRef<{ t: number; items: Medicion[] }[]>([]);
  const procesar = useRef<(final?: boolean) => void>(() => {});
  const origen = useRef<[number, number] | null>(null);
  const cola = useRef<Pendiente[]>([]);
  const subidos = useRef<BacheSubido[]>([]);
  const enviando = useRef(false);
  const vivo = useRef(true);

  // Valores que cambian sin reiniciar la cámara
  const params = useRef({ alturaM, fovLargo, abajoRespaldo, sesion, plataforma, prueba, onBaches });
  params.current = { alturaM, fovLargo, abajoRespaldo, sesion, plataforma, prueba, onBaches };

  const publicar = () => params.current.onBaches([...subidos.current]);

  async function enviarCola(final = false) {
    if (enviando.current || cola.current.length === 0) return;
    enviando.current = true;
    try {
      while (cola.current.length) {
        const lote = cola.current.slice(0, 10);
        const form = new FormData();
        form.set(
          "datos",
          JSON.stringify({
            sesion: params.current.sesion,
            fecha: new Date().toLocaleDateString("en-CA", { timeZone: "America/Hermosillo" }),
            modelo: detector.info.archivo,
            plataforma: params.current.plataforma,
            altura_m: params.current.alturaM,
            fov: params.current.fovLargo,
            prueba: params.current.prueba,
            baches: lote.map((b, k) => ({
              lat: b.lat,
              lng: b.lng,
              area_m2: b.area_m2,
              area_sd: b.area_sd,
              largo_m: b.largo_m,
              ancho_m: b.ancho_m,
              confianza: b.confianza,
              confianza_max: b.confianza_max,
              cuadros: b.cuadros,
              medidas: b.medidas,
              distancia_m: b.distancia_m,
              rumbo: b.rumbo,
              precision_m: b.precision_m,
              foto: b.foto ? `foto_${k}` : null,
            })),
          }),
        );
        lote.forEach((b, k) => b.foto && form.set(`foto_${k}`, b.foto, `bache-${k}.jpg`));
        const res = await fetch("/api/baches-camara", { method: "POST", body: form });
        if (res.status === 401) {
          setAviso("Tu sesión se cerró (¿cambió el código?). Al terminar, vuelve a entrar en /medir. Los baches siguen guardados en esta página.");
          break;
        }
        if (!res.ok) throw new Error(String(res.status));
        const r = (await res.json()) as { resultados?: { pin_id: number | null; nuevo: boolean; calle?: string | null; prueba?: boolean }[] };
        lote.forEach((b, k) => {
          const s = subidos.current[b.i];
          const x = r.resultados?.[k];
          if (s) {
            s.enviado = true;
            s.nuevo = x?.nuevo;
            s.publicado = x ? x.pin_id != null : undefined;
            s.calle = x?.calle ?? null;
            s.prueba = !!x?.prueba;
          }
        });
        cola.current = cola.current.slice(lote.length);
        publicar();
      }
    } catch {
      if (final) setAviso("Sin conexión: quedan baches por enviar. Deja la página abierta y se reintenta.");
    } finally {
      enviando.current = false;
    }
  }

  async function encolar(lista: BacheConfirmado<HTMLCanvasElement>[]) {
    if (!lista.length || !origen.current) return;
    for (const b of lista) {
      const [lat, lng] = deLocal(b.pos, origen.current);
      const foto = b.foto ? await new Promise<Blob | null>((ok) => b.foto!.toBlob(ok, "image/jpeg", 0.78)) : null;
      const i = subidos.current.length;
      subidos.current.push({ lat, lng, area_m2: b.area_m2, area_sd: b.area_sd, confianza: b.confianza, enviado: false });
      cola.current.push({ ...b, lat, lng, foto, i });
    }
    publicar();
    if (cola.current.length >= 5) enviarCola();
  }

  useImperativeHandle(ref, () => ({
    async terminar() {
      vivo.current = false;
      procesar.current(true);
      await encolar(seguimiento.current.terminar());
      for (let intento = 0; intento < 3 && cola.current.length; intento++) {
        await enviarCola(intento === 2);
        if (cola.current.length) await esperar(3000);
      }
    },
  }));

  useEffect(() => {
    vivo.current = true;
    const v = video.current!;
    v.srcObject = stream;
    v.play().catch(() => {});
    const revisarVideo = setTimeout(() => v.paused && setAviso("Toca el video para iniciar la cámara."), 2000);
    v.onplaying = () => setAviso((a) => (a?.startsWith("Toca el video") ? null : a));

    const alOrientar = (e: DeviceOrientationEvent) => orientacion.current.lectura(e.beta, e.gamma, performance.now() / 1000);
    window.addEventListener("deviceorientation", alOrientar);

    let ultimaLectura = 0;
    const vigia = navigator.geolocation.watchPosition(
      (p) => {
        const { latitude: lat, longitude: lng, speed, heading, accuracy } = p.coords;
        ultimaLectura = Date.now();
        setGps(Math.round(accuracy));
        if (accuracy > PRECISION_MAX_M) return;
        // La hora en que se tomó la lectura, para interpolar la posición de cada cuadro
        movimiento.current.lectura(lat, lng, horaDeLectura(p.timestamp), speed, heading, accuracy);
      },
      // Un error suelto no cambia el estado si hubo lectura hace poco
      () => Date.now() - ultimaLectura > 10_000 && setGps(null),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    );

    const intervalo = setInterval(() => enviarCola(), ENVIO_CADA_MS);

    /**
     * Ubica en el mapa los cuadros que ya tienen la lectura del GPS siguiente (posición interpolada)
     * o que ya esperaron demasiado (extrapolada), en orden, y los pasa al seguimiento.
     */
    procesar.current = (final = false) => {
      const cola = pendientes.current;
      const tActual = ahora();
      while (cola.length) {
        const c = cola[0];
        if (!final && !movimiento.current.cubre(c.t) && tActual - c.t < ESPERA_GPS_S) break;
        cola.shift();
        const pos = movimiento.current.posicionEn(c.t);
        if (!pos) continue;
        const obs: Observacion<HTMLCanvasElement>[] = c.items.map(({ centro, ...m }) => {
          const [lat, lng] = sueloALatLng(centro, pos.lat, pos.lng, pos.rumbo);
          origen.current ??= [lat, lng];
          return { ...m, t: c.t, pos: aLocal([lat, lng], origen.current), rumbo: pos.rumbo, precision: pos.precision };
        });
        seguimiento.current.agregar(obs, c.t);
      }
      // Cierra lo que ya se dejó de ver (con el margen de los cuadros que aún esperan al GPS)
      encolar(seguimiento.current.tomar(final ? undefined : tActual - ESPERA_GPS_S));
    };

    // El cuadro que se analiza se congela aquí: el modelo, el recorte y el dibujo usan la misma imagen
    // (el video sigue avanzando mientras el modelo trabaja)
    const cuadro = document.createElement("canvas");
    const recortar = (caja: Bache["caja"], vw: number, vh: number) => {
      const [x1, y1, x2, y2] = caja;
      const mx = (x2 - x1) * 0.5;
      const my = (y2 - y1) * 0.6;
      const sx = Math.max(0, x1 - mx);
      const sy = Math.max(0, y1 - my);
      const sw = Math.min(vw, x2 + mx) - sx;
      const sh = Math.min(vh, y2 + my) - sy;
      if (sw < 8 || sh < 8) return undefined;
      const k = Math.min(1, 480 / sw);
      const c = document.createElement("canvas");
      c.width = Math.round(sw * k);
      c.height = Math.round(sh * k);
      c.getContext("2d")!.drawImage(cuadro, sx, sy, sw, sh, 0, 0, c.width, c.height);
      return c;
    };

    let cuadros = 0;
    let ultimoFps = performance.now();
    // En un modelo con varias clases (bache, alcantarilla, rejilla…) solo se suben los baches
    const deBache = clasesDeBache(detector.info.clases);
    const esBache = (b: Bache) => !deBache || deBache.includes(b.clase);

    async function ciclo() {
      while (vivo.current) {
        if (document.hidden || v.readyState < 2 || !v.videoWidth) {
          await esperar(250);
          continue;
        }
        const t = ahora(); // misma escala que las lecturas del GPS
        const tSensor = performance.now() / 1000;
        const vw = v.videoWidth;
        const vh = v.videoHeight;
        let res: Bache[];
        try {
          if (cuadro.width !== vw || cuadro.height !== vh) [cuadro.width, cuadro.height] = [vw, vh];
          cuadro.getContext("2d")!.drawImage(v, 0, 0, vw, vh);
          res = await detector.detectar(cuadro, vw, vh);
        } catch (e) {
          console.error(e);
          setAviso("El detector falló en este cuadro; reintentando…");
          await esperar(1000);
          continue;
        }
        const { alturaM: h, fovLargo: fov, abajoRespaldo: respaldo } = params.current;
        const enVivo = tSensor - orientacion.current.ultima < 2 ? orientacion.current.abajo() : null;
        const g = enVivo ?? respaldo;
        const cam = camaraDesdeFov(vw, vh, fov);
        const ejes = g ? ejesSuelo(g) : null;
        const medidas: (Medida | null)[] = [];
        const items: Medicion[] = [];
        for (const b of res) {
          const m = g ? medirContorno(b.contorno, cam, g, h) : null;
          medidas.push(m);
          if (!m || !esBache(b)) continue;
          items.push({
            centro: m.centro,
            distancia: m.centro[1],
            confianza: b.confianza,
            area_m2: m.enZona ? m.area_m2 : null,
            largo_m: m.enZona ? m.largo_m : null,
            ancho_m: m.enZona ? m.ancho_m : null,
            foto: m.enZona || m.centro[1] < ZONA_DULCE.maxM ? recortar(b.caja, vw, vh) : undefined,
          });
        }
        if (items.length) pendientes.current.push({ t, items });
        procesar.current();
        dibujar(lienzo.current, cuadro, vw, vh, cam, ejes, h, res, medidas, (b) => (esBache(b) ? null : (detector.info.clases?.[b.clase] ?? `clase ${b.clase}`)), verDetalles.current);

        cuadros++;
        const ms = performance.now();
        if (ms - ultimoFps > 1000) {
          setFps(Math.round((cuadros * 10000) / (ms - ultimoFps)) / 10);
          cuadros = 0;
          ultimoFps = ms;
          setPose(g ? inclinacion(g) : null);
          setDescartados(seguimiento.current.descartados);
          if (!enVivo && !respaldo) setAviso("El celular no da su inclinación: no se puede medir el tamaño. Calibra la cámara antes de salir.");
          // Modelo rectangular horizontal con el celular vertical: casi toda la entrada sería relleno
          const [ah, aw] = detector.info.imgsz;
          if (aw > ah * 1.2 && vh > vw) setAviso("Pon el celular acostado (horizontal): este modelo espera video horizontal y así ve mejor la calle.");
        }
        // Deja respirar a la página entre cuadro y cuadro
        await new Promise((r) => requestAnimationFrame(() => r(null)));
      }
    }
    ciclo();

    return () => {
      vivo.current = false;
      window.removeEventListener("deviceorientation", alOrientar);
      navigator.geolocation.clearWatch(vigia);
      clearInterval(intervalo);
      clearTimeout(revisarVideo);
    };
    // La cámara y el detector se crean una vez por recorrido
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream, detector]);

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-3xl bg-black">
        <video ref={video} muted playsInline autoPlay onClick={() => video.current?.play()} className="block w-full" />
        <canvas ref={lienzo} className="pointer-events-none absolute inset-0 h-full w-full" />
        <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-[13px] font-medium text-white backdrop-blur-sm">
          <span className="relative flex h-2 w-2">
            {gps != null && gps <= PRECISION_MAX_M && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ios-verde opacity-70 motion-reduce:hidden" />
            )}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${gps != null && gps <= PRECISION_MAX_M ? "bg-ios-verde" : "bg-ios-naranja"}`} />
          </span>
          {gps == null ? "Buscando GPS…" : gps > PRECISION_MAX_M ? "GPS débil" : "Buscando baches"}
        </div>
        <button
          onClick={() => setDetalles((d) => !d)}
          aria-pressed={detalles}
          className="absolute right-2 top-2 rounded-full bg-black/55 px-3 py-1.5 text-[13px] font-medium text-white backdrop-blur-sm"
        >
          {detalles ? "Ocultar detalles" : "Detalles"}
        </button>
        {detalles && (
          <div className="absolute bottom-2 left-2 rounded-xl bg-black/60 px-2.5 py-1.5 font-mono text-[11px] leading-relaxed text-white">
            {fps.toFixed(1)} cuadros/s · {detector.proveedor === "webgpu" ? "WebGPU" : "CPU"}
            <br />
            {pose ? `inclinación ↓${pose.pitch.toFixed(1)}° ↻${pose.roll.toFixed(1)}°` : "sin inclinación"} · {gps == null ? "sin GPS" : `GPS ±${gps} m`}
            {descartados > 0 && (
              <>
                <br />
                {descartados} detecciones sueltas descartadas
              </>
            )}
          </div>
        )}
      </div>
      {fps > 0 && fps < 2.5 && (
        <p className="rounded-2xl bg-ios-naranja/12 px-4 py-2.5 text-[14px] text-[#c93400]">
          Este celular analiza pocos cuadros por segundo: maneja a 30 km/h o menos para no perder baches.
        </p>
      )}
      {gps != null && gps > PRECISION_MAX_M && (
        <p className="rounded-2xl bg-ios-naranja/12 px-4 py-2.5 text-[14px] text-[#c93400]">
          GPS impreciso (±{gps} m): los baches no se ubican hasta que mejore. Sal de entre edificios altos o espera un momento.
        </p>
      )}
      {aviso && <p className="rounded-2xl bg-ios-naranja/12 px-4 py-2.5 text-[14px] text-[#c93400]">{aviso}</p>}
    </div>
  );
}

/** Dibuja la zona de medición en el piso y los baches detectados sobre el video */
function dibujar(
  c: HTMLCanvasElement | null,
  /** El cuadro analizado: se pinta debajo para que los contornos coincidan con lo que vio el modelo */
  cuadro: HTMLCanvasElement,
  vw: number,
  vh: number,
  cam: Camara,
  ejes: Ejes | null,
  h: number,
  res: Bache[],
  medidas: (Medida | null)[],
  /** Nombre de la clase si NO es bache (alcantarilla, rejilla…): se dibuja aparte y no se sube */
  otraClase: (b: Bache) => string | null,
  /** Modo detalles: líneas de distancia, horizonte y confianza de cada detección */
  detalles: boolean,
) {
  if (!c) return;
  const dpr = window.devicePixelRatio || 1;
  const w = c.clientWidth;
  const alto = c.clientHeight;
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(alto * dpr)) {
    c.width = Math.round(w * dpr);
    c.height = Math.round(alto * dpr);
  }
  const ctx = c.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.drawImage(cuadro, 0, 0, w, alto);
  const k = w / vw;
  const px = ([x, y]: [number, number]) => [x * k, y * k] as const;

  if (ejes) dibujarPiso(ctx, cam, ejes, h, k, detalles ? { distancias: [5, 10, 15, 20], horizonte: true } : {});
  const pct = (b: Bache) => (detalles ? ` · ${Math.round(b.confianza * 100)}%` : "");

  res.forEach((b, i) => {
    const m = medidas[i];
    const otra = otraClase(b);
    if (otra) {
      ctx.beginPath();
      b.contorno.forEach((p, j) => (j ? ctx.lineTo(...px(p)) : ctx.moveTo(...px(p))));
      ctx.closePath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#5ac8fa";
      ctx.stroke();
      const [x, y] = px([b.caja[0], b.caja[1]]);
      pastilla(ctx, `${otra[0].toUpperCase()}${otra.slice(1)} · no es bache${pct(b)}`, x, Math.max(0, y - 22), "rgba(0,0,0,0.6)", "#5ac8fa");
      return;
    }
    // Medido: color de su nivel (chico, mediano, grande). Sin medir todavía: blanco punteado
    const nivel = m?.enZona ? nivelBache(m.area_m2) : null;
    const color = nivel?.color ?? "#e5e5ea";
    ctx.beginPath();
    b.contorno.forEach((p, j) => (j ? ctx.lineTo(...px(p)) : ctx.moveTo(...px(p))));
    ctx.closePath();
    ctx.fillStyle = `${color}${nivel ? "66" : "2e"}`;
    ctx.fill();
    ctx.lineWidth = nivel ? 2.5 : 1.5;
    ctx.strokeStyle = color;
    if (!nivel) ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    const etiqueta = nivel
      ? `${nivel.nombre} · ${m!.area_m2.toFixed(2)} m²${pct(b)}`
      : `Bache · ${!m ? "sin medida" : { lejos: "midiendo…", cerca: "muy cerca", rasante: "midiendo…", borde: "cortado", chico: "muy lejos" }[m.motivo!]}${pct(b)}`;
    const [x, y] = px([b.caja[0], b.caja[1]]);
    // Pastilla del color del nivel (texto oscuro en chico y mediano, blanco en grande) para leerse sobre el video
    pastilla(ctx, etiqueta, x, Math.max(0, y - 22), nivel ? nivel.color : "rgba(0,0,0,0.6)", !nivel ? color : nivel.clave === "grande" ? "#ffffff" : "#1c1c1e");
  });
}

/** Qué se dibuja sobre el piso: la franja donde se mide siempre; líneas y horizonte, opcionales */
export type OpcionesPiso = {
  /** Líneas de distancia (m) con su etiqueta */
  distancias?: number[];
  horizonte?: boolean;
  /** Texto dentro de la franja (p. ej. "Aquí mide") */
  etiqueta?: string;
};

/** Pastilla de texto legible sobre el video */
export function pastilla(ctx: CanvasRenderingContext2D, texto: string, x: number, y: number, fondo: string, color: string, centrada = false) {
  ctx.font = "600 12px system-ui, -apple-system, sans-serif";
  const w = ctx.measureText(texto).width + 14;
  const x0 = centrada ? x - w / 2 : x;
  ctx.fillStyle = fondo;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x0, y, w, 20, 10);
  else ctx.rect(x0, y, w, 20);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillText(texto, x0 + 7, y + 14);
}

/** Franja verde donde se mide el tamaño (zona dulce) y, si se piden, líneas de distancia y horizonte */
export function dibujarPiso(ctx: CanvasRenderingContext2D, cam: Camara, ejes: Ejes, h: number, k: number, op: OpcionesPiso = {}) {
  const linea = (y: number) => {
    const a = sueloAPixel([-8, y], cam, ejes, h);
    const b = sueloAPixel([8, y], cam, ejes, h);
    return a && b ? ([a[0] * k, a[1] * k, b[0] * k, b[1] * k] as const) : null;
  };
  const cerca = linea(ZONA_DULCE.minM);
  const lejos = linea(ZONA_DULCE.maxM);
  if (cerca && lejos) {
    ctx.beginPath();
    ctx.moveTo(cerca[0], cerca[1]);
    ctx.lineTo(cerca[2], cerca[3]);
    ctx.lineTo(lejos[2], lejos[3]);
    ctx.lineTo(lejos[0], lejos[1]);
    ctx.closePath();
    ctx.fillStyle = "rgba(52,199,89,0.16)";
    ctx.fill();
    ctx.strokeStyle = "rgba(52,199,89,0.9)";
    ctx.lineWidth = 1.5;
    for (const l of [cerca, lejos]) {
      ctx.beginPath();
      ctx.moveTo(l[0], l[1]);
      ctx.lineTo(l[2], l[3]);
      ctx.stroke();
    }
  }
  let ultimaY = Infinity;
  for (const d of op.distancias ?? []) {
    const l = linea(d);
    if (!l) continue;
    ctx.beginPath();
    ctx.moveTo(l[0], l[1]);
    ctx.lineTo(l[2], l[3]);
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
    const centro = sueloAPixel([0, d], cam, ejes, h);
    // A lo lejos las líneas se juntan: no se encima una etiqueta sobre otra
    if (centro && ultimaY - centro[1] * k > 22) {
      pastilla(ctx, `${d} m`, centro[0] * k + 6, centro[1] * k - 22, "rgba(0,0,0,0.55)", "#ffffff");
      ultimaY = centro[1] * k;
    }
  }
  if (op.etiqueta) {
    // En la parte cercana de la franja, para no taparse con la línea de 10 m
    const centro = sueloAPixel([0, ZONA_DULCE.minM + 2.5], cam, ejes, h);
    if (centro) pastilla(ctx, op.etiqueta, centro[0] * k, centro[1] * k - 10, "rgba(36,138,61,0.92)", "#ffffff", true);
  }
  if (op.horizonte) {
    // Horizonte: dos puntos muy lejanos, uno a cada lado
    const hi = sueloAPixel([-1e5, 1e5], cam, ejes, h);
    const hd = sueloAPixel([1e5, 1e5], cam, ejes, h);
    if (hi && hd) {
      ctx.beginPath();
      ctx.moveTo(hi[0] * k, hi[1] * k);
      ctx.lineTo(hd[0] * k, hd[1] * k);
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = "rgba(255,204,0,0.8)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}
