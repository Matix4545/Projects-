// Bloque base de manga montada. La copa se calcula para que mida la sisa del
// cuerpo más la holgura de embebido (por defecto 2.5 cm).
import { type Pt, P, curva, longitud, lerp, dir } from "../geometria.ts";
import type { Medidas } from "../medidas.ts";
import { type Pieza, crear, margen, piquete, piqueteDesdeFin, piqueteEn } from "../pieza.ts";
import type { Cuerpo } from "./cuerpo.ts";

export type OpcionesManga = {
  /** Embebido de la copa (cm que la copa mide de más que la sisa). */
  embebido?: number;
  /** Holgura en el contorno de brazo. */
  holguraBrazo?: number;
  /** Ancho de la bastilla; por defecto muñeca + 10. */
  bastilla?: number;
  /** Largo desde el hombro; por defecto largo de brazo. */
  largo?: number;
};

export type RefManga = { altoCopa: number; anchoBiceps: number; yCodo: number; yBastilla: number };

/** Copa de manga: atrás (x<0) → copa → frente (x>0). */
function copa(h: number, atras: number, frente: number) {
  const T = P(0, h);
  const F = P(frente, 0);
  const A = P(-atras, 0);
  const mF = lerp(T, F, 0.5);
  const mA = lerp(T, A, 0.45);
  const dF = dir(T, F);
  const dA = dir(T, A);
  const frenteSup = curva(T, P(1, 0), mF, dF, 0.5, 0.35);
  const frenteInf = curva(mF, dF, F, P(1, 0), 0.4, 0.35);
  const atrasSup = curva(T, P(-1, 0), mA, dA, 0.5, 0.35);
  const atrasInf = curva(mA, dA, A, P(-1, 0), 0.4, 0.3);
  return {
    frente: [...frenteSup, ...frenteInf.slice(1)],
    atras: [...atrasSup, ...atrasInf.slice(1)],
  };
}

export function mangaBase(m: Medidas, c: Cuerpo, o: OpcionesManga = {}): { manga: Pieza; ref: RefManga } {
  const sisa = c.ref.sisaDelantera + c.ref.sisaEspalda;
  const objetivo = sisa + (o.embebido ?? 2.5);
  const ancho = m.brazo + (o.holguraBrazo ?? 5);
  const frente = ancho / 2 - 0.5;
  const atras = ancho / 2 + 0.5;
  // altura de copa por bisección para que la copa mida lo que pide la sisa
  let lo = 6;
  let hi = 24;
  for (let k = 0; k < 40; k++) {
    const h = (lo + hi) / 2;
    const cp = copa(h, atras, frente);
    if (longitud(cp.frente) + longitud(cp.atras) > objetivo) hi = h;
    else lo = h;
  }
  const h = (lo + hi) / 2;
  const cp = copa(h, atras, frente);
  const largo = o.largo ?? m.largoBrazo;
  const yB = h - largo;
  const yCodo = h - (largo / 2 + 2.5);
  const mb = (o.bastilla ?? m.muneca + 10) / 2;
  const contorno = [
    { x: -mb, y: yB, n: "bastillaAtras" },
    { x: mb, y: yB, n: "bastillaFrente" },
    { x: frente, y: 0, n: "sisaFrente" },
    ...[...cp.frente].reverse().slice(1, -1),
    { x: 0, y: h, n: "copa" },
    ...cp.atras.slice(1, -1),
    { x: -atras, y: 0, n: "sisaAtras" },
  ];
  const manga = crear("Manga", contorno, { cortar: "Cortar 2 en tela (un par)", ancla: P(0, 0) });
  margen(manga, "bastillaAtras", "bastillaFrente", 2.5);
  manga.hilo = [P(0, -3), P(0, yB + 8)];
  manga.marcas.push({ t: "linea", pts: [P(-atras, 0), P(frente, 0)], estilo: "guia" });
  const t = yCodo / yB;
  manga.marcas.push({ t: "linea", pts: [P(-atras + (atras - mb) * t, yCodo), P(frente - (frente - mb) * t, yCodo)], estilo: "guia" });
  // piquetes: copa (hombro), delantero (1) y espalda (2), a la misma altura que en el cuerpo
  piquete(manga, "copa");
  const embF = ((o.embebido ?? 2.5) * 0.45) * 0.33;
  const embA = ((o.embebido ?? 2.5) * 0.55) * 0.33;
  piqueteEn(manga, "sisaFrente", "copa", c.ref.sisaDelantera * 0.33 + embF);
  piqueteDesdeFin(manga, "copa", "sisaAtras", c.ref.sisaEspalda * 0.33 + embA, true);
  return { manga, ref: { altoCopa: h, anchoBiceps: ancho, yCodo, yBastilla: yB } };
}

export type { Pt };
