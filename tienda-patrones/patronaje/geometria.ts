// Geometría 2D para patronaje. Unidades: centímetros. Eje Y hacia arriba (como en AutoCAD).

export type Pt = { x: number; y: number };

export const P = (x: number, y: number): Pt => ({ x, y });
export const suma = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
export const resta = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
export const escalar = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k });
export const punto = (a: Pt, b: Pt) => a.x * b.x + a.y * b.y;
export const cruz = (a: Pt, b: Pt) => a.x * b.y - a.y * b.x;
export const largo = (a: Pt) => Math.hypot(a.x, a.y);
export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
export const unitario = (a: Pt): Pt => {
  const l = largo(a) || 1;
  return { x: a.x / l, y: a.y / l };
};
export const dir = (a: Pt, b: Pt): Pt => unitario(resta(b, a));
/** Perpendicular a la izquierda (gira +90°). */
export const perp = (a: Pt): Pt => ({ x: -a.y, y: a.x });
export const angulo = (a: Pt) => Math.atan2(a.y, a.x);
export const grados = (g: number) => (g * Math.PI) / 180;
export const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const medio = (a: Pt, b: Pt) => lerp(a, b, 0.5);
/** Punto a `l` cm de `o` en el ángulo `ang` (radianes). */
export const polar = (o: Pt, ang: number, l: number): Pt => ({ x: o.x + Math.cos(ang) * l, y: o.y + Math.sin(ang) * l });
/** Avanza `l` cm desde `a` en dirección a `b`. */
export const hacia = (a: Pt, b: Pt, l: number): Pt => suma(a, escalar(dir(a, b), l));

export function rotar(p: Pt, c: Pt, ang: number): Pt {
  const s = Math.sin(ang);
  const co = Math.cos(ang);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return { x: c.x + dx * co - dy * s, y: c.y + dx * s + dy * co };
}

/** Refleja `p` sobre la recta que pasa por a y b. */
export function reflejar(p: Pt, a: Pt, b: Pt): Pt {
  const d = dir(a, b);
  const v = resta(p, a);
  const proy = escalar(d, punto(v, d));
  return suma(a, resta(escalar(proy, 2), v));
}

/** Intersección de dos rectas infinitas (a1-a2) y (b1-b2). */
export function interseccion(a1: Pt, a2: Pt, b1: Pt, b2: Pt): Pt | null {
  const r = resta(a2, a1);
  const s = resta(b2, b1);
  const den = cruz(r, s);
  if (Math.abs(den) < 1e-12) return null;
  const t = cruz(resta(b1, a1), s) / den;
  return suma(a1, escalar(r, t));
}

/** Intersección de segmentos; devuelve el punto y los parámetros t (en a) y u (en b). */
export function cruceSegmentos(a1: Pt, a2: Pt, b1: Pt, b2: Pt): { p: Pt; t: number; u: number } | null {
  const r = resta(a2, a1);
  const s = resta(b2, b1);
  const den = cruz(r, s);
  if (Math.abs(den) < 1e-12) return null;
  const q = resta(b1, a1);
  const t = cruz(q, s) / den;
  const u = cruz(q, r) / den;
  if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return null;
  return { p: suma(a1, escalar(r, t)), t, u };
}

// ── Curvas ───────────────────────────────────────────────────────────────────

export function bezier(p0: Pt, c1: Pt, c2: Pt, p1: Pt, n = 24): Pt[] {
  const r: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    r.push({
      x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p1.x,
      y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p1.y,
    });
  }
  return r;
}

/**
 * Curva de `a` a `b` que sale de `a` con dirección `da` y llega a `b` con dirección `db`
 * (vectores, no hace falta que sean unitarios). `ka`/`kb` controlan qué tan "llena" es la curva.
 */
export function curva(a: Pt, da: Pt, b: Pt, db: Pt, ka = 0.45, kb = 0.45, n = 24): Pt[] {
  const d = dist(a, b);
  return bezier(a, suma(a, escalar(unitario(da), d * ka)), resta(b, escalar(unitario(db), d * kb)), b, n);
}

/** Spline Catmull-Rom (centrípeta) que pasa por todos los puntos. */
export function spline(pts: Pt[], porTramo = 12): Pt[] {
  if (pts.length < 3) return pts.slice();
  const r: Pt[] = [pts[0]];
  const ext = [resta(escalar(pts[0], 2), pts[1]), ...pts, resta(escalar(pts[pts.length - 1], 2), pts[pts.length - 2])];
  for (let i = 1; i < ext.length - 2; i++) {
    const [p0, p1, p2, p3] = [ext[i - 1], ext[i], ext[i + 1], ext[i + 2]];
    const t0 = 0;
    const t1 = t0 + Math.sqrt(dist(p0, p1) || 1e-6);
    const t2 = t1 + Math.sqrt(dist(p1, p2) || 1e-6);
    const t3 = t2 + Math.sqrt(dist(p2, p3) || 1e-6);
    for (let j = 1; j <= porTramo; j++) {
      const t = t1 + ((t2 - t1) * j) / porTramo;
      const A1 = suma(escalar(p0, (t1 - t) / (t1 - t0)), escalar(p1, (t - t0) / (t1 - t0)));
      const A2 = suma(escalar(p1, (t2 - t) / (t2 - t1)), escalar(p2, (t - t1) / (t2 - t1)));
      const A3 = suma(escalar(p2, (t3 - t) / (t3 - t2)), escalar(p3, (t - t2) / (t3 - t2)));
      const B1 = suma(escalar(A1, (t2 - t) / (t2 - t0)), escalar(A2, (t - t0) / (t2 - t0)));
      const B2 = suma(escalar(A2, (t3 - t) / (t3 - t1)), escalar(A3, (t - t1) / (t3 - t1)));
      r.push(suma(escalar(B1, (t2 - t) / (t2 - t1)), escalar(B2, (t - t1) / (t2 - t1))));
    }
  }
  return r;
}

