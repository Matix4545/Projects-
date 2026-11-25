// Buzón de baches por enviar (cámara de /medir). Nada se pierde aunque se toque Terminar, se vaya la señal o
// se recargue la página: cada bache se guarda en el celular (IndexedDB, con su foto) y se reintenta con espera
// creciente mientras la página esté abierta, y al volver a abrirla. Si el servidor rechaza un bache por datos
// inválidos, ese se descarta y los demás siguen (uno malo no bloquea la cola).

export type MetaRecorrido = {
  sesion: string;
  fecha: string;
  modelo: string;
  plataforma: string;
  altura_m: number;
  fov: number;
  prueba: string | null;
};

export type DatosBache = {
  lat: number;
  lng: number;
  area_m2: number | null;
  area_sd: number | null;
  largo_m: number | null;
  ancho_m: number | null;
  confianza: number;
  confianza_max: number;
  cuadros: number;
  medidas: number;
  distancia_m: number;
  rumbo: number | null;
  precision_m: number | null;
};

type Item = { clave: string; meta: MetaRecorrido; bache: DatosBache; foto: Blob | null; creado: number };

export type Resultado = { pin_id: number | null; nuevo: boolean; calle: string | null; prueba: boolean; error?: string };
/** sin-conexion: no hay internet o no contestó · sesion: hay que volver a entrar · servidor: error del servidor */
export type Problema = null | "sin-conexion" | "sesion" | "servidor";
export type EstadoBuzon = { pendientes: number; problema: Problema; enviando: boolean };

const BASE = "rc_buzon";
const TABLA = "baches";
const LOTE = 10;
const TIEMPO_MAX_MS = 30_000;

const cola: Item[] = [];
const resultados = new Map<string, Resultado>();
let estado: EstadoBuzon = { pendientes: 0, problema: null, enviando: false };
const oyentes = new Set<(e: EstadoBuzon, r: ReadonlyMap<string, Resultado>) => void>();
let reloj: ReturnType<typeof setTimeout> | null = null;
let cuando = Infinity;
let fallas = 0;
/** Tras un 400 con varios baches, se mandan de uno en uno para encontrar el malo */
let unoPorUno = false;
let iniciado = false;

/* ---------- IndexedDB (si no hay, solo en memoria) ---------- */

let base: Promise<IDBDatabase | null> | null = null;
function abrir(): Promise<IDBDatabase | null> {
  base ??= new Promise((ok) => {
    try {
      const r = indexedDB.open(BASE, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(TABLA, { keyPath: "clave" });
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ok(null);
      r.onblocked = () => ok(null);
    } catch {
      ok(null);
    }
  });
  return base;
}

async function enTabla(modo: IDBTransactionMode, hacer: (t: IDBObjectStore) => void): Promise<void> {
  const db = await abrir();
  if (!db) return;
  await new Promise<void>((ok) => {
    try {
      const tx = db.transaction(TABLA, modo);
      hacer(tx.objectStore(TABLA));
      tx.oncomplete = () => ok();
      tx.onerror = () => ok();
      tx.onabort = () => ok();
    } catch {
      ok();
    }
  });
}

async function leerGuardados(): Promise<Item[]> {
  const db = await abrir();
  if (!db) return [];
  return new Promise((ok) => {
    try {
      const r = db.transaction(TABLA, "readonly").objectStore(TABLA).getAll();
      r.onsuccess = () => ok((r.result as Item[]) ?? []);
      r.onerror = () => ok([]);
    } catch {
      ok([]);
    }
  });
}

/* ---------- Estado y avisos ---------- */

function poner(cambio: Partial<EstadoBuzon>) {
  estado = { ...estado, ...cambio, pendientes: cola.length };
  oyentes.forEach((f) => f(estado, resultados));
}

/** Recibe el estado (pendientes, problema) y los resultados por clave cada vez que algo cambia */
export function suscribir(f: (e: EstadoBuzon, r: ReadonlyMap<string, Resultado>) => void) {
  oyentes.add(f);
  f(estado, resultados);
  return () => {
    oyentes.delete(f);
  };
}

function programar(ms: number) {
  const t = Date.now() + ms;
  if (reloj && t >= cuando) return;
  if (reloj) clearTimeout(reloj);
  cuando = t;
  reloj = setTimeout(() => {
    reloj = null;
    cuando = Infinity;
    void enviar();
  }, ms);
}

function reintentarLuego() {
  fallas++;
  programar(Math.min(60_000, 5_000 * 2 ** (fallas - 1)));
}

/** Intentar ya (al terminar, con el botón "Reintentar", al volver la señal o después de volver a entrar) */
export function enviarYa() {
  fallas = 0;
  if (estado.problema === "sesion") poner({ problema: null });
  programar(0);
}

/** Carga lo que quedó guardado de antes y empieza a enviarlo. Se puede llamar varias veces. */
export async function iniciar() {
  if (iniciado || typeof window === "undefined") return;
  iniciado = true;
  window.addEventListener("online", enviarYa);
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && cola.length && enviarYa());
  const guardados = await leerGuardados();
  for (const it of guardados) if (!cola.some((c) => c.clave === it.clave)) cola.push(it);
  cola.sort((a, b) => a.creado - b.creado);
  poner({});
  if (cola.length) programar(500);
}

