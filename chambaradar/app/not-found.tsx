import Link from "next/link";
import { Logo } from "@/components/Marco";

export default function NoEncontrada() {
  return (
    <main className="contenedor flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <Logo />
      <h1 className="text-2xl font-bold">Esta página no existe</h1>
      <p className="text-gris">Pero hay cientos de vacantes que sí.</p>
      <Link href="/vacantes" className="boton">
        Ver vacantes
      </Link>
    </main>
  );
}
