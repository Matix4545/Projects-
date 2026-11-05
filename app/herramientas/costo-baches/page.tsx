import { CostoBaches } from "@/components/herramientas/CostoBaches";
import { PaginaHerramienta, metadatosHerramienta } from "@/components/herramientas/PaginaHerramienta";

export const metadata = metadatosHerramienta("costo-baches");

export default function PaginaCostoBaches() {
  return (
    <PaginaHerramienta
      slug="costo-baches"
      intro="Aunque no te ponches, manejar seguido por calles con baches gasta más gasolina, llantas y suspensión. Dinos cuánto manejas y cómo están tus calles."
      llamado={{
        titulo: "Que se vea cuánto nos cuestan",
        texto: "Cada bache marcado en el mapa suma a los datos públicos de Cajeme. Márcalo en un minuto, con foto y sin dar tu nombre.",
        boton: "Marcar un bache",
      }}
      preguntas={[
        {
          p: "¿Cómo se calcula?",
          r: "Con una versión simplificada del modelo HDM-4 del Banco Mundial. A cada estado de la calle le corresponde un índice de rugosidad (IRI): con algunos baches, unos 4 m/km; malas, unos 6; muy malas, unos 8. Por encima de una calle en buen estado (IRI 2), el gasto en gasolina, llantas y reparaciones sube con el IRI.",
        },
        {
          p: "¿Por qué da un rango y no una sola cifra?",
          r: "Porque los costos por kilómetro y el efecto de la rugosidad varían según el vehículo y la forma de manejar. La cifra grande es el escenario medio; el rango va del escenario bajo al alto.",
        },
        {
          p: "¿Incluye ponchaduras o un rin doblado?",
          r: "No. Es el desgaste de todos los días. Un golpe fuerte en un bache puede costar más que todo el desgaste del año; si te pasó, lee la guía para reclamar daños.",
        },
        {
          p: "¿De dónde salen los supuestos?",
          r: "Son los mismos de la estimación de impacto económico del proyecto, publicados con sus fuentes en el código (lib/economia.ts). Se ajustarán cuando haya calibración con mediciones de calles de Cajeme.",
        },
      ]}
      guias={["reportar-bache-ciudad-obregon", "reclamar-danos-por-bache"]}
    >
      <CostoBaches />
    </PaginaHerramienta>
  );
}
