// Modelo de detección de baches corriendo en el navegador (solo en el celular, sin enviar video).
// Usa onnxruntime-web: con WebGPU si el celular lo tiene (rápido) y si no, WebAssembly.
// El motor se sirve desde /ort/<versión>/ (lo copia scripts/copiar-ort.mjs) y el modelo desde
// /modelos/ (lo deja ahí el workflow "Entrenar detector de baches").
import type * as Ort from "onnxruntime-web";
import { baches, calcularLetterbox, rgbaAEntrada, type Bache, type Tensor } from "./yolo";

export const VERSION_ORT = "1.31.1";
const RUTA_ORT = `/ort/${VERSION_ORT}/`;
const RUTA_MODELOS = "/modelos/";

/** Lo que dice public/modelos/baches.json sobre el modelo vigente */
export type InfoModelo = {
  /** Archivo .onnx dentro de /modelos/ (lleva la fecha: se guarda en caché para siempre) */
  archivo: string;
  /** Tamaño de entrada [alto, ancho] */
  imgsz: [number, number];
  clases?: string[];
  /** Confianza mínima para ser candidato (umbral global de adquisición) */
  umbral?: number;
  /** Confianza para aceptar cada clase, por nombre (p. ej. {"pothole": 0.25, "manhole": 0.35}) */
  umbrales?: Record<string, number>;
  /** Confianza máxima que debe alcanzar un bache en algún cuadro para subirlo al mapa */
  confirmar?: number;
  fecha?: string;
  /** Precisión de las máscaras en las fotos de validación (mAP50, 0–1) */
  map50?: number;
  imagenes?: number;
  datos?: string;
  /** Modelo de prueba entrenado con imágenes sintéticas: no sirve para calles reales */
  sintetico?: boolean;
};

/**
 * Datos del modelo instalado; null si no hay modelo (404 o archivo inválido).
 * Lanza un error si no se pudo preguntar (sin conexión): quien llama vuelve a intentar.
 */
export async function leerInfoModelo(): Promise<InfoModelo | null> {
  const r = await fetch(`${RUTA_MODELOS}baches.json`, { cache: "no-cache" });
  if (r.status >= 500) throw new Error(`Servidor ${r.status}`);
  try {
    if (!r.ok) return null;
    const j = (await r.json()) as InfoModelo;
    if (typeof j.archivo !== "string" || !/^[\w.-]+\.onnx$/.test(j.archivo)) return null;
    if (!Array.isArray(j.imgsz) || j.imgsz.length !== 2 || !j.imgsz.every((n) => Number.isInteger(n) && n >= 64 && n <= 2048)) return null;
    return j;
  } catch {
    return null;
  }
}

type OrtGlobal = typeof Ort;
let promesaOrt: Promise<OrtGlobal> | null = null;

function cargarOrt(webgpu: boolean): Promise<OrtGlobal> {
  promesaOrt ??= new Promise<OrtGlobal>((ok, mal) => {
    const w = window as unknown as { ort?: OrtGlobal };
    if (w.ort) return ok(w.ort);
    const s = document.createElement("script");
    s.src = RUTA_ORT + (webgpu ? "ort.webgpu.min.js" : "ort.wasm.min.js");
    s.async = true;
    s.onload = () => (w.ort ? ok(w.ort) : mal(new Error("No cargó el motor de IA.")));
    s.onerror = () => {
      promesaOrt = null;
      mal(new Error("No se pudo descargar el motor de IA. Revisa tu conexión."));
    };
    document.head.appendChild(s);
  }).then((ort) => {
    ort.env.wasm.wasmPaths = RUTA_ORT;
    // Varios hilos solo con aislamiento de origen (encabezados COOP/COEP); si no, uno
    ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;
    return ort;
  });
  return promesaOrt;
}

/** Descarga el modelo una vez y lo guarda en el celular (Cache Storage) para no gastar datos */
async function descargar(url: string, alProgreso?: (fraccion: number) => void): Promise<ArrayBuffer> {
  let cache: Cache | null = null;
  try {
    cache = await caches.open("rc-modelos");
    const guardado = await cache.match(url);
    if (guardado) return await guardado.arrayBuffer();
  } catch {
    cache = null;
  }
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error("No se pudo descargar el modelo de baches.");
  const total = Number(res.headers.get("content-length")) || 0;
  const lector = res.body.getReader();
  const partes: Uint8Array[] = [];
  let recibido = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    partes.push(value);
    recibido += value.length;
    if (total) alProgreso?.(Math.min(1, recibido / total));
  }
  const datos = new Uint8Array(recibido);
  let o = 0;
  for (const p of partes) {
    datos.set(p, o);
    o += p.length;
  }
  try {
    if (cache) {
      // Solo se guarda el modelo vigente
      for (const viejo of await cache.keys()) if (!viejo.url.endsWith(url)) await cache.delete(viejo);
      await cache.put(url, new Response(datos, { headers: { "Content-Type": "application/octet-stream" } }));
    }
  } catch {
    /* sin espacio: se descargará la próxima vez */
  }
  return datos.buffer;
}

