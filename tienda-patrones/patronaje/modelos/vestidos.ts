// Cortes de vestido. Todos salen del cuerpo base (bases/cuerpo.ts): las pinzas de busto
// y de cintura se pasan a costuras (princesa, imperio, cintura) o se convierten en vuelo.
import { type Pt, P, curva, dir, dist, escalar, grados, lerp, perp, rotar, suma } from "../geometria.ts";
import type { Medidas } from "../medidas.ts";
import { type Cuerpo, cuerpoBase, delanteroConPinza } from "../bases/cuerpo.ts";
import { mangaBase } from "../bases/manga.ts";
import { alargar, anillo, rectangulo, vista } from "../bases/utiles.ts";
import {
  type Pieza,
  type V,
  abrir,
  completar,
  crear,
  dividir,
  doblezBorde,
  fusionarPinzas,
  girar,
  hiloVertical,
  insertar,
  insertarEn,
  largoTramo,
  margenBorde,
  piquete,
  suavizar,
  tiene,
  trasladarPinza,
  tramo,
  v,
} from "../pieza.ts";
import { dentro, masCercano } from "../geometria.ts";
import {
  type LadoPanel,
  abrirVuelo,
  hiloEn,
  igualarCostados,
  marcarCierre,
  nombrarCerca,
  parteBaja,
  recortar,
  redondearPar,
  sinDoblez,
  suelto,
  vistasSinManga,
} from "./ayuda-vestidos.ts";
import type { Modelo } from "./tipos.ts";

// ── Anchos de cadera (medio delantero / media espalda, desde el centro) ──
const caderaAjustada = (m: Medidas) => ({ del: m.cadera / 4 + 1.5, esp: m.cadera / 4 + 0.5 }); // holgura 4 cm
const caderaSuelta = (m: Medidas) => ({ del: m.cadera / 4 + 2.5, esp: m.cadera / 4 + 1.5 }); // holgura 8 cm

/** Marcas del cuerpo que caen dentro (o sobre el borde) de un contorno. */
function marcasDentro(pz: Pieza, cont: Pt[]) {
  return pz.marcas.filter((mk) => {
    if (mk.t === "taladro" || mk.t === "pinzaInterna") return false;
    const ref = "pts" in mk ? mk.pts[Math.floor(mk.pts.length / 2)] : "p" in mk ? mk.p : null;
    return ref ? dentro(ref, cont) || masCercano(cont, ref).d < 0.05 : false;
  });
}

// ── Vestido ajustado (recto / tubo) ─────────────────────────────────────────

function vestidoAjustado(m: Medidas, c: Cuerpo, largo: number, o: { vueloBajo?: number; pinza?: "costado" | "cintura" } = {}) {
  const cad = caderaAjustada(m);
  const del = alargar(delanteroConPinza(c, o.pinza ?? "costado"), m, {
    anchoCadera: cad.del,
    largo,
    largoPinza: 13,
    vuelo: o.vueloBajo ?? 0,
    nombre: "Delantero",
  });
  const esp = alargar(c.espalda, m, { anchoCadera: cad.esp, largo, largoPinza: 15, vuelo: o.vueloBajo ?? 0, nombre: "Espalda" });
  igualarCostados(del, esp);
  del.cortar = "Cortar 1 al doblez en tela";
  piquete(del, "cadera");
  piquete(esp, "cadera");
  return { del, esp };
}

// ── Vestido suelto (túnica, línea A, trapecio) ──────────────────────────────

function vestidoSuelto(m: Medidas, c: Cuerpo, largo: number, vueloCostado: number) {
  const cad = caderaSuelta(m);
  const del = suelto(delanteroConPinza(c, "costado"), m, {
    inicio: "pinzaBustoB",
    anchoCadera: cad.del,
    anchoBajo: cad.del + vueloCostado,
    largo,
    nombre: "Delantero",
  });
  const esp = suelto(c.espalda, m, { inicio: "sisaBajo", anchoCadera: cad.esp, anchoBajo: cad.esp + vueloCostado, largo, nombre: "Espalda" });
  igualarCostados(del, esp);
  del.cortar = "Cortar 1 al doblez en tela";
  return { del, esp };
}

/** Rota toda la pieza para que el tramo a→b quede vertical (a arriba). */
function enderezar(pz: Pieza, a: string, b: string): Pieza {
  const A = v(pz, a);
  const B = v(pz, b);
  const ang = Math.atan2(B.y - A.y, B.x - A.x);
  return girar(pz, A, -Math.PI / 2 - ang);
}

/** Pasa parte de la pinza de busto a la bastilla (vuelo) cortando desde el punto de busto. */
function vueloDesdeBusto(del: Pieza, fraccion: number): Pieza {
  const bp = v(del, "pinzaBusto");
  const cb = v(del, "centroBajo");
  insertar(del, "corteVuelo", P(bp.x, cb.y));
  let r = trasladarPinza(del, "pinzaBusto", "corteVuelo", { fraccion, nombre: "vuelo" });
  // la "pinza" que llega a la bastilla queda abierta: es vuelo, no se cose
  r = { ...r, contorno: r.contorno.filter((q) => q.n !== "vuelo"), pinzas: r.pinzas.filter((p) => p.apice !== "vuelo") };
  suavizar(r, "costadoBajo", "centroBajo", 30, 0.6);
  return r;
}

