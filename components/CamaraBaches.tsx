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
import { Movimiento } from "@/lib/baches/movimiento";
import { Orientacion } from "@/lib/baches/sensores";
import { Seguimiento, type BacheConfirmado } from "@/lib/baches/seguimiento";
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
};

export type ControlCamara = {
  /** Cierra lo que esté a la vista y envía todo lo pendiente */
  terminar: () => Promise<void>;
};

type Pendiente = Omit<BacheConfirmado<HTMLCanvasElement>, "pos" | "foto"> & { lat: number; lng: number; foto: Blob | null; i: number };

const ENVIO_CADA_MS = 20_000;
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
  onBaches: (b: BacheSubido[]) => void;
  ref?: Ref<ControlCamara>;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const [fps, setFps] = useState(0);
  const [pose, setPose] = useState<{ pitch: number; roll: number } | null>(null);
  const [gpsOk, setGpsOk] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [descartados, setDescartados] = useState(0);

  const seguimiento = useRef(new Seguimiento<HTMLCanvasElement>(detector.info.confirmar ? { minConfianza: detector.info.confirmar } : {}));
  const orientacion = useRef(new Orientacion());
  const movimiento = useRef(new Movimiento());
  const origen = useRef<[number, number] | null>(null);
  const cola = useRef<Pendiente[]>([]);
  const subidos = useRef<BacheSubido[]>([]);
  const enviando = useRef(false);
  const vivo = useRef(true);

  // Valores que cambian sin reiniciar la cámara
  const params = useRef({ alturaM, fovLargo, abajoRespaldo, sesion, plataforma, onBaches });
  params.current = { alturaM, fovLargo, abajoRespaldo, sesion, plataforma, onBaches };

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
              foto: b.foto ? `foto_${k}` : null,
            })),
          }),
        );
        lote.forEach((b, k) => b.foto && form.set(`foto_${k}`, b.foto, `bache-${k}.jpg`));
        const res = await fetch("/api/baches-camara", { method: "POST", body: form });
        if (res.status === 401) {
          setAviso("Tu sesión del equipo se cerró: entra otra vez a /panel. Los baches siguen guardados en esta página.");
          break;
        }
        if (!res.ok) throw new Error(String(res.status));
        const r = (await res.json()) as { resultados?: { nuevo: boolean }[] };
        lote.forEach((b, k) => {
          const s = subidos.current[b.i];
          if (s) {
            s.enviado = true;
            s.nuevo = r.resultados?.[k]?.nuevo;
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

    const vigia = navigator.geolocation.watchPosition(
      (p) => {
        const { latitude: lat, longitude: lng, speed, heading, accuracy } = p.coords;
        if (accuracy > 30) {
          setGpsOk(false);
          return;
        }
        movimiento.current.lectura(lat, lng, performance.now() / 1000, speed, heading);
        setGpsOk(true);
      },
      () => setGpsOk(false),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    );

    const intervalo = setInterval(() => enviarCola(), ENVIO_CADA_MS);

    /** Dónde iba la cámara en el instante t (la última lectura del GPS más lo que avanzó) */
    const posicionEn = (t: number) => movimiento.current.posicionEn(t);

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
        const t = performance.now() / 1000;
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
        const enVivo = t - orientacion.current.ultima < 2 ? orientacion.current.abajo() : null;
        const g = enVivo ?? respaldo;
        const cam = camaraDesdeFov(vw, vh, fov);
        const ejes = g ? ejesSuelo(g) : null;
        const pos = posicionEn(t);
        const medidas: (Medida | null)[] = [];
        const obs = [];
        for (const b of res) {
          const m = g ? medirContorno(b.contorno, cam, g, h) : null;
          medidas.push(m);
          if (!m || !pos || !esBache(b)) continue;
          const [lat, lng] = sueloALatLng(m.centro, pos.lat, pos.lng, pos.rumbo);
          origen.current ??= [lat, lng];
          obs.push({
            t,
            pos: aLocal([lat, lng], origen.current),
            distancia: m.centro[1],
            confianza: b.confianza,
            area_m2: m.enZona ? m.area_m2 : null,
            largo_m: m.enZona ? m.largo_m : null,
            ancho_m: m.enZona ? m.ancho_m : null,
            foto: m.enZona || m.centro[1] < ZONA_DULCE.maxM ? recortar(b.caja, vw, vh) : undefined,
          });
        }
        seguimiento.current.agregar(obs, t);
        encolar(seguimiento.current.tomar(t));
        dibujar(lienzo.current, cuadro, vw, vh, cam, ejes, h, res, medidas, (b) => (esBache(b) ? null : (detector.info.clases?.[b.clase] ?? `clase ${b.clase}`)));

        cuadros++;
        const ahora = performance.now();
        if (ahora - ultimoFps > 1000) {
          setFps(Math.round((cuadros * 10000) / (ahora - ultimoFps)) / 10);
          cuadros = 0;
          ultimoFps = ahora;
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
        <div className="absolute left-2 top-2 rounded-full bg-black/55 px-2.5 py-1 font-mono text-[11px] text-white">
          {fps.toFixed(1)} cps · {detector.proveedor === "webgpu" ? "WebGPU" : "CPU"}
        </div>
        <div className="absolute right-2 top-2 rounded-full bg-black/55 px-2.5 py-1 font-mono text-[11px] text-white">
          {pose ? `↓${pose.pitch.toFixed(1)}° ↻${pose.roll.toFixed(1)}°` : "sin inclinación"} · {gpsOk ? "GPS" : "sin GPS"}
        </div>
      </div>
      {fps > 0 && fps < 2.5 && (
        <p className="rounded-2xl bg-ios-naranja/12 px-4 py-2.5 text-[14px] text-[#c93400]">
          Este celular analiza pocos cuadros por segundo: maneja a 30 km/h o menos para no perder baches.
        </p>
      )}
      {aviso && <p className="rounded-2xl bg-ios-naranja/12 px-4 py-2.5 text-[14px] text-[#c93400]">{aviso}</p>}
      {descartados > 0 && <p className="px-1 text-[13px] text-ios-secundario">{descartados} detecciones sueltas descartadas (vistas en un solo cuadro o con poca confianza).</p>}
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

  if (ejes) dibujarPiso(ctx, cam, ejes, h, k);

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
      const texto = `${otra.toUpperCase()} ${Math.round(b.confianza * 100)}%`;
      ctx.font = "600 11px ui-monospace, monospace";
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(x, Math.max(0, y - 18), ctx.measureText(texto).width + 10, 16);
      ctx.fillStyle = "#5ac8fa";
      ctx.fillText(texto, x + 5, Math.max(0, y - 18) + 12);
      return;
    }
    const ok = m?.enZona;
    ctx.beginPath();
    b.contorno.forEach((p, j) => (j ? ctx.lineTo(...px(p)) : ctx.moveTo(...px(p))));
    ctx.closePath();
    ctx.fillStyle = ok ? "rgba(255,59,48,0.32)" : "rgba(255,149,0,0.22)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = ok ? "#ff3b30" : "#ff9500";
    ctx.stroke();
    const etiqueta = `BACHE ${Math.round(b.confianza * 100)}% · ${
      !m ? "sin medida" : ok ? `${m.area_m2.toFixed(2)} m²` : { lejos: "lejos", cerca: "cerca", rasante: "lejos", borde: "cortado", chico: "chico" }[m.motivo!]
    }`;
    const [x, y] = px([b.caja[0], b.caja[1]]);
    ctx.font = "600 11px ui-monospace, monospace";
    const ancho = ctx.measureText(etiqueta).width + 10;
    const ty = Math.max(0, y - 18);
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(x, ty, ancho, 16);
    ctx.fillStyle = ok ? "#ff6b61" : "#ffb340";
    ctx.fillText(etiqueta, x + 5, ty + 12);
  });
}

