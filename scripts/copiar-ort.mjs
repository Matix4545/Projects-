// Copia el motor de IA del navegador (onnxruntime-web) a public/ort/<versión>/ para servirlo
// desde el mismo sitio. Corre solo antes de "npm run dev" y "npm run build".
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const paquete = join(raiz, "node_modules", "onnxruntime-web");
const { version } = JSON.parse(readFileSync(join(paquete, "package.json"), "utf8"));

// Debe coincidir con lib/baches/modelo.ts (la ruta lleva la versión para poder guardarla en caché para siempre)
const esperada = readFileSync(join(raiz, "lib", "baches", "modelo.ts"), "utf8").match(/VERSION_ORT = "([^"]+)"/)?.[1];
if (esperada !== version) {
  console.error(`onnxruntime-web instalado es ${version} pero lib/baches/modelo.ts espera ${esperada}. Actualiza VERSION_ORT.`);
  process.exit(1);
}

const destino = join(raiz, "public", "ort", version);
mkdirSync(destino, { recursive: true });
const archivos = [
  "ort.webgpu.min.js",
  "ort.wasm.min.js",
  "ort-wasm-simd-threaded.asyncify.mjs",
  "ort-wasm-simd-threaded.asyncify.wasm",
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.wasm",
];
for (const a of archivos) {
  if (!existsSync(join(destino, a))) copyFileSync(join(paquete, "dist", a), join(destino, a));
}
console.log(`onnxruntime-web ${version} listo en public/ort/${version}/`);