/** Abre la espalda desde la bastilla hasta la sisa (vuelo) y deja el centro espalda vertical. */
function vueloEspalda(esp: Pieza, apertura: number): Pieza {
  const cb = v(esp, "centroBajo");
  const kb = v(esp, "costadoBajo");
  insertar(esp, "corteVuelo", lerp(cb, kb, 0.5));
  // abrir() gira la parte del centro; después se endereza para que el centro quede vertical
  const r = enderezar(abrirVuelo(esp, "corteVuelo", "sisaMedio", apertura), "centroCuello", "centroBajo");
  suavizar(r, "centroBajo", "costadoBajo", 30, 0.6);
  const cc = v(r, "centroCuello");
  r.hilo = hiloEn(cc.x + 5, cc.y - 30, cc.y - 60);
  return r;
}

// ── Paneles de corte princesa ───────────────────────────────────────────────

type OpcionesPanel = {
  largo: number;
  /** Vuelo en la bastilla en cada costura de princesa (por lado) y en el costado. */
  vueloCostura: number;
  vueloCostado: number;
  /** Sirena: a qué altura (bajo la cintura) se ajusta y cuánto entra cada costura. */
  rodilla?: { bajo: number; entra: number };
};

function perfil(x0: number, s: number, yCad: number, o: OpcionesPanel, yW: number, vuelo: number): Pt[] {
  const yBajo = yW - o.largo;
  if (o.rodilla) {
    const yK = yW - o.rodilla.bajo;
    return [P(x0, yCad), P(x0 - s * o.rodilla.entra, yK), P(x0 + s * vuelo, yBajo)];
  }
  return [P(x0, yCad), P(x0 + s * vuelo, yBajo)];
}

function nombresPerfil(base: string[], o: OpcionesPanel): string[] {
  return o.rodilla ? [base[0], `${base[0]}Rodilla`, base[1]] : base;
}

/** Delantero princesa: necesita la pinza de busto (hombro o sisa) y la de cintura con ápice en el busto. */
function princesaDelantero(del: Pieza, m: Medidas, cad: number, o: OpcionesPanel): [Pieza, Pieza] {
  const cc = v(del, "centroCintura");
  const kc = v(del, "costadoCintura");
  const bp = v(del, "pinzaBusto");
  const wA = v(del, "pinzaCinturaA"); // del lado del costado
  const wB = v(del, "pinzaCinturaB"); // del lado del centro
  const yW = cc.y;
  const yCad = yW - m.alturaCadera;
  const xd = (wA.x + wB.x) / 2;
  const suave = !!o.rodilla;
  // panel centro (centro delantero a la derecha)
  const izqC: LadoPanel = {
    arriba: wB,
    tan: dir(bp, wB),
    perfil: perfil(xd, -1, yCad, o, yW, o.vueloCostura),
    nombres: nombresPerfil(["caderaCostura", "bajoCostura"], o),
  };
  const derC: LadoPanel = { arriba: cc, tan: P(0, -1), perfil: [P(cc.x, yW - o.largo)], nombres: ["centroBajo"] };
  const contC: V[] = [...parteBaja(izqC, derC, { suave }), ...tramo(del, "centroCintura", "pinzaBustoA").slice(1), { ...bp, n: "busto" }];
  // panel costado
  const izqL: LadoPanel = {
    arriba: kc,
    tan: dir(v(del, "sisaBajo"), kc),
    perfil: perfil(cc.x - cad, -1, yCad, o, yW, o.vueloCostado),
    nombres: nombresPerfil(["cadera", "costadoBajo"], o),
  };
  const derL: LadoPanel = {
    arriba: wA,
    tan: dir(bp, wA),
    perfil: perfil(xd, 1, yCad, o, yW, o.vueloCostura),
    nombres: nombresPerfil(["caderaCostura", "bajoCostura"], o),
  };
  const contL: V[] = [...parteBaja(izqL, derL, { suave }), { ...bp, n: "busto" }, ...tramo(del, "pinzaBustoB", "costadoCintura").slice(0, -1)];
  const yB = yW - o.largo;
  const centro = crear("Delantero centro", contC, {
    cortar: "Cortar 1 al doblez en tela",
    ancla: P(cc.x, yW),
    marcas: marcasDentro(del, contC),
    hilo: hiloEn((xd + cc.x) / 2 + 1, yW - 2, yB + 10),
  });
  const lado = crear("Delantero costado", contL, {
    cortar: "Cortar 2 en tela (un par)",
    ancla: P(kc.x, yW),
    marcas: marcasDentro(del, contL),
    hilo: hiloEn((xd + cc.x - cad) / 2, yW - 2, yB + 10),
  });
  redondearPar(centro, "busto", lado, "busto");
  doblezBorde(centro, "centroBajo", "centroCintura");
  margenBorde(centro, "bajoCostura", "centroBajo", 2);
  margenBorde(lado, "costadoBajo", "bajoCostura", 2);
  for (const p of [centro, lado]) {
    piquete(p, "caderaCostura");
    piquete(p, p === centro ? "pinzaCinturaB" : "pinzaCinturaA");
  }
  piquete(lado, "cadera");
  return [centro, lado];
}