/** Horizonte, líneas cada 5 m y la franja donde se mide el tamaño (zona dulce) */
export function dibujarPiso(ctx: CanvasRenderingContext2D, cam: Camara, ejes: Ejes, h: number, k: number) {
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
    ctx.fillStyle = "rgba(52,199,89,0.12)";
    ctx.fill();
  }
  ctx.font = "600 10px ui-monospace, monospace";
  for (const d of [5, 10, 15, 20]) {
    const l = linea(d);
    if (!l) continue;
    ctx.beginPath();
    ctx.moveTo(l[0], l[1]);
    ctx.lineTo(l[2], l[3]);
    ctx.strokeStyle = "rgba(52,199,89,0.55)";
    ctx.lineWidth = 1;
    ctx.stroke();
    const centro = sueloAPixel([0, d], cam, ejes, h);
    if (centro) {
      ctx.fillStyle = "rgba(52,199,89,0.95)";
      ctx.fillText(`${d} m`, centro[0] * k + 4, centro[1] * k - 3);
    }
  }
  // Horizonte: dos puntos muy lejanos, uno a cada lado
  const hi = sueloAPixel([-1e5, 1e5], cam, ejes, h);
  const hd = sueloAPixel([1e5, 1e5], cam, ejes, h);
  if (hi && hd) {
    ctx.beginPath();
    ctx.moveTo(hi[0] * k, hi[1] * k);
    ctx.lineTo(hd[0] * k, hd[1] * k);
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = "rgba(255,204,0,0.8)";
    ctx.stroke();
    ctx.setLineDash([]);
  }
}
