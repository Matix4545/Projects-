import { TALLAS_INFANTIL, TALLAS_MUJER, type GrupoTallas } from "@/lib/catalogo";

export function TablaMedidas({ grupo }: { grupo: GrupoTallas }) {
  const filas =
    grupo === "mujer"
      ? [
          { nombre: "Busto", valores: TALLAS_MUJER.map((t) => t.busto) },
          { nombre: "Cintura", valores: TALLAS_MUJER.map((t) => t.cintura) },
          { nombre: "Cadera", valores: TALLAS_MUJER.map((t) => t.cadera) },
        ]
      : [
          { nombre: "Estatura", valores: TALLAS_INFANTIL.map((t) => t.estatura) },
          { nombre: "Pecho", valores: TALLAS_INFANTIL.map((t) => t.pecho) },
          { nombre: "Cintura", valores: TALLAS_INFANTIL.map((t) => t.cintura) },
          { nombre: "Cadera", valores: TALLAS_INFANTIL.map((t) => t.cadera) },
        ];
  const tallas = grupo === "mujer" ? TALLAS_MUJER.map((t) => t.talla) : TALLAS_INFANTIL.map((t) => t.talla);

  return (
    <div className="overflow-x-auto rounded-2xl border border-borde bg-tarjeta">
      <table className="w-full min-w-[34rem] text-center text-sm">
        <caption className="sr-only">Medidas del cuerpo en centímetros</caption>
        <thead className="bg-crema">
          <tr>
            <th scope="col" className="p-3 text-left font-semibold">cm</th>
            {tallas.map((t) => (
              <th key={t} scope="col" className="p-3 font-semibold">{t}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.nombre} className="border-t border-borde">
              <th scope="row" className="p-3 text-left font-medium">{f.nombre}</th>
              {f.valores.map((v, i) => (
                <td key={i} className="p-3 tabular-nums">{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