/** Espalda princesa: pinza de hombro (o de sisa) y pinza de cintura. */
function princesaEspalda(esp: Pieza, m: Medidas, cad: number, o: OpcionesPanel): [Pieza, Pieza] {
  const cc = v(esp, "centroCintura");
  const kc = v(esp, "costadoCintura");
  const apH = v(esp, "pinzaHombro");
  const apW = v(esp, "pinzaCintura");
  const wA = v(esp, "pinzaCinturaA"); // del lado del centro
  const wB = v(esp, "pinzaCinturaB"); // del lado del costado
  const yW = cc.y;
  const yCad = yW - m.alturaCadera;
  const xd = (wA.x + wB.x) / 2;
  const suave = !!o.rodilla;
  const izqC: LadoPanel = { arriba: cc, tan: P(0, -1), perfil: [P(cc.x, yW - o.largo)], nombres: ["centroBajo"] };
  const derC: LadoPanel = {
    arriba: wA,
    tan: dir(apW, wA),
    perfil: perfil(xd, 1, yCad, o, yW, o.vueloCostura),
    nombres: nombresPerfil(["caderaCostura", "bajoCostura"], o),
  };
  const contC: V[] = [
    ...parteBaja(izqC, derC, { suave }),
    { ...apW, n: "apiceCintura" },
    { ...apH, n: "apiceHombro" },
    ...tramo(esp, "pinzaHombroB", "centroCintura").slice(0, -1),
  ];
  const izqL: LadoPanel = {
    arriba: wB,
    tan: dir(apW, wB),
    perfil: perfil(xd, -1, yCad, o, yW, o.vueloCostura),
    nombres: nombresPerfil(["caderaCostura", "bajoCostura"], o),
  };
  const derL: LadoPanel = {
    arriba: kc,
    tan: dir(v(esp, "sisaBajo"), kc),
    perfil: perfil(cc.x + cad, 1, yCad, o, yW, o.vueloCostado),
    nombres: nombresPerfil(["cadera", "costadoBajo"], o),
  };
  const contL: V[] = [
    ...parteBaja(izqL, derL, { suave }),
    ...tramo(esp, "costadoCintura", "pinzaHombroA").slice(1),
    { ...apH, n: "apiceHombro" },
    { ...apW, n: "apiceCintura" },
  ];
  const yB = yW - o.largo;
  const centro = crear("Espalda centro", contC, {
    cortar: "Cortar 2 en tela (un par)",
    ancla: P(cc.x, yW),
    marcas: marcasDentro(esp, contC),
    hilo: hiloEn(xd / 2, yW - 2, yB + 10),
  });
  const lado = crear("Espalda costado", contL, {
    cortar: "Cortar 2 en tela (un par)",
    ancla: P(kc.x, yW),
    marcas: marcasDentro(esp, contL),
    hilo: hiloEn((xd + cc.x + cad) / 2, yW - 2, yB + 10),
  });
  redondearPar(centro, "apiceHombro", lado, "apiceHombro", 2.5);
  redondearPar(centro, "apiceCintura", lado, "apiceCintura", 2.5);
  margenBorde(centro, "centroBajo", "bajoCostura", 2);
  margenBorde(lado, "bajoCostura", "costadoBajo", 2);
  for (const q of centro.contorno) if (q.d) {
    q.d = false;
    q.m = 1.5;
  }
  marcarCierre(centro);
  for (const p of [centro, lado]) {
    piquete(p, "caderaCostura");
    piquete(p, p === centro ? "pinzaCinturaA" : "pinzaCinturaB");
  }
  piquete(lado, "cadera");
  return [centro, lado];
}

function princesa(m: Medidas, desde: "hombro" | "sisa", o: OpcionesPanel): Pieza[] {
  const c = cuerpoBase(m);
  const cad = caderaAjustada(m);
  const del = desde === "hombro" ? delanteroConPinza(c, "hombro") : structuredClone(c.delantero);
  let esp = structuredClone(c.espalda);
  if (desde === "sisa") {
    // punto de la sisa un poco más alto que el ápice de la pinza de hombro: la costura baja sin subir
    const ap = v(esp, "pinzaHombro");
    const sisa = tramo(esp, "sisaMedio", "hombro");
    const y = ap.y + 1.5;
    let p = sisa[0] as Pt;
    for (let k = 1; k < sisa.length; k++) {
      const a = sisa[k - 1];
      const b = sisa[k];
      if ((a.y - y) * (b.y - y) <= 0 && a.y !== b.y) {
        p = lerp(a, b, (y - a.y) / (b.y - a.y));
        break;
      }
    }
    insertar(esp, "puntoSisa", p);
    esp = trasladarPinza(esp, "pinzaHombro", "puntoSisa", { nombre: "pinzaHombro" });
  }
  const [dc, dl] = princesaDelantero(del, m, cad.del, o);
  const [ec, el] = princesaEspalda(esp, m, cad.esp, o);
  return [ec, el, dl, dc, ...vistasSinManga(c, { espaldaAlDoblez: false })];
}

// ── Imperio ─────────────────────────────────────────────────────────────────

/** Altura de la costura bajo el busto. */
const lineaImperio = (c: Cuerpo) => c.ref.bp.y - Math.min(9, 0.5 * (c.ref.bp.y - c.ref.cintura));

/** Nombra los puntos del corte: costado/centro y las patas de la pinza que quedó en el borde. */
function nombrarCorte(pz: Pieza, apice: string, xCentro: number, prefijo: string) {
  const i = pz.contorno.findIndex((q) => q.n === apice);
  const n = pz.contorno.length;
  pz.contorno[(i - 1 + n) % n].n = `pinza${prefijo}A`;
  pz.contorno[(i + 1) % n].n = `pinza${prefijo}B`;
  const libres = pz.contorno.filter((q) => q.n?.startsWith("corte"));
  libres.sort((a, b) => Math.abs(a.x - xCentro) - Math.abs(b.x - xCentro));
  libres[0].n = `centro${prefijo}`;
  libres[libres.length - 1].n = `costado${prefijo}`;
  pz.pinzas = [...pz.pinzas.filter((p) => p.apice !== apice), { a: `pinza${prefijo}A`, apice, b: `pinza${prefijo}B`, retiro: 0 }];
}