export class Detector {
  private lienzo: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private entrada: Float32Array;
  private umbralPorClase: (number | undefined)[];
  /** Milisegundos de la última detección (para mostrar cuadros por segundo) */
  ms = 0;

  private constructor(
    private ort: OrtGlobal,
    private sesion: Ort.InferenceSession,
    readonly info: InfoModelo,
    readonly proveedor: "webgpu" | "wasm",
  ) {
    const [alto, ancho] = info.imgsz;
    this.lienzo = document.createElement("canvas");
    this.lienzo.width = ancho;
    this.lienzo.height = alto;
    this.ctx = this.lienzo.getContext("2d", { willReadFrequently: true })!;
    this.entrada = new Float32Array(3 * ancho * alto);
    this.umbralPorClase = (info.clases ?? []).map((n) => info.umbrales?.[n]);
  }

  static async crear(info: InfoModelo, alProgreso?: (fraccion: number) => void): Promise<Detector> {
    const gpu = (navigator as unknown as { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
    const webgpu = !!gpu && !!(await gpu.requestAdapter().catch(() => null));
    const ort = await cargarOrt(webgpu);
    const modelo = await descargar(RUTA_MODELOS + info.archivo, alProgreso);
    let sesion: Ort.InferenceSession | null = null;
    let proveedor: "webgpu" | "wasm" = "wasm";
    if (webgpu) {
      try {
        sesion = await ort.InferenceSession.create(modelo, { executionProviders: ["webgpu"], graphOptimizationLevel: "all" });
        proveedor = "webgpu";
      } catch (e) {
        console.warn("WebGPU no disponible para el modelo; se usa WebAssembly", e);
      }
    }
    sesion ??= await ort.InferenceSession.create(modelo, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
    // Primera corrida en vacío: compila los sombreadores / prepara la memoria
    const vacio = document.createElement("canvas");
    vacio.width = 64;
    vacio.height = 36;
    const d = new Detector(ort, sesion, info, proveedor);
    try {
      await d.detectar(vacio, 64, 36);
      return d;
    } catch (e) {
      if (proveedor !== "webgpu") throw e;
      // WebGPU se creó pero no corre (p. ej. algunos iPhone): se usa WebAssembly
      console.warn("WebGPU falló en la primera corrida; se usa WebAssembly", e);
      const s2 = await ort.InferenceSession.create(modelo, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
      const d2 = new Detector(ort, s2, info, "wasm");
      await d2.detectar(vacio, 64, 36);
      return d2;
    }
  }

  /** Detecta baches en un cuadro (video o canvas) de ancho × alto píxeles */
  async detectar(fuente: CanvasImageSource, ancho: number, alto: number, umbral?: number): Promise<Bache[]> {
    const inicio = performance.now();
    const [ah, aw] = this.info.imgsz;
    const lb = calcularLetterbox(ancho, alto, aw, ah);
    this.ctx.fillStyle = "rgb(114,114,114)";
    this.ctx.fillRect(0, 0, aw, ah);
    this.ctx.drawImage(fuente, lb.dx, lb.dy, ancho * lb.escala, alto * lb.escala);
    rgbaAEntrada(this.ctx.getImageData(0, 0, aw, ah).data, aw, ah, this.entrada);
    const tensor = new this.ort.Tensor("float32", this.entrada, [1, 3, ah, aw]);
    const salidas = await this.sesion.run({ [this.sesion.inputNames[0]]: tensor });
    const lista = this.sesion.outputNames.map((n) => salidas[n]);
    const a = lista.find((t) => t.dims.length === 3);
    const b = lista.find((t) => t.dims.length === 4);
    if (!a || !b) throw new Error("El modelo no es de segmentación (faltan las máscaras).");
    const comoTensor = (t: Ort.Tensor): Tensor => ({ data: t.data as Float32Array, dims: t.dims });
    const res = baches(comoTensor(a), comoTensor(b), lb, { umbral: umbral ?? this.info.umbral ?? 0.25, umbralPorClase: this.umbralPorClase });
    for (const t of lista) t.dispose?.();
    this.ms = performance.now() - inicio;
    return res;
  }
}
