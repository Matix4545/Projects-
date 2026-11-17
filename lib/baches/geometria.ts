// Metrología sobre el plano de la calle (corre en el celular, sin dependencias).
//
// La idea: el modelo dibuja el contorno del bache en la imagen (en píxeles), pero un bache
// lejano se ve chico y uno cercano se ve grande. Para medirlo en metros se proyecta cada
// vértice del contorno desde la imagen al piso:
//
//   · Cámara "pinhole": focal f (en píxeles) y centro de la imagen. La focal sale del campo
//     de visión (calibrado una vez con un rectángulo de medida conocida, o un valor típico).
//   · Orientación: la gravedad medida por los sensores del celular dice hacia dónde está el
//     piso (inclinación y giro de la cámara).
//   · Altura: a cuántos metros del piso va la cámara.
//
// Con eso cada píxel define un rayo que corta al piso en un punto (X lateral, Y adelante), y el
// área del contorno en el piso sale con la fórmula del cordón de zapato (Gauss–Green).
// Solo se acepta la medida en la "zona dulce": ni muy lejos (cerca del horizonte un error de
// medio grado cambia mucho la distancia) ni cortado por el borde de la imagen.

export type Vec3 = [number, number, number];
export type Px = [number, number];
/** Punto en el piso: X a la derecha, Y hacia adelante, en metros desde la cámara */
export type Suelo = [number, number];

export type Camara = {
  /** Tamaño del cuadro de video en píxeles */
  ancho: number;
  alto: number;
  /** Focal en píxeles y centro óptico (se asume al centro del cuadro) */
  f: number;
  cx: number;
  cy: number;
};

/** Campo de visión típico del lado largo del video en la cámara principal de un celular */
export const FOV_TIPICO = 66;

const RAD = Math.PI / 180;

/** Cámara a partir del campo de visión (en grados) medido sobre el lado más largo del cuadro */
export function camaraDesdeFov(ancho: number, alto: number, fovLargo: number): Camara {
  const f = Math.max(ancho, alto) / 2 / Math.tan((fovLargo * RAD) / 2);
  return { ancho, alto, f, cx: ancho / 2, cy: alto / 2 };
}

export const fovDesdeFocal = (cam: Pick<Camara, "ancho" | "alto" | "f">) =>
  (2 * Math.atan(Math.max(cam.ancho, cam.alto) / 2 / cam.f)) / RAD;

// ---------------------------------------------------------------------------
// Vectores
// ---------------------------------------------------------------------------
const punto = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cruz = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const escalar = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const restar = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export function normalizar(a: Vec3): Vec3 {
  const n = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / n, a[1] / n, a[2] / n];
}

/** Gira v alrededor del eje unitario e un ángulo en radianes (fórmula de Rodrigues) */
export function rotar(v: Vec3, e: Vec3, ang: number): Vec3 {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const exv = cruz(e, v);
  const k = punto(e, v) * (1 - c);
  return [v[0] * c + exv[0] * s + e[0] * k, v[1] * c + exv[1] * s + e[1] * k, v[2] * c + exv[2] * s + e[2] * k];
}

// ---------------------------------------------------------------------------
// Orientación: de los sensores del celular a la cámara
// ---------------------------------------------------------------------------

/**
 * Dirección "hacia abajo" en los ejes del celular (x a la derecha de la pantalla, y hacia arriba,
 * z saliendo de la pantalla), a partir de beta y gamma de DeviceOrientationEvent (en grados).
 * Alfa (la brújula) no cambia hacia dónde queda el piso.
 */
export function abajoDesdeOrientacion(beta: number, gamma: number): Vec3 {
  const b = beta * RAD;
  const g = gamma * RAD;
  return [Math.sin(g) * Math.cos(b), -Math.sin(b), -Math.cos(b) * Math.cos(g)];
}

/**
 * Pasa "abajo" de los ejes del celular a los de la cámara trasera (X a la derecha de la imagen,
 * Y hacia abajo de la imagen, Z hacia donde mira la cámara). anguloPantalla es
 * screen.orientation.angle: 0 vertical, 90 acostado con la parte de arriba a la izquierda, 270 al revés.
 */
