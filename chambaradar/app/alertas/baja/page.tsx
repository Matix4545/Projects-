import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Marco";

export const metadata: Metadata = { title: "Dejar de recibir alerta", robots: { index: false } };

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function Baja({ searchParams }: Props) {
  const { t = "", hecho } = await searchParams;
  return (
    <main className="contenedor flex min-h-screen flex-col items-center justify-center gap-5 py-10 text-center">
      <Logo />
      {hecho === "1" ? (
        <>
          <h1 className="text-2xl font-bold">Listo, ya no te mandaremos esta alerta</h1>
          <p className="max-w-md text-gris">Puedes crear otras alertas o reactivarla cuando quieras desde Vacantes.</p>
          <Link href="/cuenta" className="boton">
            Administrar mis alertas
          </Link>
        </>
      ) : hecho === "0" ? (
        <>
          <h1 className="text-2xl font-bold">No encontramos esa alerta</h1>
          <p className="max-w-md text-gris">Puede que ya la hayas dado de baja. También puedes borrarla desde tu cuenta.</p>
          <Link href="/cuenta" className="boton">
            Ir a mi cuenta
          </Link>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold">¿Dejar de recibir esta alerta?</h1>
          <p className="max-w-md text-gris">Ya no te mandaremos correos de esta búsqueda. Tus otras alertas siguen igual.</p>
          <form action={`/api/alertas/baja?t=${encodeURIComponent(t)}`} method="post">
            <button className="boton">Sí, darme de baja</button>
          </form>
        </>
      )}
    </main>
  );
}