/** Agrega baches confirmados de un recorrido. Se guardan en el celular antes de intentar enviarlos. */
export async function agregar(meta: MetaRecorrido, items: { clave: string; bache: DatosBache; foto: Blob | null }[]) {
  if (!items.length) return;
  const nuevos = items.map((i) => ({ ...i, meta, creado: Date.now() }));
  cola.push(...nuevos);
  poner({});
  await enTabla("readwrite", (t) => nuevos.forEach((n) => t.put(n)));
  programar(cola.length >= 5 ? 0 : 20_000);
}

function quitar(lote: Item[], res: (Resultado | undefined)[]) {
  lote.forEach((it, k) => {
    resultados.set(it.clave, res[k] ?? { pin_id: null, nuevo: false, calle: null, prueba: false, error: "sin respuesta" });
    const i = cola.indexOf(it);
    if (i >= 0) cola.splice(i, 1);
  });
  void enTabla("readwrite", (t) => lote.forEach((it) => t.delete(it.clave)));
  poner({});
}

async function enviar() {
  if (estado.enviando || !cola.length || estado.problema === "sesion") return;
  poner({ enviando: true });
  try {
    while (cola.length) {
      const primero = cola[0];
      const lote = cola.filter((c) => c.meta.sesion === primero.meta.sesion).slice(0, unoPorUno ? 1 : LOTE);
      const form = new FormData();
      form.set(
        "datos",
        JSON.stringify({
          ...primero.meta,
          baches: lote.map((it, k) => ({ ...it.bache, foto: it.foto ? `foto_${k}` : null })),
        }),
      );
      lote.forEach((it, k) => it.foto && form.set(`foto_${k}`, it.foto, `bache-${k}.jpg`));

      let res: Response;
      const control = new AbortController();
      const limite = setTimeout(() => control.abort(), TIEMPO_MAX_MS);
      try {
        res = await fetch("/api/baches-camara", { method: "POST", body: form, signal: control.signal });
      } catch {
        poner({ problema: "sin-conexion" });
        reintentarLuego();
        return;
      } finally {
        clearTimeout(limite);
      }

      if (res.status === 401) {
        // Se queda guardado; se manda cuando vuelva a entrar (enviarYa)
        poner({ problema: "sesion" });
        return;
      }
      if (res.status === 400) {
        if (lote.length > 1) {
          unoPorUno = true;
          continue;
        }
        quitar(lote, [{ pin_id: null, nuevo: false, calle: null, prueba: false, error: "datos inválidos" }]);
        continue;
      }
      if (!res.ok) {
        poner({ problema: "servidor" });
        reintentarLuego();
        return;
      }
      let r: { resultados?: Resultado[] } = {};
      try {
        r = await res.json();
      } catch {
        /* sin cuerpo: cuenta como enviado sin detalle */
      }
      quitar(lote, r.resultados ?? []);
      unoPorUno = unoPorUno && cola.some((c) => c.meta.sesion === primero.meta.sesion);
      fallas = 0;
      poner({ problema: null });
    }
  } catch {
    poner({ problema: "servidor" });
    reintentarLuego();
  } finally {
    poner({ enviando: false });
  }
}