export function abajoEnCamara(abajoCel: Vec3, anguloPantalla: number): Vec3 {
  const a = anguloPantalla * RAD;
  const derecha: Vec3 = [Math.cos(a), -Math.sin(a), 0];
  const haciaAbajo: Vec3 = [-Math.sin(a), -Math.cos(a), 0];
  return normalizar([punto(abajoCel, derecha), punto(abajoCel, haciaAbajo), -abajoCel[2]]);
}

/** Inclinación de la cámara hacia el piso (grados, positivo = mira hacia abajo) y giro (grados) */
export function inclinacion(abajoCam: Vec3) {
  const [x, y, z] = normalizar(abajoCam);
  return { pitch: Math.asin(Math.max(-1, Math.min(1, z))) / RAD, roll: Math.atan2(-x, y) / RAD };
}

/** Ejes del piso vistos desde la cámara: derecha, adelante (horizontal) y arriba */
export type Ejes = { derecha: Vec3; adelante: Vec3; arriba: Vec3 };

export function ejesSuelo(abajoCam: Vec3): Ejes | null {
  const arriba = escalar(normalizar(abajoCam), -1);
  const z: Vec3 = [0, 0, 1];
  const proy = restar(z, escalar(arriba, punto(z, arriba)));
  // La cámara mira casi recto hacia abajo o hacia arriba: no hay "adelante"
  if (Math.hypot(...proy) < 0.2) return null;
  const adelante = normalizar(proy);
  return { derecha: cruz(adelante, arriba), adelante, arriba };
}

/** Píxel → punto del piso. null si el píxel está arriba del horizonte (o casi). */
export function pixelASuelo([u, v]: Px, cam: Camara, ejes: Ejes, alturaM: number): Suelo | null {
  const r: Vec3 = [(u - cam.cx) / cam.f, (v - cam.cy) / cam.f, 1];
  const rz = punto(r, ejes.arriba);
  if (rz > -1e-3) return null;
  const t = alturaM / -rz;
  return [t * punto(r, ejes.derecha), t * punto(r, ejes.adelante)];
}

/** Punto del piso → píxel (para dibujar la cuadrícula). null si queda detrás de la cámara. */
export function sueloAPixel([x, y]: Suelo, cam: Camara, ejes: Ejes, alturaM: number): Px | null {
  const p: Vec3 = [
    x * ejes.derecha[0] + y * ejes.adelante[0] - alturaM * ejes.arriba[0],
    x * ejes.derecha[1] + y * ejes.adelante[1] - alturaM * ejes.arriba[1],
    x * ejes.derecha[2] + y * ejes.adelante[2] - alturaM * ejes.arriba[2],
  ];
  if (p[2] <= 1e-6) return null;
  return [cam.cx + (cam.f * p[0]) / p[2], cam.cy + (cam.f * p[1]) / p[2]];
}

/** Altura (en px) de la línea del horizonte en el centro de la imagen; null si no se ve */
export function horizonteY(cam: Camara, ejes: Ejes): number | null {
  const lejos = sueloAPixel([0, 10_000], cam, ejes, 1);
  return lejos ? lejos[1] : null;
}

// ---------------------------------------------------------------------------
// Polígonos en el piso
// ---------------------------------------------------------------------------

/** Área con signo (fórmula del cordón de zapato / Gauss–Green) */
export function areaConSigno(p: [number, number][]) {
  let s = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) s += p[j][0] * p[i][1] - p[i][0] * p[j][1];
  return s / 2;
}
export const area = (p: [number, number][]) => Math.abs(areaConSigno(p));