/** Falda en línea A que se cose a un corte (imperio o cintura caída). */
function faldaA(nombre: string, ancho: number, caderaNecesaria: number, bajaCadera: number, largo: number, centroDerecha: boolean, cortar: string): Pieza {
  // costado recto desde la costura de arriba; abre lo necesario para pasar la cadera con holgura
  const minBajo = ancho + ((caderaNecesaria - ancho) * largo) / bajaCadera;
  const anchoBajo = Math.max(minBajo, ancho + 6);
  const s = centroDerecha ? -1 : 1;
  const arribaCostado = P(s * ancho, 0);
  const u = dir(arribaCostado, P(s * anchoBajo, -largo));
  const bajoCostado = suma(arribaCostado, escalar(u, largo));
  const bajoCentro = P(0, -largo);
  const bastilla = centroDerecha
    ? curva(bajoCostado, perp(u), bajoCentro, P(1, 0), 0.35, 0.35, 16)
    : curva(bajoCentro, P(1, 0), bajoCostado, perp(u).x > 0 ? perp(u) : escalar(perp(u), -1), 0.35, 0.35, 16);
  const cont: V[] = centroDerecha
    ? [
        { ...arribaCostado, n: "costadoArriba" },
        { ...bajoCostado, n: "costadoBajo" },
        ...bastilla.slice(1, -1),
        { ...bajoCentro, n: "centroBajo" },
        { x: 0, y: 0, n: "centroArriba" },
      ]
    : [
        { x: 0, y: 0, n: "centroArriba" },
        { ...bajoCentro, n: "centroBajo" },
        ...bastilla.slice(1, -1),
        { ...bajoCostado, n: "costadoBajo" },
        { ...arribaCostado, n: "costadoArriba" },
      ];
  const f = crear(nombre, cont, { cortar, ancla: P(0, 0) });
  margenBorde(f, "costadoBajo", "centroBajo", 2);
  f.hilo = hiloEn(s * Math.min(6, ancho / 3), -4, -largo + 10);
  return f;
}

function imperio(m: Medidas): Pieza[] {
  const c = cuerpoBase(m);
  const y = lineaImperio(c);
  // corpiño delantero: se corta bajo el busto y toda la pinza de busto pasa a la costura
  let del = recortar(c.delantero, P(-50, y), P(200, y), true, "Corpiño delantero");
  nombrarCorte(del, "pinzaCintura", c.ref.anchoTotal, "Imperio");
  if (!del.pinzas.some((p) => p.apice === "pinzaBusto")) del.pinzas.push({ a: "pinzaBustoA", apice: "pinzaBusto", b: "pinzaBustoB", retiro: 2 });
  del = trasladarPinza(del, "pinzaBusto", "pinzaImperioA", { nombre: "pinzaBusto" });
  del = fusionarPinzas(del, "pinzaBusto", "pinzaCintura", "pinzaBusto");
  for (const p of del.pinzas) p.retiro = 2;
  del.cortar = "Cortar 1 al doblez en tela y 1 en forro";
  let esp = recortar(c.espalda, P(200, y), P(-50, y), false, "Corpiño espalda");
  // (la recta va hacia la izquierda: "derecha" de la recta es arriba)
  nombrarCorte(esp, "pinzaCintura", 0, "Imperio");
  esp = sinDoblez(esp, 1.5, "Cortar 2 en tela y 2 en forro");
  piquete(del, "costadoImperio");
  piquete(esp, "costadoImperio");
  // faldas
  const bajoEmpire = y - c.ref.cintura; // distancia del corte a la cintura
  const cad = caderaSuelta(m);
  const largoF = bajoEmpire + m.largoRodilla;
  const bajaCadera = bajoEmpire + m.alturaCadera;
  const anchoD = largoTramo(del, "costadoImperio", "centroImperio");
  const anchoE = largoTramo(esp, "centroImperio", "costadoImperio");
  const fd = faldaA("Falda delantero", anchoD, cad.del, bajaCadera, largoF, true, "Cortar 1 al doblez en tela");
  doblezBorde(fd, "centroBajo", "centroArriba");
  const fe = faldaA("Falda espalda", anchoE, cad.esp, bajaCadera, largoF, false, "Cortar 2 en tela (un par)");
  margenBorde(fe, "centroArriba", "centroBajo", 1.5);
  piquete(fd, P(-anchoD, 0));
  piquete(fe, P(anchoE, 0));
  return [esp, del, fe, fd];
}

// ── Corte en la cintura con falda de media capa ─────────────────────────────

function cinturaMediaCapa(m: Medidas): Pieza[] {
  const c = cuerpoBase(m);
  const del = delanteroConPinza(c, "costado");
  del.nombre = "Corpiño delantero";
  del.cortar = "Cortar 1 al doblez en tela y 1 en forro";
  const esp = sinDoblez(c.espalda, 1.5, "Cortar 2 en tela y 2 en forro");
  esp.nombre = "Corpiño espalda";
  const F = largoTramo(del, "costadoCintura", "centroCintura");
  const B = largoTramo(esp, "centroCintura", "costadoCintura");
  // media capa: entre las 4 piezas suman medio círculo
  const r = (F + B) / (Math.PI / 2);
  const tF = F / r;
  const tB = B / r;
  const largo = m.largoRodilla;
  let fd = anillo("Falda delantero", r, largo, (tF * 180) / Math.PI, "Cortar 1 al doblez en tela");
  fd = girar(fd, P(0, 0), -Math.PI / 2 - tF);
  doblezBorde(fd, "bordeFin", "centroFin");
  margenBorde(fd, "bordeIni", "bordeFin", 1.5);
  fd.ancla = v(fd, "centroFin");
  fd.hilo = [P(-2, -r - 4), P(-2, -r - largo + 8)];
  let fe = anillo("Falda espalda", r, largo, (tB * 180) / Math.PI, "Cortar 2 en tela (un par)");
  fe = girar(fe, P(0, 0), -Math.PI / 2);
  margenBorde(fe, "bordeIni", "bordeFin", 1.5);
  margenBorde(fe, "centroIni", "bordeIni", 1.5);
  fe.ancla = v(fe, "centroIni");
  fe.hilo = [P(2, -r - 4), P(2, -r - largo + 8)];
  marcarCierre(esp, 40);
  return [esp, del, fe, fd];
}

