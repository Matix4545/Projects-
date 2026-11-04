"use client";
// Estado del navegador: carrito y país elegido (se guardan en este dispositivo).
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { PAISES, PAIS_PREDETERMINADO, TIENDA, type Licencia } from "@/lib/config";
import { paisPorCodigo, type Tasas } from "@/lib/dinero";
import type { Articulo } from "@/lib/precios";
import { buscarPatron } from "@/lib/catalogo";

type Estado = {
  carrito: Articulo[];
  agregar: (slug: string, licencia: Licencia) => void;
  quitar: (slug: string, licencia: Licencia) => void;
  vaciar: () => void;
  paisCodigo: string;
  cambiarPais: (codigo: string) => void;
  tasas: Tasas;
  listo: boolean; // ya se leyó lo guardado en el dispositivo
};

const Contexto = createContext<Estado | null>(null);

const CLAVE_CARRITO = "carrito-v1";
const CLAVE_PAIS = "pais-v1";

function leer<T>(clave: string, respaldo: T): T {
  try {
    const v = localStorage.getItem(clave);
    return v ? (JSON.parse(v) as T) : respaldo;
  } catch {
    return respaldo;
  }
}

function guardar(clave: string, valor: unknown) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    /* modo privado o almacenamiento bloqueado: el carrito vive solo en esta pestaña */
  }
}

/** Adivina el país por el idioma del navegador (es-CO → CO). */
function paisDelNavegador(): string {
  try {
    for (const idioma of navigator.languages ?? [navigator.language]) {
      const region = idioma.split("-")[1]?.toUpperCase();
      if (region && PAISES.some((p) => p.codigo === region)) return region;
    }
  } catch {}
  return PAIS_PREDETERMINADO;
}

export function ProveedorTienda({ children, tasas }: { children: React.ReactNode; tasas: Tasas }) {
  const [carrito, setCarrito] = useState<Articulo[]>([]);
  const [paisCodigo, setPais] = useState(PAIS_PREDETERMINADO);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    const guardado = leer<Articulo[]>(CLAVE_CARRITO, []);
    setCarrito(Array.isArray(guardado) ? guardado.filter((a) => buscarPatron(a.slug)) : []);
    setPais(leer<string | null>(CLAVE_PAIS, null) ?? paisDelNavegador());
    setListo(true);
  }, []);

  const actualizar = useCallback((nuevo: Articulo[]) => {
    setCarrito(nuevo);
    guardar(CLAVE_CARRITO, nuevo);
  }, []);

  const valor = useMemo<Estado>(
    () => ({
      carrito,
      listo,
      tasas,
      paisCodigo,
      agregar(slug, licencia) {
        // Un patrón solo puede ir una vez: si cambia la licencia, se reemplaza.
        const sin = carrito.filter((a) => a.slug !== slug);
        if (sin.length >= TIENDA.maxArticulos) return;
        actualizar([...sin, { slug, licencia }]);
      },
      quitar(slug, licencia) {
        actualizar(carrito.filter((a) => !(a.slug === slug && a.licencia === licencia)));
      },
      vaciar() {
        actualizar([]);
      },
      cambiarPais(codigo) {
        const p = paisPorCodigo(codigo);
        setPais(p.codigo);
        guardar(CLAVE_PAIS, p.codigo);
      },
    }),
    [carrito, listo, tasas, paisCodigo, actualizar],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useTienda(): Estado {
  const c = useContext(Contexto);
  if (!c) throw new Error("useTienda debe usarse dentro de <ProveedorTienda>");
  return c;
}
