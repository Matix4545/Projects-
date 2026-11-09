import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Marco";

export const metadata: Metadata = { title: "Darme de baja del boletín", robots: { index: false } };

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function BajaBoletin({ searchParams }: Props) {
  const { t = "", hecho } = await searchParams;
  return (
    <main className="contenedor flex min-h-screen flex-col items-center justify-center gap-5 py-10 text-center">
      <Logo />
      {hecho === "1" ? (
        <>
          <h1 className="text-2xl font-bold">Listo, ya no te mandaremos el boletín</h1>
          <p className="max-w-md text-gris">Si cambias de opinión, vuelve a dejar tu correo en la página de vacantes remotas.</p>
          <Link href="/remoto-dolares" className="boton">
            Ver vacantes remotas en dólares
          </Link>
        </>
      ) : hecho === "0" ? (
        <>
          <h1 className="text-2xl font-bold">Ese correo ya no está suscrito</h1>
          <p className="max-w-md text-gris">Puede que ya te hayas dado de baja. Si sigues recibiendo correos, escríbenos a contacto@chambaradar.com.</p>
          <Link href="/" className="boton">
            Ir al inicio
          </Link>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold">¿Dejar de recibir las 5 vacantes semanales?</h1>
          <p className="max-w-md text-gris">Ya no te mandaremos el boletín. Tus alertas por correo, si tienes, siguen igual.</p>
          <form action={`/api/boletin/baja?t=${encodeURIComponent(t)}`} method="post">
            <button className="boton">Sí, darme de baja</button>
          </form>
        </>
      )}
    </main>
  );
}