// ── Cintura caída con falda tableada ────────────────────────────────────────

/** Rectángulo de falda con tablas (pliegues encontrados): marca dobleces y líneas de colocación. */
function faldaTableada(nombre: string, terminado: number, alto: number, centroDerecha: boolean, cortar: string): Pieza {
  const n = Math.max(2, Math.round(terminado / 9));
  const cara = terminado / n; // ancho visible de cada tabla
  const fondo = cara / 2; // profundidad (cada tabla usa el doble de tela)
  const ancho = n * (cara + 2 * fondo);
  const f = rectangulo(nombre, ancho, alto, cortar);
  f.contorno = f.contorno.map((q) => ({ ...q, y: q.y - alto }));
  f.hilo = [P(ancho / 2, -alto * 0.3), P(ancho / 2, -alto * 0.7)];
  for (let k = 0; k < n; k++) {
    const x0 = k * (cara + 2 * fondo);
    const doblez = x0 + cara;
    const coloca = doblez + 2 * fondo;
    const xs = centroDerecha ? [ancho - doblez, ancho - coloca] : [doblez, coloca];
    f.marcas.push({ t: "linea", pts: [P(xs[0], 0), P(xs[0], -alto)], estilo: "pliegue" });
    f.marcas.push({ t: "linea", pts: [P(xs[1], 0), P(xs[1], -12)], estilo: "colocacion" });
  }
  f.marcas.push({ t: "texto", p: P(ancho / 2, -6), s: "lleva el doblez sobre la línea de colocación", h: 0.8 });
  // nombres útiles
  const [a, b, cc, d] = ["a", "b", "c", "d"];
  void [a, b, cc, d];
  f.ancla = centroDerecha ? P(ancho, 0) : P(0, 0);
  return f;
}

function cinturaCaida(m: Medidas): Pieza[] {
  const c = cuerpoBase(m);
  const baja = m.alturaCadera - 3;
  const cad = caderaAjustada(m);
  const del = alargar(delanteroConPinza(c, "costado"), m, { anchoCadera: cad.del + 0.5, largo: baja, largoPinza: baja - 2, nombre: "Cuerpo delantero" });
  let esp = alargar(c.espalda, m, { anchoCadera: cad.esp + 0.5, largo: baja, largoPinza: baja - 2, nombre: "Cuerpo espalda" });
  igualarCostados(del, esp, "costadoBajo", "costadoCintura");
  esp = sinDoblez(esp);
  marcarCierre(esp);
  del.cortar = "Cortar 1 al doblez en tela";
  margenBorde(del, "costadoBajo", "centroBajo", 1);
  margenBorde(esp, "costadoBajo", "centroBajo", 1);
  const F = largoTramo(del, "costadoBajo", "centroBajo");
  const B = largoTramo(esp, "centroBajo", "costadoBajo");
  const alto = m.largoRodilla - baja;
  const fd = faldaTableada("Falda delantero", F, alto, true, "Cortar 1 al doblez en tela");
  doblezBorde(fd, "b", "c");
  margenBorde(fd, "a", "b", 3);
  const fe = faldaTableada("Falda espalda", B, alto, false, "Cortar 2 en tela (un par)");
  margenBorde(fe, "d", "a", 1.5);
  margenBorde(fe, "a", "b", 3);
  return [esp, del, fe, fd];
}

// ── Cruzado ─────────────────────────────────────────────────────────────────

function cruzado(m: Medidas): Pieza[] {
  const c = cuerpoBase(m);
  const largo = m.largoRodilla;
  const { del, esp } = vestidoAjustado(m, c, largo, { pinza: "cintura" });
  // delantero completo (las dos mitades) y corte del cruce: del hombro a la cintura del otro lado
  const completo = completar(del, "centroBajo", "centroCuello");
  insertarEn(completo, "cruceHombro", "cuelloHombro", "hombro", 2.5);
  const otroCostado = v(completo, "costadoCintura*");
  const cfc = v(del, "centroCintura"); // queda dentro del delantero completo (ya no es borde)
  const yW = cfc.y;
  const W = P(otroCostado.x - 4, yW);
  const yB = v(completo, "centroBajo").y;
  insertar(completo, "cruceBajo", P(W.x, yB));
  const H = v(completo, "cruceHombro");
  const linea = curva(H, dir(H, W), W, P(0.25, -1), 0.3, 0.25, 20).slice(1);
  const [p1, p2] = dividir(completo, "cruceHombro", "cruceBajo", linea, ["Delantero cruzado", "resto"]);
  const frente = tiene(p1, "costadoCintura") ? p1 : p2;
  nombrarCerca(frente, W, "cruceCintura");
  frente.cortar = "Cortar 2 en tela (un par)";
  frente.ancla = P(cfc.x, yW);
  frente.hilo = hiloEn(cfc.x - 6, yW + 4, yB + 12);
  margenBorde(frente, "cruceBajo", "cruceHombro", 1);
  piquete(frente, "cruceCintura");
  piquete(frente, "costadoCintura");
  frente.marcas.push({ t: "texto", p: P(v(frente, "costadoCintura").x + 4, yW + 1.5), s: "abertura para el lazo", h: 0.7 });
  const vistaCruce = vista(frente, "cruceBajo", "cruceHombro", 6, "Vista del cruce", "Cortar 2 en tela y 2 en entretela");
  const vEsp = vista(esp, "cuelloHombro", "centroCuello", 5, "Vista escote espalda", "Cortar 1 al doblez en tela y entretela");
  doblezBorde(vEsp, "fin", "finInterior");
  const vSisas = vistasSinManga(c, { espaldaAlDoblez: true }).slice(2);
  const lazo = rectangulo("Lazo", 110, 10, "Cortar 2 en tela", { dobladoAlCentro: true });
  esp.cortar = "Cortar 1 al doblez en tela";
  return [esp, frente, vistaCruce, vEsp, ...vSisas, lazo];
}