/** Arco de circunferencia de `a0` a `a1` (radianes). */
export function arco(c: Pt, r: number, a0: number, a1: number, n = 48): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) pts.push(polar(c, a0 + ((a1 - a0) * i) / n, r));
  return pts;
}

// ── Polilíneas ───────────────────────────────────────────────────────────────

export function longitud(pts: Pt[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += dist(pts[i - 1], pts[i]);
  return l;
}

/** Punto a una distancia `l` medida sobre la polilínea. */
export function enLongitud(pts: Pt[], l: number): { p: Pt; i: number; t: number } {
  let acum = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = dist(pts[i - 1], pts[i]);
    if (acum + d >= l - 1e-9 && d > 0) {
      const t = Math.max(0, Math.min(1, (l - acum) / d));
      return { p: lerp(pts[i - 1], pts[i], t), i: i - 1, t };
    }
    acum += d;
  }
  return { p: pts[pts.length - 1], i: pts.length - 2, t: 1 };
}

/** Divide la polilínea en dos a la distancia `l`. */
export function partir(pts: Pt[], l: number): [Pt[], Pt[]] {
  const { p, i } = enLongitud(pts, l);
  return [[...pts.slice(0, i + 1), p], [p, ...pts.slice(i + 1)]];
}

export function remuestrear(pts: Pt[], paso: number): Pt[] {
  const L = longitud(pts);
  const n = Math.max(1, Math.round(L / paso));
  const r: Pt[] = [];
  for (let k = 0; k <= n; k++) r.push(enLongitud(pts, (L * k) / n).p);
  return r;
}

/** Quita puntos repetidos consecutivos. */
export function limpiar<T extends Pt>(pts: T[], tol = 1e-4): T[] {
  const r: T[] = [];
  for (const p of pts) {
    const u = r[r.length - 1];
    if (!u) r.push(p);
    else if (dist(u, p) > tol) r.push(p);
    else if ((p as { n?: string }).n && !(u as { n?: string }).n) r[r.length - 1] = p; // conserva el nombre
  }
  return r;
}

export function areaFirmada(poli: Pt[]): number {
  let a = 0;
  for (let i = 0; i < poli.length; i++) {
    const p = poli[i];
    const q = poli[(i + 1) % poli.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

export function dentro(p: Pt, poli: Pt[]): boolean {
  let c = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const a = poli[i];
    const b = poli[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

export function caja(pts: Pt[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) {
    if (p.x < x0) x0 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.x > x1) x1 = p.x;
    if (p.y > y1) y1 = p.y;
  }
  return { x0, y0, x1, y1, ancho: x1 - x0, alto: y1 - y0 };
}

/** Punto más cercano sobre el contorno cerrado. */
export function masCercano(poli: Pt[], p: Pt): { i: number; t: number; p: Pt; d: number } {
  let mejor = { i: 0, t: 0, p: poli[0], d: Infinity };
  for (let i = 0; i < poli.length; i++) {
    const a = poli[i];
    const b = poli[(i + 1) % poli.length];
    const ab = resta(b, a);
    const l2 = punto(ab, ab);
    const t = l2 ? Math.max(0, Math.min(1, punto(resta(p, a), ab) / l2)) : 0;
    const q = suma(a, escalar(ab, t));
    const d = dist(p, q);
    if (d < mejor.d) mejor = { i, t, p: q, d };
  }
  return mejor;
}

/** Suavizado laplaciano dejando fijos los extremos. */
export function suavizarPolilinea(pts: Pt[], iteraciones = 20, paso = 0.5): Pt[] {
  let r = pts.map((p) => ({ ...p }));
  for (let k = 0; k < iteraciones; k++) {
    const s = r.map((p) => ({ ...p }));
    for (let i = 1; i < r.length - 1; i++) {
      s[i].x = r[i].x + paso * ((r[i - 1].x + r[i + 1].x) / 2 - r[i].x);
      s[i].y = r[i].y + paso * ((r[i - 1].y + r[i + 1].y) / 2 - r[i].y);
    }
    r = s;
  }
  return r;
}

/**
 * Desplaza una polilínea cerrada (sentido antihorario) hacia afuera.
 * `margenes[i]` es el margen del tramo que empieza en el vértice i.
 */
export function desplazarCerrado(poli: Pt[], margenes: number[]): Pt[] {
  const n = poli.length;
  const r: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const prev = poli[(i - 1 + n) % n];
    const p = poli[i];
    const sig = poli[(i + 1) % n];
    const m1 = margenes[(i - 1 + n) % n];
    const m2 = margenes[i];
    const d1 = dir(prev, p);
    const d2 = dir(p, sig);
    // normal exterior de un contorno antihorario: perpendicular a la derecha
    const n1 = { x: d1.y, y: -d1.x };
    const n2 = { x: d2.y, y: -d2.x };
    const a1 = suma(p, escalar(n1, m1));
    const a2 = suma(p, escalar(n2, m2));
    let q: Pt | null = Math.abs(cruz(d1, d2)) < 1e-3 ? null : interseccion(a1, suma(a1, d1), a2, suma(a2, d2));
    if (!q) q = m1 === m2 ? suma(p, escalar(unitario(suma(n1, n2)), m1)) : medio(a1, a2);
    const lim = 4 * Math.max(m1, m2, 0.2);
    if (dist(q, p) > lim) {
      // esquina muy aguda: bisel
      r.push(a1, a2);
      continue;
    }
    r.push(q);
  }
  return r;
}