export function centroide(p: [number, number][]): [number, number] {
  const a = areaConSigno(p);
  if (Math.abs(a) < 1e-12) {
    const n = p.length || 1;
    return [p.reduce((s, q) => s + q[0], 0) / n, p.reduce((s, q) => s + q[1], 0) / n];
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const k = p[j][0] * p[i][1] - p[i][0] * p[j][1];
    cx += (p[j][0] + p[i][0]) * k;
    cy += (p[j][1] + p[i][1]) * k;
  }
  return [cx / (6 * a), cy / (6 * a)];
}

// ---------------------------------------------------------------------------
// Medición de un contorno con compuertas de calidad ("zona dulce")
// ---------------------------------------------------------------------------

export const ZONA_DULCE = {
  /** Distancia hacia adelante del centro del bache, en metros */
  minM: 3,
  maxM: 14,
  /** Ángulo mínimo con que la cámara ve el piso en el punto más lejano del bache (rasante) */
  anguloMinGrados: 4.5,
  /** Margen con el borde de la imagen: si el contorno lo toca, el bache está cortado */
  bordePx: 3,
  /** Píxeles mínimos del contorno en la imagen para confiar en el área */
  areaMinPx: 120,
};

export type Medida = {
  /** Contorno proyectado al piso (m) */
  suelo: Suelo[];
  area_m2: number;
  /** Centro del bache en el piso: X lateral, Y adelante (m) */
  centro: Suelo;
  /** Extensión: a lo largo de la calle y a lo ancho (m) */
  largo_m: number;
  ancho_m: number;
  /** Cuánto cambia el área si la inclinación tuviera ±0.5° de error (m²) */
  sensibilidad_m2: number;
  /** ¿Sirve para medir el área? (si no, sirve solo para ubicarlo) */
  enZona: boolean;
  /** Por qué no está en la zona dulce */
  motivo?: "lejos" | "cerca" | "rasante" | "borde" | "chico";
};

/**
 * Mide un contorno (en píxeles del cuadro). Devuelve null si algún vértice queda arriba del
 * horizonte (no se puede proyectar).
 */
export function medirContorno(contorno: Px[], cam: Camara, abajoCam: Vec3, alturaM: number): Medida | null {
  if (contorno.length < 3) return null;
  const ejes = ejesSuelo(abajoCam);
  if (!ejes) return null;
  const suelo: Suelo[] = [];
  for (const p of contorno) {
    const s = pixelASuelo(p, cam, ejes, alturaM);
    if (!s) return null;
    suelo.push(s);
  }
  const area_m2 = area(suelo);
  const centro = centroide(suelo);
  const xs = suelo.map((s) => s[0]);
  const ys = suelo.map((s) => s[1]);
  const lejano = Math.max(...ys);

  // Sensibilidad: el mismo contorno con la cámara ±0.5° más inclinada
  const eje = ejes.derecha;
  const areaCon = (ang: number) => {
    const e2 = ejesSuelo(rotar(abajoCam, eje, ang));
    if (!e2) return null;
    const s2 = contorno.map((p) => pixelASuelo(p, cam, e2, alturaM));
    return s2.every(Boolean) ? area(s2 as Suelo[]) : null;
  };
  const a1 = areaCon(0.5 * RAD);
  const a2 = areaCon(-0.5 * RAD);
  const sensibilidad_m2 = a1 != null && a2 != null ? Math.abs(a1 - a2) / 2 : Infinity;

  const z = ZONA_DULCE;
  const toca = contorno.some(([u, v]) => u <= z.bordePx || v <= z.bordePx || u >= cam.ancho - 1 - z.bordePx || v >= cam.alto - 1 - z.bordePx);
  const motivo: Medida["motivo"] =
    centro[1] > z.maxM
      ? "lejos"
      : centro[1] < z.minM
        ? "cerca"
        : Math.atan2(alturaM, lejano) / RAD < z.anguloMinGrados
          ? "rasante"
          : toca
            ? "borde"
            : area(contorno) < z.areaMinPx
              ? "chico"
              : undefined;

  return {
    suelo,
    area_m2,
    centro,
    largo_m: Math.max(...ys) - Math.min(...ys),
    ancho_m: Math.max(...xs) - Math.min(...xs),
    sensibilidad_m2,
    enZona: !motivo,
    motivo,
  };
}

