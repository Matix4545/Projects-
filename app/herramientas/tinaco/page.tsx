import { PaginaHerramienta, metadatosHerramienta } from "@/components/herramientas/PaginaHerramienta";
import { Tinaco } from "@/components/herramientas/Tinaco";

export const metadata = metadatosHerramienta("tinaco");

export default function PaginaTinaco() {
  return (
    <PaginaHerramienta
      slug="tinaco"
      intro="Cuando falta el agua en la colonia, la pregunta es cuánto aguanta lo que tienes guardado. Elige el tamaño de tu tinaco o cisterna, qué tan lleno está y cuántos viven en tu casa."
      llamado={{
        titulo: "¿Tu colonia está sin agua?",
        texto: "Repórtalo en un minuto. Así los vecinos, la prensa y OOMAPASC ven cuántas colonias están igual y desde cuándo.",
        boton: "Reportar el agua de mi colonia",
      }}
      preguntas={[
        {
          p: "¿Cuánta agua usa una persona al día?",
          r: "Depende mucho de la casa y del calor. Como referencia: unos 150 litros al día con un uso normal (regadera, lavadora, trastes), alrededor de 100 cuidando el agua, y unos 50 para lo indispensable: beber, cocinar y aseo básico.",
        },
        {
          p: "¿Cómo hago que me dure más el agua del tinaco?",
          r: "Báñate con cubeta o en regaderazos cortos, junta el agua fría mientras sale la caliente, usa el agua de enjuagar para el excusado, lava trastes en tina y no con la llave abierta, y deja la lavadora para cuando vuelva el agua.",
        },
        {
          p: "¿Cuánto gasta un excusado?",
          r: "Los excusados viejos pueden usar más de 10 litros por descarga; los ahorradores, 6 litros o menos. Durante un corte, echar una cubeta de agua ya usada en la taza ahorra mucho.",
        },
        {
          p: "¿Puedo tomar el agua del tinaco?",
          r: "Solo si el tinaco está tapado y limpio. Para beber es más seguro usar agua purificada o hervirla. Lava y desinfecta el tinaco al menos una vez al año.",
        },
      ]}
      guias={["no-hay-agua-en-mi-colonia", "donde-reportar-problemas-cajeme"]}
    >
      <Tinaco />
    </PaginaHerramienta>
  );
}
