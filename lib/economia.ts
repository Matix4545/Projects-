// Estimación PRELIMINAR del costo que la rugosidad de las calles causa a los vehículos de Cajeme.
//
// Todo lo que es supuesto está en SUPUESTOS, con un valor bajo, medio y alto. Cuando haya
// datos reales (IRI de referencia de la SICT para calibrar, aforos de tránsito, costos locales)
// se reemplazan aquí y la página de estadísticas se recalcula sola.
//
// Método (simplificado de HDM-4 del Banco Mundial):
//   1. Rugosidad medida (m/s²) → IRI (m/km): conversión provisional, normalizada a 40 km/h.
//   2. IRI → costo extra por km para un auto: gasolina, llantas y reparaciones crecen con el IRI
//      por encima del de una calle en buen estado.
//   3. Costo extra promedio por km (ponderado por los km medidos) × km que maneja un auto al año
//      en Cajeme × número de vehículos. Los recorridos de repartidores y choferes siguen las
//      calles por donde de verdad circula la gente, así que el promedio ya va "pesado" por uso.

export type Escenario = "bajo" | "medio" | "alto";
type Rango = Record<Escenario, number>;

export const SUPUESTOS = {
  /** IRI (m/km) por cada m/s² de rugosidad medida a 40 km/h. PROVISIONAL: se reemplaza con la calibración */
  iriPorRms: { bajo: 2.5, medio: 3.5, alto: 4.5 } as Rango,
  /** La rugosidad medida crece con la velocidad; se normaliza a 40 km/h con este exponente */
  exponenteVelocidad: 0.5,
  /** IRI de una calle en buen estado: debajo de esto no hay costo extra (DGST: bueno < 2.5) */
  iriBase: 2.0,
  /** Costo normal por km de un auto, en pesos de 2026 */
  gasolinaPorKm: { bajo: 1.8, medio: 2.2, alto: 2.6 } as Rango,
  llantasPorKm: { bajo: 0.25, medio: 0.35, alto: 0.45 } as Rango,
  reparacionesPorKm: { bajo: 0.6, medio: 0.9, alto: 1.2 } as Rango,
  /** % de gasolina extra por cada punto de IRI arriba de la base (HDM-4: ~1–2 %) */
  gasolinaPctPorIri: { bajo: 0.5, medio: 1.5, alto: 2.0 } as Rango,
  /** % de desgaste de llantas extra por punto de IRI (HDM-4 / NCHRP 720: ~1 %) */
  llantasPctPorIri: { bajo: 0.5, medio: 1.0, alto: 1.5 } as Rango,
  /** Reparaciones y suspensión: % extra según el IRI (NCHRP 720: +10 % en IRI 4, +40 % en IRI 5) */
  reparacionesPct: [
    [2, 0],
    [4, 10],
    [5, 40],
    [8, 130],
  ] as [number, number][],
  reparacionesTope: 150,
  reparacionesEscala: { bajo: 0.5, medio: 1.0, alto: 1.5 } as Rango,
  /** Vehículos en Cajeme */
  vehiculos: 250_000,
  /** km que maneja un vehículo al año dentro de Cajeme */
  kmAnioPorVehiculo: { bajo: 7_000, medio: 9_000, alto: 11_000 } as Rango,
  /** Escala de la DGST para red básica libre y secundaria (m/km) */
  iriAceptable: 2.5,
  iriNoSatisfactorio: 3.5,
};

/** IRI estimado (m/km) de un tramo a partir de su rugosidad medida y su velocidad */
export function estimarIri(rms: number, velKmh: number, e: Escenario = "medio", s = SUPUESTOS) {
  const v = Math.max(velKmh, 15);
  return s.iriPorRms[e] * rms * (40 / v) ** s.exponenteVelocidad;
}

function interpolar(tabla: [number, number][], x: number) {
  if (x <= tabla[0][0]) return tabla[0][1];
  for (let i = 1; i < tabla.length; i++) {
    const [x0, y0] = tabla[i - 1];
    const [x1, y1] = tabla[i];
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  // Después del último punto sigue con la misma pendiente
  const [xa, ya] = tabla[tabla.length - 2];
  const [xb, yb] = tabla[tabla.length - 1];
  return yb + ((x - xb) / (xb - xa)) * (yb - ya);
}

/** Costo extra por km (pesos) que causa a un auto una calle con ese IRI */
export function costoExtraPorKm(iri: number, e: Escenario = "medio", s = SUPUESTOS) {
  const d = Math.max(0, iri - s.iriBase);
  const gasolina = s.gasolinaPorKm[e] * (s.gasolinaPctPorIri[e] / 100) * d;
  const llantas = s.llantasPorKm[e] * (s.llantasPctPorIri[e] / 100) * d;
  const pct = Math.min(interpolar(s.reparacionesPct, iri), s.reparacionesTope) * s.reparacionesEscala[e];
  const reparaciones = s.reparacionesPorKm[e] * (Math.max(0, pct) / 100);
  return { gasolina, llantas, reparaciones, total: gasolina + llantas + reparaciones };
}

/** Lo medido, agrupado: rugosidad, velocidad y metros */
export type GrupoMedido = { rms: number; vel_kmh: number; m: number };

export type Estimacion = {
  km: number;
  iriPromedio: number;
  /** km por clase de la DGST (con el escenario medio) */
  kmPorClase: { bueno: number; aceptable: number; noSatisfactorio: number };
  porEscenario: Record<
    Escenario,
    {
      porKm: number;
      porVehiculoAnio: number;
      totalAnio: number;
      desglose: { gasolina: number; llantas: number; reparaciones: number };
    }
  >;
};

export function estimar(grupos: GrupoMedido[], s = SUPUESTOS): Estimacion | null {
  const metros = grupos.reduce((t, g) => t + g.m, 0);
  if (metros <= 0) return null;
  const kmPorClase = { bueno: 0, aceptable: 0, noSatisfactorio: 0 };
  let sumaIri = 0;
  for (const g of grupos) {
    const iri = estimarIri(g.rms, g.vel_kmh, "medio", s);
    sumaIri += iri * g.m;
    const clase = iri < s.iriAceptable ? "bueno" : iri <= s.iriNoSatisfactorio ? "aceptable" : "noSatisfactorio";
    kmPorClase[clase] += g.m / 1000;
  }
  const porEscenario = {} as Estimacion["porEscenario"];
  for (const e of ["bajo", "medio", "alto"] as const) {
    const suma = { gasolina: 0, llantas: 0, reparaciones: 0 };
    for (const g of grupos) {
      const c = costoExtraPorKm(estimarIri(g.rms, g.vel_kmh, e, s), e, s);
      suma.gasolina += c.gasolina * g.m;
      suma.llantas += c.llantas * g.m;
      suma.reparaciones += c.reparaciones * g.m;
    }
    const desglose = { gasolina: suma.gasolina / metros, llantas: suma.llantas / metros, reparaciones: suma.reparaciones / metros };
    const porKm = desglose.gasolina + desglose.llantas + desglose.reparaciones;
    const porVehiculoAnio = porKm * s.kmAnioPorVehiculo[e];
    porEscenario[e] = { porKm, porVehiculoAnio, totalAnio: porVehiculoAnio * s.vehiculos, desglose };
  }
  return { km: metros / 1000, iriPromedio: sumaIri / metros, kmPorClase, porEscenario };
}