// ---------------------------------------------------------------------------
// Calibración con un rectángulo de medida conocida en el piso
// ---------------------------------------------------------------------------

export type Calibracion = {
  fovLargo: number;
  alturaM: number;
  /** Error de forma después del ajuste (0.03 = 3%) */
  error: number;
};

/**
 * Ajusta el campo de visión (y la altura, si no se conoce) para que las 4 esquinas tocadas en la
 * imagen formen en el piso un rectángulo de anchoM × largoM. Las esquinas van en orden alrededor
 * del rectángulo (cualquiera de las dos vueltas), empezando por una esquina del lado "ancho".
 */
export function calibrarConRectangulo(opc: {
  esquinas: Px[];
  anchoM: number;
  largoM: number;
  abajoCam: Vec3;
  ancho: number;
  alto: number;
  /** Si se midió con cinta, se usa y solo se ajusta el campo de visión */
  alturaM?: number;
}): Calibracion | null {
  const { esquinas, anchoM, largoM, abajoCam, ancho, alto } = opc;
  if (esquinas.length !== 4 || !(anchoM > 0) || !(largoM > 0)) return null;
  const ejes = ejesSuelo(abajoCam);
  if (!ejes) return null;
  const lados = [anchoM, largoM, anchoM, largoM];
  const diag = Math.hypot(anchoM, largoM);

  const evaluar = (fov: number) => {
    const cam = camaraDesdeFov(ancho, alto, fov);
    const s = esquinas.map((p) => pixelASuelo(p, cam, ejes, 1));
    if (!s.every(Boolean)) return null;
    const q = s as Suelo[];
    const medidos = [0, 1, 2, 3].map((i) => Math.hypot(q[(i + 1) % 4][0] - q[i][0], q[(i + 1) % 4][1] - q[i][1]));
    const diagonales = [Math.hypot(q[2][0] - q[0][0], q[2][1] - q[0][1]), Math.hypot(q[3][0] - q[1][0], q[3][1] - q[1][1])];
    const reales = [...lados, diag, diag];
    const todos = [...medidos, ...diagonales];
    // Escala (altura) por mínimos cuadrados: h · medido ≈ real
    const h = opc.alturaM ?? todos.reduce((s2, m, i) => s2 + m * reales[i], 0) / todos.reduce((s2, m) => s2 + m * m, 0);
    const err = Math.sqrt(todos.reduce((s2, m, i) => s2 + ((h * m - reales[i]) / reales[i]) ** 2, 0) / todos.length);
    return { h, err };
  };

  let mejor: { fov: number; h: number; err: number } | null = null;
  for (let fov = 30; fov <= 110; fov += 0.5) {
    const r = evaluar(fov);
    if (r && (!mejor || r.err < mejor.err)) mejor = { fov, ...r };
  }
  if (!mejor) return null;
  // Afinar alrededor del mejor
  for (let fov = mejor.fov - 0.5; fov <= mejor.fov + 0.5; fov += 0.02) {
    const r = evaluar(fov);
    if (r && r.err < mejor.err) mejor = { fov, ...r };
  }
  return { fovLargo: Math.round(mejor.fov * 100) / 100, alturaM: Math.round(mejor.h * 1000) / 1000, error: mejor.err };
}

// ---------------------------------------------------------------------------
// Del piso al mapa
// ---------------------------------------------------------------------------

const M_POR_GRADO_LAT = 111_132;
const mPorGradoLng = (lat: number) => 111_320 * Math.cos(lat * RAD);

/**
 * Ubicación en el mapa de un punto del piso, sabiendo dónde está la cámara y hacia dónde va
 * (rumbo en grados desde el norte, en el sentido del reloj).
 */
export function sueloALatLng([x, y]: Suelo, lat: number, lng: number, rumbo: number): [number, number] {
  const r = rumbo * RAD;
  const este = y * Math.sin(r) + x * Math.cos(r);
  const norte = y * Math.cos(r) - x * Math.sin(r);
  return [lat + norte / M_POR_GRADO_LAT, lng + este / mPorGradoLng(lat)];
}

