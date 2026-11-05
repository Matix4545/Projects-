// Generador de patrones.
//
//   npm run patron -- lista                       Lista los modelos disponibles
//   npm run patron -- escote-v                    Todas las tallas anidadas (XS a 4XL)
//   npm run patron -- escote-v --talla M          Una sola talla (con línea de costura)
//   npm run patron -- escote-v --tallas S,M,L     Algunas tallas
//   npm run patron -- escote-v --medidas yo.json  A la medida (ver patronaje/medidas-ejemplo.json)
//   npm run patron -- todos                       Toda la biblioteca
//   Opciones: --salida carpeta/  --hojas (también Carta y A4)  --svg (vista previa)
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { acomodar } from "./exportar/acomodo.ts";
import { dxf } from "./exportar/dxf.ts";
import { pdf } from "./exportar/pdf.ts";
import { svgPiezas } from "./exportar/svg.ts";
import { type Medidas, TALLAS, completar, talla } from "./medidas.ts";
import { CATEGORIAS_PATRONAJE, MODELOS, type Modelo, modelo } from "./modelos/index.ts";

const { values: op, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    talla: { type: "string" },
    tallas: { type: "string" },
    medidas: { type: "string" },
    salida: { type: "string", default: "patrones-generados" },
    hojas: { type: "boolean", default: false },
    svg: { type: "boolean", default: false },
    tienda: { type: "string", default: process.env.NOMBRE_TIENDA || "Trazo" },
  },
});

async function medidasElegidas(): Promise<Medidas[]> {
  if (op.medidas) {
    const datos = JSON.parse(await readFile(op.medidas, "utf8"));
    if (!datos.busto || !datos.cintura || !datos.cadera) throw new Error("El archivo de medidas necesita al menos busto, cintura y cadera (en cm).");
    return [completar({ talla: datos.nombre ?? "a medida", ...datos })];
  }
  if (op.talla) return [talla(op.talla)];
  if (op.tallas) return op.tallas.split(",").map((t) => talla(t.trim()));
  return TALLAS;
}

export async function generarModelo(mod: Modelo, tallas: Medidas[], salida: string, o: { hojas?: boolean; svg?: boolean; tienda?: string; silencioso?: boolean } = {}) {
  const porTalla = tallas.map((m) => ({ talla: m.talla, piezas: mod.generar(m) }));
  const pliego = acomodar(mod.nombre, porTalla);
  const dir = path.join(salida, mod.id);
  await mkdir(dir, { recursive: true });
  const sufijo = tallas.length === 1 ? `-${tallas[0].talla.replace(/\s+/g, "_")}` : "";
  const base = path.join(dir, `${mod.id}${sufijo}`);
  await writeFile(`${base}.dxf`, dxf(pliego, mod.nombre));
  const pdfPlotter = `${base}-plotter.pdf`;
  await writeFile(pdfPlotter, await pdf(pliego, mod.nombre, o.tienda));
  const archivos = [`${base}.dxf`, pdfPlotter];
  if (o.hojas) {
    const { generarMosaico } = await import("../scripts/mosaico-lib.mjs");
    for (const papel of ["carta", "a4"] as const) {
      archivos.push(await generarMosaico({ entrada: pdfPlotter, papel, nombre: mod.nombre, tienda: o.tienda, salida: dir, silencioso: true }));
    }
  }
  if (o.svg) {
    const m = tallas.find((t) => t.talla === "M") ?? tallas[0];
    await writeFile(`${base}.svg`, svgPiezas(mod.generar(m)));
    archivos.push(`${base}.svg`);
  }
  if (!o.silencioso) {
    console.log(`✓ ${mod.nombre}  (${pliego.ancho.toFixed(0)} × ${pliego.alto.toFixed(0)} cm, ${porTalla[0].piezas.length} piezas)`);
    for (const a of archivos) console.log(`   ${a}`);
  }
  return archivos;
}

async function main() {
  const orden = positionals[0];
  if (!orden || orden === "lista") {
    for (const [c, info] of Object.entries(CATEGORIAS_PATRONAJE)) {
      const lista = MODELOS.filter((m) => m.categoria === c);
      if (!lista.length) continue;
      console.log(`\n${info.nombre.toUpperCase()}`);
      for (const m of lista) console.log(`  ${m.id.padEnd(28)} ${m.nombre}`);
    }
    console.log(`\nUso: npm run patron -- <modelo> [--talla M | --medidas mis-medidas.json] [--hojas] [--svg]`);
    return;
  }
  if (orden === "catalogo") {
    // Escribe patronaje/CATALOGO.md con todos los modelos, su descripción y el trazo
    const lineas = ["# Catálogo de patrones y transformaciones", "", "Generado con `npm run patron -- catalogo`. Cada modelo se genera con `npm run patron -- <id>`.", ""];
    for (const [c, info] of Object.entries(CATEGORIAS_PATRONAJE)) {
      const lista = MODELOS.filter((m) => m.categoria === c);
      if (!lista.length) continue;
      lineas.push(`## ${info.nombre}`, "", info.intro, "");
      for (const m of lista) {
        lineas.push(`### ${m.nombre} \`${m.id}\``, "", m.descripcion, "");
        if (m.telas) lineas.push(`**Telas:** ${m.telas}`, "");
        m.pasos.forEach((p, i) => lineas.push(`${i + 1}. ${p}`));
        lineas.push("");
      }
    }
    await writeFile(path.join(path.dirname(new URL(import.meta.url).pathname), "CATALOGO.md"), lineas.join("\n"));
    console.log(`✓ patronaje/CATALOGO.md (${MODELOS.length} modelos)`);
    return;
  }
  const tallas = await medidasElegidas();
  const lista = orden === "todos" ? MODELOS : [modelo(orden)];
  for (const mod of lista) {
    try {
      await generarModelo(mod, tallas, op.salida!, { hojas: op.hojas, svg: op.svg, tienda: op.tienda });
    } catch (e) {
      console.error(`✗ ${mod.id}: ${(e as Error).message}`);
      process.exitCode = 1;
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
