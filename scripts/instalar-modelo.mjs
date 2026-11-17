// Instala en la app un modelo de segmentación de baches exportado a ONNX (Ultralytics Platform,
// o "yolo export format=onnx"). Lee del propio archivo las clases y el tamaño de entrada, lo copia
// a public/modelos/ con la fecha en el nombre y escribe public/modelos/baches.json.
//
//   node scripts/instalar-modelo.mjs ruta/al/best.onnx [--precision 0.78] [--nota "Ultralytics Platform, 1,200 fotos"]
//
// Normalmente lo corre el workflow "Instalar modelo de baches" (GitHub → Actions).
import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Lector mínimo de protobuf: solo lo necesario de ModelProto (onnx.proto)
// ---------------------------------------------------------------------------
function* campos(buf, inicio = 0, fin = buf.length) {
  let i = inicio;
  const varint = () => {
    let v = 0n;
    let s = 0n;
    for (;;) {
      const b = buf[i++];
      v |= BigInt(b & 0x7f) << s;
      if (!(b & 0x80)) return v;
      s += 7n;
    }
  };
  while (i < fin) {
    const clave = Number(varint());
    const num = clave >>> 3;
    const tipo = clave & 7;
    if (tipo === 0) yield { num, valor: varint() };
    else if (tipo === 2) {
      const largo = Number(varint());
      yield { num, inicio: i, fin: i + largo };
      i += largo;
    } else if (tipo === 1) i += 8;
    else if (tipo === 5) i += 4;
    else throw new Error("El archivo no parece un modelo ONNX.");
  }
}
const texto = (buf, c) => buf.subarray(c.inicio, c.fin).toString("utf8");

/** Metadatos (clave → valor) y forma de las entradas/salidas del grafo */
export function leerOnnx(buf) {
  const meta = {};
  const entradas = [];
  const salidas = [];
  const forma = (vi) => {
    let nombre = "";
    const dims = [];
    for (const c of campos(buf, vi.inicio, vi.fin)) {
      if (c.num === 1) nombre = texto(buf, c);
      if (c.num === 2)
        for (const t of campos(buf, c.inicio, c.fin))
          if (t.num === 1)
            for (const tt of campos(buf, t.inicio, t.fin))
              if (tt.num === 2)
                for (const d of campos(buf, tt.inicio, tt.fin))
                  if (d.num === 1) {
                    let v = null;
                    for (const x of campos(buf, d.inicio, d.fin)) if (x.num === 1) v = Number(x.valor);
                    dims.push(v);
                  }
    }
    return { nombre, dims };
  };
  for (const c of campos(buf)) {
    if (c.num === 14) {
      let k = "";
      let v = "";
      for (const x of campos(buf, c.inicio, c.fin)) {
        if (x.num === 1) k = texto(buf, x);
        if (x.num === 2) v = texto(buf, x);
      }
      meta[k] = v;
    }
    if (c.num === 7)
      for (const g of campos(buf, c.inicio, c.fin)) {
        if (g.num === 11) entradas.push(forma(g));
        if (g.num === 12) salidas.push(forma(g));
      }
  }
  return { meta, entradas, salidas };
}

/** "{0: 'pothole', 1: 'manhole'}" (diccionario de Python) → ["pothole", "manhole"] */
export function leerNombres(s) {
  if (!s) return [];
  const pares = [...s.matchAll(/(\d+)\s*:\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g)].map((m) => [Number(m[1]), m[2] ?? m[3]]);
  pares.sort((a, b) => a[0] - b[0]);
  return pares.map((p) => p[1]);
}

function argumento(nombre) {
  const i = process.argv.indexOf(`--${nombre}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

function principal() {
  const origen = process.argv[2];
  if (!origen || origen.startsWith("--")) {
    console.error("Uso: node scripts/instalar-modelo.mjs ruta/al/modelo.onnx [--precision 0.78] [--nota \"...\"] [--sintetico]");
    process.exit(1);
  }
  const buf = readFileSync(origen);
  const { meta, entradas, salidas } = leerOnnx(buf);

  const tarea = meta.task;
  if (tarea && tarea !== "segment") {
    console.error(`❌ El modelo es de "${tarea}", no de segmentación. Entrena un modelo "-seg" (p. ej. YOLO26n-seg) para poder medir el área.`);
    process.exit(1);
  }
  if (salidas.length < 2 || !salidas.some((s) => s.dims.length === 4)) {
    console.error("❌ El modelo no trae máscaras (debe tener 2 salidas: detecciones y prototipos). ¿Es un modelo de segmentación exportado a ONNX?");
    process.exit(1);
  }
  const dims = entradas[0]?.dims ?? [];
  let imgsz = dims.length === 4 && dims[2] && dims[3] ? [dims[2], dims[3]] : null;
  if (!imgsz && meta.imgsz) {
    const n = meta.imgsz.match(/\d+/g)?.map(Number);
    if (n?.length === 2) imgsz = n;
  }
  if (!imgsz) {
    console.error("❌ No se pudo saber el tamaño de entrada. Exporta con un tamaño fijo (imgsz=640), sin 'dynamic'.");
    process.exit(1);
  }
  const clases = leerNombres(meta.names);
  const deBache = clases.filter((n) => /bache|pothole|hueco|pot[\s_-]?hole|socav/i.test(n));
  if (clases.length > 1 && deBache.length === 0) {
    console.warn(`⚠️  Ninguna clase se llama bache/pothole (${clases.join(", ")}): la app contará TODAS como baches.`);
  }

  const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
  const carpeta = join(raiz, "public", "modelos");
  mkdirSync(carpeta, { recursive: true });
  const ahora = new Date();
  const sello = ahora.toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-");
  const archivo = `baches-${sello}.onnx`;
  // Solo queda el modelo nuevo
  for (const viejo of readdirSync(carpeta)) if (/^baches-.*\.onnx$/.test(viejo)) unlinkSync(join(carpeta, viejo));
  copyFileSync(origen, join(carpeta, archivo));

  const precision = argumento("precision");
  const info = {
    archivo,
    imgsz,
    clases: clases.length ? clases : ["bache"],
    umbral: Number(argumento("umbral")) || 0.35,
    fecha: ahora.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Hermosillo" }),
    ...(precision && Number(precision) > 0 ? { map50: Math.min(1, Number(precision) > 1 ? Number(precision) / 100 : Number(precision)) } : {}),
    ...(argumento("nota") ? { datos: argumento("nota").slice(0, 200) } : {}),
    ...(meta.description ? { descripcion: meta.description.slice(0, 120) } : {}),
    ...(process.argv.includes("--sintetico") ? { sintetico: true } : {}),
  };
  writeFileSync(join(carpeta, "baches.json"), JSON.stringify(info, null, 2) + "\n");

  const mb = statSync(join(carpeta, archivo)).size / 1e6;
  console.log(`✅ Modelo instalado: public/modelos/${archivo} (${mb.toFixed(1)} MB)`);
  console.log(`   Entrada ${imgsz.join(" × ")} · clases: ${info.clases.join(", ")}${deBache.length && clases.length > 1 ? ` (se suben: ${deBache.join(", ")})` : ""}`);
  if (mb > 30) console.warn("⚠️  Pesa mucho para un celular. Para la app conviene la versión n (nano) o s (small).");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) principal();
