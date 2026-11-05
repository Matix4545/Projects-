import { Carta } from "@/components/herramientas/Carta";
import { PaginaHerramienta, metadatosHerramienta } from "@/components/herramientas/PaginaHerramienta";

export const metadata = metadatosHerramienta("carta");

export default function PaginaCarta() {
  return (
    <PaginaHerramienta
      slug="carta"
      intro="Cuando ya reportaste y no pasa nada, un escrito formal obliga a la autoridad a contestarte por escrito. Llena los datos y el escrito se arma solo, listo para imprimir. Nada de lo que escribes sale de tu celular."
      llamado={{
        titulo: "Súmale evidencia pública",
        texto: "Marca el problema en el mapa: queda con fecha, foto y el +1 de otros vecinos. Después pega el enlace en tu escrito.",
        boton: "Marcar el problema en el mapa",
      }}
      preguntas={[
        {
          p: "¿Qué es el derecho de petición?",
          r: "El artículo 8 de la Constitución obliga a los servidores públicos a responder por escrito, en breve término, toda petición que se les haga por escrito, de manera pacífica y respetuosa. Por eso el escrito lleva tu nombre y un domicilio donde te puedan contestar.",
        },
        {
          p: "¿Dónde lo entrego?",
          r: "En la oficialía de partes de la dependencia: OOMAPASC para agua y drenaje; el Ayuntamiento de Cajeme para baches, alumbrado, banquetas y baldíos. Lleva dos copias firmadas y pide que te sellen una con la fecha: ese es tu acuse.",
        },
        {
          p: "¿En cuánto tiempo me deben contestar?",
          r: "La Constitución dice \"breve término\" sin fijar días exactos. Si pasan semanas sin respuesta, puedes insistir con otro escrito citando el acuse del primero, o consultar a un abogado.",
        },
        {
          p: "¿Sirve para reclamar daños a mi carro por un bache?",
          r: "Sí: elige \"Reclamar daños a mi carro\". El escrito cita además el artículo 109 de la Constitución sobre la responsabilidad del Estado. Anexa fotos, la cotización o factura y copias de tu identificación y tarjeta de circulación.",
        },
        {
          p: "¿Guardan mis datos?",
          r: "No. El escrito se arma en tu navegador y no se envía a ningún servidor. Si cierras la página, se borra.",
        },
      ]}
      guias={["reclamar-danos-por-bache", "reportar-bache-ciudad-obregon", "no-hay-agua-en-mi-colonia"]}
    >
      <Carta />
    </PaginaHerramienta>
  );
}