// ── Camisero ────────────────────────────────────────────────────────────────

function camisero(m: Medidas): Pieza[] {
  const c = cuerpoBase(m);
  const largo = m.largoRodilla;
  const { del, esp } = vestidoSuelto(m, c, largo, 1.5);
  // delantero: cruce de 2 cm y vista doblada de 6.5 cm
  const cc = v(del, "centroCintura");
  const cu = v(del, "centroCuello");
  const cb = v(del, "centroBajo");
  const xc = cc.x;
  const cuerpoArriba = tramo(del, "centroCuello", "centroBajo");
  const delantero = crear(
    "Delantero",
    [
      ...cuerpoArriba.map((q) => ({ ...q, d: false, m: q.d ? 1 : q.m })),
      { x: xc + 2, y: cb.y, n: "cruceBajo", m: 2 },
      { x: xc + 8.5, y: cb.y, n: "vistaBajo", m: 1 },
      { x: xc + 8.5, y: cu.y, n: "vistaCuello", m: 1 },
      { x: xc + 2, y: cu.y, n: "cruceCuello", m: 1 },
    ],
    { pinzas: del.pinzas, marcas: del.marcas, cortar: "Cortar 2 en tela (un par)", ancla: P(xc, cc.y), hilo: hiloEn(xc - 6, cc.y + 6, cb.y + 12) },
  );
  margenBorde(delantero, "costadoBajo", "centroBajo", 2);
  delantero.marcas.push({ t: "linea", pts: [P(xc + 2, cu.y), P(xc + 2, cb.y)], estilo: "doblez" });
  delantero.marcas.push({ t: "linea", pts: [P(xc, cu.y), P(xc, cb.y)], estilo: "guia" });
  for (let y = cu.y - 1.5; y > cb.y + 22; y -= 9) {
    delantero.marcas.push({ t: "boton", p: P(xc, y), r: 0.6 });
    delantero.marcas.push({ t: "ojal", p: P(xc + 0.6, y), ang: 0, l: 1.8 });
  }
  // espalda: canesú con la pinza de hombro cerrada en la costura
  const apice = v(esp, "pinzaHombro");
  const yCanesu = Math.min(apice.y - 1, -8.5);
  const e2 = structuredClone(esp);
  Object.assign(v(e2, "pinzaHombro"), { y: yCanesu + 0.02 });
  let canesu = recortar(e2, P(200, yCanesu), P(-50, yCanesu), false, "Canesú espalda");
  insertar(canesu, "puntoCanesu", P(apice.x, yCanesu));
  canesu = trasladarPinza(canesu, "pinzaHombro", "puntoCanesu", { nombre: "cierreCanesu" });
  canesu = { ...canesu, contorno: canesu.contorno.filter((q) => q.n !== "cierreCanesu"), pinzas: [] };
  canesu.cortar = "Cortar 2 al doblez en tela (canesú y forro)";
  canesu.ancla = P(0, 0);
  canesu.hilo = hiloEn(3, -1.5, yCanesu + 2);
  let espalda = recortar(e2, P(-50, yCanesu), P(200, yCanesu), false, "Espalda");
  espalda = { ...espalda, pinzas: [] };
  // tabla encontrada en el centro espalda (4 cm al doblez = tabla de 8 cm)
  espalda.contorno = espalda.contorno.map((q) => (Math.abs(q.x) < 0.01 ? { ...q, x: -4 } : q));
  espalda.marcas.push({ t: "linea", pts: [P(0, yCanesu), P(0, yCanesu - 15)], estilo: "pliegue" });
  espalda.marcas.push({ t: "texto", p: P(4, yCanesu - 5), s: "tabla encontrada", h: 0.8 });
  espalda.cortar = "Cortar 1 al doblez en tela";
  // manga corta y pie de cuello
  const { manga } = mangaBase(m, c, { largo: 25, bastilla: m.brazo + 2 });
  manga.nombre = "Manga corta";
  const cuello = largoTramo(esp, "cuelloHombro", "centroCuello") + largoTramo(del, "centroCuello", "cuelloHombro") + 2;
  const pie = rectangulo("Pie de cuello", cuello, 3.5, "Cortar 2 al doblez en tela y 1 en entretela");
  doblezBorde(pie, "d", "a");
  pie.marcas.push({ t: "piquete", p: P(largoTramo(esp, "cuelloHombro", "centroCuello"), 0) });
  pie.marcas.push({ t: "piquete", p: P(cuello - 2, 0) });
  const cinto = rectangulo("Cinturón", m.cintura + 30, 8, "Cortar 1 en tela", { dobladoAlCentro: true });
  return [canesu, espalda, delantero, manga, pie, cinto];
}

// ── Modelos ─────────────────────────────────────────────────────────────────