/** Coordenadas locales en metros (este, norte) respecto a un origen: para comparar posiciones */
export function aLocal([lat, lng]: [number, number], [lat0, lng0]: [number, number]): [number, number] {
  return [(lng - lng0) * mPorGradoLng(lat0), (lat - lat0) * M_POR_GRADO_LAT];
}
export function deLocal([e, n]: [number, number], [lat0, lng0]: [number, number]): [number, number] {
  return [lat0 + n / M_POR_GRADO_LAT, lng0 + e / mPorGradoLng(lat0)];
}

/** Rumbo (grados desde el norte) entre dos puntos cercanos */
export function rumboEntre(a: [number, number], b: [number, number]) {
  const [e, n] = aLocal(b, a);
  return ((Math.atan2(e, n) / RAD) % 360 + 360) % 360;
}

// ---------------------------------------------------------------------------
// Medida de referencia (verdad de campo): homografía con una hoja de tamaño conocido
// ---------------------------------------------------------------------------
// Si en la foto aparece un rectángulo de medida conocida (una hoja carta) sobre el mismo piso que
// el bache, las 4 esquinas bastan para pasar cualquier punto de la foto al piso en metros, sin
// calibrar la cámara ni saber su inclinación (como el tablero ChArUco de una medición de campo).

export type Homografia = number[]; // 9 valores, fila por fila

/** Homografía que lleva los 4 puntos `de` a los 4 puntos `a` (DLT con h33 = 1) */
export function homografia(de: [number, number][], a: [number, number][]): Homografia | null {
  if (de.length !== 4 || a.length !== 4) return null;
  const M: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = de[i];
    const [X, Y] = a[i];
    M.push([x, y, 1, 0, 0, 0, -x * X, -y * X, X]);
    M.push([0, 0, 0, x, y, 1, -x * Y, -y * Y, Y]);
  }
  // Eliminación de Gauss con pivoteo parcial
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let f = c + 1; f < 8; f++) if (Math.abs(M[f][c]) > Math.abs(M[p][c])) p = f;
    if (Math.abs(M[p][c]) < 1e-12) return null; // tres puntos alineados
    [M[c], M[p]] = [M[p], M[c]];
    for (let f = 0; f < 8; f++) {
      if (f === c) continue;
      const k = M[f][c] / M[c][c];
      for (let j = c; j < 9; j++) M[f][j] -= k * M[c][j];
    }
  }
  return [...Array.from({ length: 8 }, (_, i) => M[i][8] / M[i][i]), 1];
}

export function aplicarHomografia(H: Homografia, [x, y]: [number, number]): [number, number] {
  const w = H[6] * x + H[7] * y + H[8];
  return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
}

/**
 * Mide un contorno tocado en una foto usando un rectángulo de referencia en el mismo piso.
 * esquinas: las 4 esquinas de la hoja en orden alrededor; 1→2 mide anchoM y 2→3 largoM.
 */
export function medirConReferencia(esquinas: Px[], anchoM: number, largoM: number, contorno: Px[]) {
  const H = homografia(esquinas, [
    [0, 0],
    [anchoM, 0],
    [anchoM, largoM],
    [0, largoM],
  ]);
  if (!H || contorno.length < 3) return null;
  const piso = contorno.map((p) => aplicarHomografia(H, p));
  const xs = piso.map((p) => p[0]);
  const ys = piso.map((p) => p[1]);
  let perimetro = 0;
  for (let i = 0; i < piso.length; i++) {
    const [p, q] = [piso[i], piso[(i + 1) % piso.length]];
    perimetro += Math.hypot(q[0] - p[0], q[1] - p[1]);
  }
  return {
    piso,
    area_m2: area(piso),
    perimetro_m: perimetro,
    ancho_m: Math.max(...xs) - Math.min(...xs),
    largo_m: Math.max(...ys) - Math.min(...ys),
  };
}
