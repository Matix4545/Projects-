import Link from "next/link";

export default function NoEncontrado() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="font-titulo text-6xl text-acento">404</p>
      <h1 className="mt-2 font-titulo text-3xl font-semibold">Esta página se descosió</h1>
      <p className="mt-3 text-suave">No encontramos lo que buscabas.</p>
      <Link href="/patrones" className="boton boton-principal mt-6">Ver patrones</Link>
    </div>
  );
}