export const VESTIDOS: Modelo[] = [
  {
    id: "vestido-recto",
    categoria: "vestidos",
    nombre: "Vestido recto (tubo)",
    descripcion: "Vestido ajustado a la rodilla, sin costura en la cintura: las pinzas de cintura se vuelven pinzas de pez. Cierre en el centro espalda.",
    pasos: [
      "Parte del cuerpo base con la pinza de busto en el costado.",
      "Alarga centro y costado hasta la rodilla; abre el costado al ancho de cadera más 4 cm de holgura.",
      "Convierte las pinzas de cintura en pinzas de pez: 13 cm abajo de la cintura en el delantero y 15 cm en la espalda.",
      "Cierra 1 cm cada costado en la bastilla para que caiga recto (efecto tubo).",
      "Abre la espalda al centro para el cierre invisible de 55 cm y traza vistas de escote y sisa.",
    ],
    telas: "Gabardina con elastano, crepé, lino grueso, jacquard.",
    generar: (m) => {
      const c = cuerpoBase(m);
      const { del, esp } = vestidoAjustado(m, c, m.largoRodilla, { vueloBajo: -1 });
      const e = sinDoblez(esp);
      marcarCierre(e);
      return [e, del, ...vistasSinManga(c, { espaldaAlDoblez: false })];
    },
  },
  {
    id: "vestido-tunica",
    categoria: "vestidos",
    nombre: "Vestido túnica (suelto)",
    descripcion: "Vestido recto y holgado que cae desde el busto, sin pinzas de cintura; solo lleva pinza de busto en el costado.",
    pasos: [
      "Usa el cuerpo base con la pinza de busto en el costado y quita las pinzas de cintura.",
      "Baja el costado recto desde la pinza hasta la cadera (holgura de 8 cm) y la bastilla, abriendo 1.5 cm.",
      "Iguala el largo de los costados delantero y espalda.",
      "Cierre en el centro espalda; vistas de escote y sisa.",
    ],
    telas: "Lino, popelina, rayón, crepé.",
    generar: (m) => {
      const c = cuerpoBase(m);
      const { del, esp } = vestidoSuelto(m, c, m.largoRodilla, 1.5);
      const e = sinDoblez(esp);
      marcarCierre(e, 45);
      return [e, del, ...vistasSinManga(c, { espaldaAlDoblez: false })];
    },
  },
  {
    id: "vestido-linea-a",
    categoria: "vestidos",
    nombre: "Vestido línea A",
    descripcion: "Ajustado arriba y abierto en forma de A hacia la bastilla. Parte de la pinza de busto se convierte en vuelo.",
    pasos: [
      "Parte del vestido suelto (pinza de busto en el costado, sin pinzas de cintura).",
      "Corta del punto de busto a la bastilla y cierra la mitad de la pinza de costado: se abre vuelo abajo.",
      "En la espalda corta de la bastilla a la sisa y abre 8 cm.",
      "Agrega 3 cm de vuelo en cada costado y redondea la bastilla.",
    ],
    telas: "Popelina, lino, piqué, gabardina ligera.",
    generar: (m) => {
      const c = cuerpoBase(m);
      const { del, esp } = vestidoSuelto(m, c, m.largoRodilla, 3);
      const d = vueloDesdeBusto(del, 0.5);
      let e = vueloEspalda(esp, 8);
      igualarCostados(d, e);
      e = sinDoblez(e);
      marcarCierre(e, 45);
      return [e, d, ...vistasSinManga(c, { espaldaAlDoblez: false })];
    },
  },
  {
    id: "vestido-trapecio",
    categoria: "vestidos",
    nombre: "Vestido trapecio",
    descripcion: "Vestido muy abierto desde los hombros, sin pinzas: toda la pinza de busto se convierte en vuelo en la bastilla.",
    pasos: [
      "Parte del vestido suelto con la pinza de busto en el costado.",
      "Corta del punto de busto a la bastilla y cierra toda la pinza de costado.",
      "En la espalda corta de la bastilla a la sisa y abre 12 cm.",
      "Agrega 4 cm de vuelo en cada costado y redondea la bastilla.",
    ],
    telas: "Telas con cuerpo: gabardina, piqué, lino grueso, neopreno.",
    generar: (m) => {
      const c = cuerpoBase(m);
      const { del, esp } = vestidoSuelto(m, c, m.largoRodilla, 4);
      const d = vueloDesdeBusto(del, 1);
      let e = vueloEspalda(esp, 12);
      igualarCostados(d, e);
      e = sinDoblez(e);
      marcarCierre(e, 40);
      return [e, d, ...vistasSinManga(c, { espaldaAlDoblez: false })];
    },
  },
  {
    id: "vestido-princesa-hombro",
    categoria: "vestidos",
    nombre: "Vestido corte princesa (desde el hombro)",
    descripcion: "Costuras verticales que salen del hombro, pasan por el busto y bajan a la bastilla; dan un ajuste perfecto sin pinzas.",
    pasos: [
      "Pasa la pinza de busto al hombro; la pinza de cintura ya apunta al punto de busto.",
      "Une las dos pinzas con una línea que pasa por el busto: esa es la costura princesa.",
      "Separa el panel centro y el panel costado; suaviza la curva sobre el busto.",
      "Debajo de la cintura sigue la pinza hasta la cadera y baja a la bastilla con 2 cm de vuelo por costura.",
      "En la espalda une la pinza de hombro con la de cintura de la misma forma. Cierre al centro espalda.",
    ],
    telas: "Crepé, satén grueso, gabardina con elastano, lino.",
    generar: (m) => princesa(m, "hombro", { largo: m.largoRodilla, vueloCostura: 2, vueloCostado: 2 }),
  },
  {
    id: "vestido-princesa-sisa",
    categoria: "vestidos",
    nombre: "Vestido corte princesa (desde la sisa)",
    descripcion: "La costura princesa sale de la sisa en curva, pasa por el busto y baja a la bastilla. Es la versión más usada en vestidos de fiesta.",
    pasos: [
      "Deja la pinza de busto en la sisa (como en el cuerpo base).",
      "En la espalda pasa la pinza de hombro a la sisa, a la altura del ancho de espalda.",
      "Une cada pinza de sisa con su pinza de cintura y separa los paneles.",
      "Suaviza la curva sobre el busto y la del omóplato; iguala el largo de las costuras.",
      "Baja los paneles a la bastilla con 2 cm de vuelo por costura.",
    ],
    telas: "Crepé, satén, tafeta, piqué.",
    generar: (m) => princesa(m, "sisa", { largo: m.largoRodilla, vueloCostura: 2, vueloCostado: 2 }),
  },
  {
    id: "vestido-sirena",
    categoria: "vestidos",
    nombre: "Vestido sirena",
    descripcion: "Corte princesa ajustado hasta la rodilla que se abre en vuelo hacia abajo, como cola de sirena.",
    pasos: [
      "Parte del corte princesa desde la sisa.",
      "Ajusta las costuras 1 cm hacia adentro a la altura de la rodilla.",
      "Desde la rodilla abre 9 cm de vuelo en cada costura y en los costados.",
      "Alarga a media pierna y redondea la bastilla de cada panel.",
    ],
    telas: "Crepé con elastano, satén strech, tejido de punto grueso.",
    generar: (m) =>
      princesa(m, "sisa", { largo: m.largoRodilla + 28, vueloCostura: 9, vueloCostado: 9, rodilla: { bajo: m.largoRodilla - 4, entra: 1 } }),
  },
  {
    id: "vestido-imperio",
    categoria: "vestidos",
    nombre: "Vestido corte imperio",
    descripcion: "Costura justo debajo del busto con falda en A que cae libre sobre la cintura y la cadera.",
    pasos: [
      "Traza la línea imperio unos 8 cm debajo del punto de busto, en delantero y espalda.",
      "Corta el corpiño por esa línea; pasa toda la pinza de busto a la pinza que queda bajo el busto.",
      "La falda empieza en la línea imperio: mide la costura del corpiño (con pinzas cerradas) para su ancho de arriba.",
      "Abre el costado de la falda lo necesario para pasar la cadera con 8 cm de holgura.",
      "Forra el corpiño; cierre al centro espalda.",
    ],
    telas: "Gasa, rayón, algodón ligero, chifón con forro.",
    generar: (m) => imperio(m),
  },
  {
    id: "vestido-cintura",
    categoria: "vestidos",
    nombre: "Vestido con corte en la cintura",
    descripcion: "Corpiño ajustado a la cintura con falda de media capa (medio círculo) cosida en la cintura.",
    pasos: [
      "Usa el cuerpo base a la cintura con sus pinzas (busto en el costado).",
      "Mide la cintura del corpiño delantero y espalda con las pinzas cerradas.",
      "Radio de la falda = cintura total ÷ π (media capa). Reparte el arco entre delantero y espalda.",
      "Delantero al doblez en el centro; espalda con costura para el cierre.",
      "Forra el corpiño y deja reposar la falda colgada un día antes de emparejar la bastilla.",
    ],
    telas: "Popelina, crepé, rayón, satén.",
    generar: (m) => cinturaMediaCapa(m),
  },
  {
    id: "vestido-cintura-caida",
    categoria: "vestidos",
    nombre: "Vestido cintura caída",
    descripcion: "El cuerpo baja recto hasta la cadera alta, donde se cose una falda tableada.",
    pasos: [
      "Alarga el cuerpo base hasta 3 cm arriba de la línea de cadera, con pinzas de pez.",
      "Corta ahí la costura; mide el contorno del cuerpo en esa línea.",
      "La falda es un rectángulo con tablas: cada tabla usa el doble de su ancho visible.",
      "Marca dobleces y líneas de colocación; cierre al centro espalda.",
    ],
    telas: "Lino, popelina, crepé de lana.",
    generar: (m) => cinturaCaida(m),
  },
  {
    id: "vestido-cruzado",
    categoria: "vestidos",
    nombre: "Vestido cruzado",
    descripcion: "El delantero cruza de un hombro a la cintura del otro lado y se amarra con lazo. Escote en V.",
    pasos: [
      "Pasa la pinza de busto a la cintura y alarga a la rodilla con pinzas de pez.",
      "Dibuja el delantero completo (las dos mitades).",
      "Traza el cruce: del hombro (2.5 cm afuera del cuello) a la cintura del otro lado, 4 cm antes del costado, y de ahí recto a la bastilla.",
      "Corta dos delanteros (un par). Vista de 6 cm en todo el borde del cruce.",
      "Lazos de 110 cm; deja una abertura en un costado para pasar el lazo.",
    ],
    telas: "Punto de rayón, crepé, satén, jersey.",
    generar: (m) => cruzado(m),
  },
  {
    id: "vestido-camisero",
    categoria: "vestidos",
    nombre: "Vestido camisero",
    descripcion: "Vestido tipo camisa abotonado al frente, con canesú en la espalda, pie de cuello, manga corta y cinturón.",
    pasos: [
      "Parte del vestido suelto con la pinza de busto en el costado.",
      "Delantero: agrega 2 cm de cruce y una vista doblada de 6.5 cm; marca botones cada 9 cm sobre el centro.",
      "Espalda: corta el canesú 8.5 cm bajo el cuello y cierra la pinza de hombro dentro del canesú.",
      "Agrega una tabla encontrada de 8 cm al centro de la espalda.",
      "Pie de cuello con el largo del escote más el cruce; manga corta de la manga base; cinturón.",
    ],
    telas: "Popelina, lino, chambray, mezclilla ligera.",
    generar: (m) => camisero(m),
  },
];

// utilidades no usadas (evitan advertencias si se quitan modelos)
void [dist, grados, lerp, rotar, hiloVertical, suma, escalar];
