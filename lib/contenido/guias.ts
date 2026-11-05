// Guías para quien YA está buscando cómo resolver un problema ("cómo reportar un bache en Obregón",
// "no hay agua en mi colonia"). Cada guía responde primero en corto (lo que citan Google y las IA),
// da pasos, compara los canales para reportar y termina invitando a reportar en el mapa.
//
// Para agregar una guía: copia una, cambia el slug y el contenido, y queda en /guias, en el sitemap
// y en /llms.txt automáticamente. Ver docs/estrategia-contenido.md.

export type Canal = { canal: string; sirve: string; ventaja: string; limite: string };

export type Guia = {
  slug: string;
  emoji: string;
  /** Título visible (H1) */
  titulo: string;
  /** Título para Google y la pestaña (≤ 65 caracteres de preferencia) */
  tituloSeo: string;
  descripcion: string;
  /** Respuesta corta al inicio: 2 a 4 oraciones que se entienden solas */
  respuesta: string;
  pasos: { titulo: string; texto: string; enlace?: { href: string; texto: string } }[];
  canales?: Canal[];
  preguntas: { p: string; r: string }[];
  llamado: { titulo: string; texto: string; href: string; boton: string };
  herramientas: string[];
  relacionadas: string[];
};

const REPORTA_CAJEME: Canal = {
  canal: "Reporta Cajeme (este mapa)",
  sirve: "Que quede público, con fecha, ubicación y foto, y que se vea cuántos vecinos lo confirman",
  ventaja: "Un minuto, sin registro y anónimo. Cualquiera lo ve: vecinos, prensa y autoridades",
  limite: "No es un canal oficial: ninguna dependencia está obligada a atenderlo",
};

const ESCRITO: Canal = {
  canal: "Escrito de petición (art. 8 constitucional)",
  sirve: "Cuando ya lo reportaste y no pasa nada",
  ventaja: "La autoridad debe contestarte por escrito y te queda un acuse con sello y fecha",
  limite: "Hay que entregarlo en la oficialía de partes con tu nombre y domicilio",
};

const canalOficial = (quien: string): Canal => ({
  canal: `Reporte oficial a ${quien}`,
  sirve: "Que la dependencia lo registre y lo programe",
  ventaja: "Es el canal formal y normalmente te dan un número de folio",
  limite: "No es público: no sabes si otros ya lo reportaron ni cuánto va a tardar",
});

const redes = (quien: string): Canal => ({
  canal: `Comentar en las redes de ${quien}`,
  sirve: "Llamar la atención rápido",
  ventaja: "Es fácil y otros lo ven",
  limite: "Se pierde entre comentarios, no lleva ubicación exacta y no da folio",
});

export const GUIAS: Guia[] = [
  {
    slug: "no-hay-agua-en-mi-colonia",
    emoji: "💧",
    titulo: "No hay agua en mi colonia: qué hacer en Ciudad Obregón",
    tituloSeo: "¿No hay agua en tu colonia? Qué hacer en Ciudad Obregón",
    descripcion:
      "Cómo saber si falta el agua en toda tu colonia, a quién reportarlo en Cajeme (OOMAPASC) y cuántos días te dura el tinaco mientras vuelve.",
    respuesta:
      "Primero revisa si es solo tu casa o toda la colonia: pregunta a un vecino o abre la página de tu colonia en Reporta Cajeme, donde los vecinos marcan si hay agua, baja presión o agua sucia. Si es toda la colonia, repórtalo a OOMAPASC, el organismo municipal del agua en Cajeme, y márcalo en el mapa para que se vea cuántas colonias están igual. Mientras vuelve, calcula cuántos días te alcanza el tinaco y cuida el agua.",
    pasos: [
      {
        titulo: "¿Es solo tu casa o toda la colonia?",
        texto:
          "Revisa la llave de paso, el flotador del tinaco y la bomba, y busca fugas. Si tu vecino sí tiene agua, probablemente es tu instalación o tu toma. Si nadie tiene, es la red.",
        enlace: { href: "/colonias", texto: "Ver el estado del agua por colonia" },
      },
      {
        titulo: "Busca si hay un corte anunciado",
        texto:
          "Revisa los avisos oficiales de OOMAPASC (su sitio y sus redes): ahí se anuncian cortes programados y reparaciones, con las colonias afectadas y la hora estimada de regreso.",
      },
      {
        titulo: "Repórtalo a OOMAPASC y pide folio",
        texto:
          "El teléfono de atención normalmente viene impreso en tu recibo del agua. Ten a la mano tu número de cuenta, di desde cuándo no hay agua y anota el folio que te den.",
      },
      {
        titulo: "Márcalo en el mapa",
        texto:
          "En Reporta Cajeme elige Agua, tu colonia y \"Sin agua\", \"Baja presión\" o \"Agua sucia\". Cuando vuelva, reporta \"Con agua\": la colonia se pinta de verde y los demás saben que ya se restableció.",
        enlace: { href: "/?reportar=1", texto: "Reportar el agua de mi colonia" },
      },
      {
        titulo: "Administra el agua que tienes",
        texto:
          "Calcula cuántos días te alcanza lo que tienes en el tinaco o la cisterna según cuántos viven en tu casa, y prioriza beber, cocinar y el aseo básico.",
        enlace: { href: "/herramientas/tinaco", texto: "Calcular cuánto me dura el tinaco" },
      },
      {
        titulo: "Si sigue igual por días, haz un escrito",
        texto:
          "Un escrito de petición dirigido a OOMAPASC obliga a que te contesten por escrito. Puedes armarlo en 2 minutos, imprimirlo y entregarlo con acuse de recibido.",
        enlace: { href: "/herramientas/carta", texto: "Hacer mi escrito" },
      },
    ],
    canales: [REPORTA_CAJEME, canalOficial("OOMAPASC"), redes("OOMAPASC"), ESCRITO],
    preguntas: [
      {
        p: "¿Quién se encarga del agua en Ciudad Obregón?",
        r: "OOMAPASC, el Organismo Operador Municipal de Agua Potable, Alcantarillado y Saneamiento de Cajeme. El agua potable y el drenaje son servicios públicos municipales según el artículo 115, fracción III, de la Constitución.",
      },
      {
        p: "¿Cómo sé si hay agua hoy en mi colonia?",
        r: "En la página de tu colonia en Reporta Cajeme ves lo que reportaron los vecinos en las últimas 24 horas y 7 días, y el último reporte. Es lo que perciben los vecinos, no un dato oficial de OOMAPASC.",
      },
      {
        p: "¿Qué significan los colores del mapa?",
        r: "Rojo: sin agua. Naranja: baja presión. Morado: agua sucia. Verde: con agua. Gris: sin reportes. Cada colonia toma el estado que más reportaron sus vecinos; si hay empate, gana el más grave.",
      },
      {
        p: "¿Cuánta agua necesito guardar?",
        r: "Para lo indispensable (beber, cocinar y aseo básico) calcula unos 50 litros por persona al día; con un consumo normal, alrededor de 150. La calculadora del tinaco hace la cuenta por ti.",
      },
      {
        p: "El agua sale turbia o huele raro, ¿la puedo usar?",
        r: "Si notas color, olor o sedimentos, no la uses para beber ni cocinar hasta que se aclare. Repórtala a OOMAPASC y márcala como \"agua sucia\" en el mapa indicando qué notas. El mapa refleja lo que notan los vecinos, no un análisis de laboratorio.",
      },
    ],
    llamado: {
      titulo: "¿Tu colonia está sin agua?",
      texto: "Repórtalo en un minuto, sin dar tu nombre. Así se ve cuántas colonias están igual y desde cuándo.",
      href: "/?reportar=1",
      boton: "Reportar el agua de mi colonia",
    },
    herramientas: ["tinaco", "carta"],
    relacionadas: ["drenaje-tapado-aguas-negras", "donde-reportar-problemas-cajeme"],
  },
  {
    slug: "reportar-bache-ciudad-obregon",
    emoji: "🕳️",
    titulo: "Cómo reportar un bache en Ciudad Obregón",
    tituloSeo: "Cómo reportar un bache en Ciudad Obregón (Cajeme)",
    descripcion:
      "A quién le toca arreglar los baches en Cajeme, qué datos dar, cómo dejar constancia pública con foto y qué hacer si no lo reparan.",
    respuesta:
      "Los baches de las calles de la ciudad le tocan al Ayuntamiento de Cajeme, porque las calles son un servicio público municipal. Lo más efectivo es hacer dos cosas: reportarlo por el canal oficial del Ayuntamiento para que exista un folio, y marcarlo con foto en el mapa de Reporta Cajeme para que quede público, con fecha, y otros vecinos puedan confirmarlo. Si está en una carretera federal o estatal, le corresponde a la SICT o al Gobierno de Sonora.",
    pasos: [
      {
        titulo: "Ubícalo con precisión",
        texto:
          "Calle y entre qué calles, o el punto exacto en el mapa. Una referencia ayuda: \"frente a la tienda\", \"en el carril derecho\".",
      },
      {
        titulo: "Toma una foto sin arriesgarte",
        texto:
          "Desde la banqueta, con algo que muestre el tamaño (un zapato, una botella). Evita rostros y placas. Reporta Cajeme borra la ubicación GPS escondida en la foto.",
      },
      {
        titulo: "Márcalo en el mapa",
        texto:
          "Elige Bache, el tamaño (chico, mediano, grande o peligroso) y agrega la foto si quieres. Si ya está marcado, dale \"+1 Yo también lo vi\" en lugar de repetirlo: entre más confirmaciones, más se nota.",
        enlace: { href: "/?reportar=1", texto: "Marcar un bache" },
      },
      {
        titulo: "Repórtalo al Ayuntamiento y pide folio",
        texto:
          "Usa los canales oficiales de atención ciudadana del Ayuntamiento de Cajeme (teléfono, oficinas o sus redes oficiales). Anota el folio: te sirve para dar seguimiento.",
      },
      {
        titulo: "Si no lo reparan, haz un escrito",
        texto:
          "Con el derecho de petición (artículo 8 de la Constitución) la autoridad debe contestarte por escrito. Menciona el folio y el enlace del reporte en el mapa.",
        enlace: { href: "/herramientas/carta", texto: "Hacer mi escrito" },
      },
      {
        titulo: "Cuando lo arreglen, avísale al mapa",
        texto: "Toca el bache y vota \"Ya lo arreglaron\". Con 3 votos se pone gris y después sale del mapa; queda contado como arreglado en los datos.",
      },
    ],
    canales: [REPORTA_CAJEME, canalOficial("el Ayuntamiento de Cajeme"), redes("el Ayuntamiento"), ESCRITO],
    preguntas: [
      {
        p: "¿A quién le corresponde arreglar los baches en Ciudad Obregón?",
        r: "Las calles son un servicio público municipal (artículo 115, fracción III, de la Constitución), así que los baches de las calles de la ciudad le tocan al Ayuntamiento de Cajeme. Las carreteras federales le corresponden a la SICT y las estatales al Gobierno de Sonora.",
      },
      {
        p: "¿Reportar en Reporta Cajeme es lo mismo que reportar al Ayuntamiento?",
        r: "No. Reporta Cajeme es un mapa ciudadano sin afiliación al gobierno: sirve para dejar constancia pública y sumar vecinos, pero el reporte oficial se hace con el Ayuntamiento. Lo ideal es hacer los dos.",
      },
      {
        p: "¿Tengo que dar mi nombre?",
        r: "En Reporta Cajeme no: no pide nombre, teléfono ni correo. En el reporte oficial y en un escrito de petición sí te pedirán tus datos para poder responderte.",
      },
      {
        p: "Un bache me dañó el carro, ¿puedo reclamar?",
        r: "Sí puedes presentar una reclamación al Ayuntamiento. Junta fotos del bache y del daño, la ubicación, la fecha y la cotización o factura de la reparación. Lee la guía \"Un bache dañó mi carro\".",
      },
      {
        p: "¿Cuánto me cuestan los baches aunque no me poncharan una llanta?",
        r: "Manejar seguido por calles en mal estado gasta más gasolina, llantas y suspensión. La calculadora de costo de baches estima cuánto pagas de más al año según cuánto manejas.",
      },
    ],
    llamado: {
      titulo: "¿Viste un bache?",
      texto: "Márcalo en un minuto, con foto y sin dar tu nombre. Si ya está, súmale tu +1.",
      href: "/?reportar=1",
      boton: "Marcar un bache",
    },
    herramientas: ["costo-baches", "carta"],
    relacionadas: ["reclamar-danos-por-bache", "donde-reportar-problemas-cajeme"],
  },
  {
    slug: "reclamar-danos-por-bache",
    emoji: "🚗",
    titulo: "Un bache dañó mi carro: cómo reclamar en Cajeme",
    tituloSeo: "Un bache dañó mi carro en Ciudad Obregón: cómo reclamar",
    descripcion:
      "Qué pruebas juntar, cómo armar y entregar la reclamación al Ayuntamiento de Cajeme por daños de un bache, y qué dice la Constitución.",
    respuesta:
      "Puedes presentar una reclamación por escrito al Ayuntamiento de Cajeme. La Constitución (artículo 109, último párrafo) establece que el Estado responde de forma objetiva y directa por los daños que cause su actividad administrativa irregular, como no reparar ni señalizar un bache. Junta pruebas el mismo día (fotos del bache y del daño, ubicación, fecha y testigos), consigue la cotización o factura, y entrega el escrito en la oficialía de partes del Ayuntamiento conservando tu acuse. Hay plazos para reclamar: no lo dejes pasar.",
    pasos: [
      { titulo: "Ponte a salvo", texto: "Orilla el vehículo donde no estorbes. Si hubo lesionados, llama al 911." },
      {
        titulo: "Documenta en el momento",
        texto:
          "Fotos del bache (con algo que muestre su tamaño y profundidad), de tu vehículo y del lugar con referencias (nombres de calles, negocios). Anota fecha y hora, y pide nombre y teléfono a testigos.",
      },
      {
        titulo: "Deja constancia pública del bache",
        texto:
          "Márcalo en Reporta Cajeme con foto. Queda con fecha, ubicación y las confirmaciones de otros vecinos. Toca el reporte y usa \"Copiar enlace\" para citarlo en tu escrito.",
        enlace: { href: "/?reportar=1", texto: "Marcar el bache" },
      },
      {
        titulo: "Consigue cotización o factura",
        texto: "De la llanta, el rin, la suspensión o la alineación. Pide que diga qué se reparó y por qué.",
      },
      {
        titulo: "Avisa a tu aseguradora",
        texto: "Si tienes seguro, revisa tu póliza: según la cobertura, puede pagar el daño y la aseguradora reclamar después.",
      },
      {
        titulo: "Entrega tu reclamación por escrito",
        texto:
          "Dirigida al Ayuntamiento de Cajeme, en la oficialía de partes (pregunta ahí si debe ir a la Sindicatura Municipal). Anexa copias, no originales, y pide acuse con sello y fecha.",
        enlace: { href: "/herramientas/carta?tipo=danos", texto: "Armar mi reclamación" },
      },
      {
        titulo: "Da seguimiento",
        texto:
          "Guarda el acuse y anota el número de expediente. Si te la niegan o no te contestan, consulta a un abogado sobre los siguientes pasos.",
      },
    ],
    preguntas: [
      {
        p: "¿El Ayuntamiento tiene que pagarme por el daño de un bache?",
        r: "Puede tener que hacerlo si se demuestra que el daño se debió a una actividad administrativa irregular, como no reparar ni señalizar un bache que ya conocía. Cada caso se revisa con sus pruebas; por eso es clave documentar todo el mismo día.",
      },
      {
        p: "¿Qué pruebas necesito?",
        r: "Fotos del bache y del daño, la ubicación exacta, la fecha y hora, datos de testigos, la cotización o factura de la reparación, tu identificación y la tarjeta de circulación del vehículo.",
      },
      {
        p: "¿Cuánto tiempo tengo para reclamar?",
        r: "Las leyes de responsabilidad patrimonial fijan plazos para reclamar. Pregunta el plazo vigente al entregar tu escrito y preséntalo cuanto antes.",
      },
      {
        p: "¿Me sirve el reporte de Reporta Cajeme como prueba?",
        r: "Puede ayudar como evidencia complementaria: muestra que el bache existía, desde cuándo y que otros vecinos lo confirmaron. No sustituye tus fotos, la cotización ni el escrito formal.",
      },
      {
        p: "¿Necesito abogado?",
        r: "No es obligatorio para presentar la reclamación, pero si el monto es alto o te la niegan, conviene que te asesore un abogado. Esta guía es orientativa y no es asesoría legal.",
      },
    ],
    llamado: {
      titulo: "Arma tu reclamación en 2 minutos",
      texto: "Llenas los datos, se arma el escrito y lo imprimes o lo guardas en PDF. No se envía ni se guarda nada.",
      href: "/herramientas/carta?tipo=danos",
      boton: "Armar mi reclamación",
    },
    herramientas: ["carta", "costo-baches"],
    relacionadas: ["reportar-bache-ciudad-obregon", "donde-reportar-problemas-cajeme"],
  },
  {
    slug: "reportar-lampara-fundida-cajeme",
    emoji: "💡",
    titulo: "Cómo reportar una lámpara fundida en Cajeme",
    tituloSeo: "Lámpara fundida o calle a oscuras en Cajeme: cómo reportarla",
    descripcion:
      "El alumbrado público le toca al Ayuntamiento, no a la CFE. Qué datos dar, qué hacer si hay cables caídos y cómo marcar las calles a oscuras.",
    respuesta:
      "El alumbrado público es un servicio del Ayuntamiento de Cajeme (artículo 115 de la Constitución), no de la CFE. Repórtalo al Ayuntamiento con el número del poste si lo tiene, y márcalo en el mapa de Reporta Cajeme para que se vea qué calles están a oscuras. Si hay cables caídos o chispas, aléjate y llama al 911; si son cables de la red eléctrica, también a la CFE al 071.",
    pasos: [
      {
        titulo: "Identifica el poste",
        texto: "Muchos postes tienen un número o una placa. Anótalo junto con la calle y entre qué calles está.",
      },
      {
        titulo: "Di qué le pasa",
        texto: "Apagada o fundida, parpadea, poste dañado o caído, o cables expuestos. Si es de noche, una foto ayuda a mostrar qué tan oscuro está.",
      },
      {
        titulo: "Si hay peligro, primero la seguridad",
        texto: "Con cables caídos, chispas o un poste a punto de caer: no te acerques y llama al 911. Las fallas de la red eléctrica se reportan a la CFE al 071.",
      },
      {
        titulo: "Márcalo en el mapa",
        texto: "Elige Alumbrado y el tipo de falla. Si ves varias lámparas apagadas en la misma calle, márcalas: así se ve el tramo oscuro.",
        enlace: { href: "/?reportar=1", texto: "Marcar una lámpara" },
      },
      {
        titulo: "Repórtalo al Ayuntamiento y pide folio",
        texto: "Por los canales oficiales de atención ciudadana del Ayuntamiento de Cajeme. Da el número de poste y la ubicación.",
      },
      {
        titulo: "Si no lo reparan, haz un escrito",
        texto: "Con el derecho de petición la autoridad debe contestarte por escrito.",
        enlace: { href: "/herramientas/carta", texto: "Hacer mi escrito" },
      },
    ],
    canales: [REPORTA_CAJEME, canalOficial("el Ayuntamiento de Cajeme"), redes("el Ayuntamiento"), ESCRITO],
    preguntas: [
      {
        p: "¿La CFE arregla las lámparas de la calle?",
        r: "No. La CFE vende la energía, pero las lámparas y postes de alumbrado público los mantiene el municipio. La CFE atiende fallas de la red eléctrica, como cables de luz caídos o transformadores, en el 071.",
      },
      {
        p: "¿Por qué vale la pena reportar una sola lámpara?",
        r: "Una calle oscura es más peligrosa para quien camina, maneja o espera el camión. En el mapa se ve cuando varias lámparas de la misma zona están apagadas.",
      },
      {
        p: "¿Qué hago si un poste está a punto de caerse?",
        r: "Aléjate y avisa al 911. Márcalo en el mapa como \"poste dañado o caído\" para que otros vecinos tengan cuidado.",
      },
    ],
    llamado: {
      titulo: "¿Tu calle está a oscuras?",
      texto: "Marca la lámpara en un minuto, sin dar tu nombre.",
      href: "/?reportar=1",
      boton: "Marcar una lámpara",
    },
    herramientas: ["carta"],
    relacionadas: ["donde-reportar-problemas-cajeme", "reportar-bache-ciudad-obregon"],
  },
  {
    slug: "drenaje-tapado-aguas-negras",
    emoji: "🚧",
    titulo: "Drenaje tapado o aguas negras en la calle: cómo reportarlo",
    tituloSeo: "Drenaje tapado o aguas negras en Ciudad Obregón: cómo reportarlo",
    descripcion:
      "A quién reportar el drenaje tapado, las aguas negras o una alcantarilla sin tapa en Cajeme, y cómo protegerte mientras lo atienden.",
    respuesta:
      "El drenaje y el alcantarillado le tocan a OOMAPASC. Repórtalo con ellos, pide folio y márcalo en el mapa de Reporta Cajeme como drenaje tapado, aguas negras, alcantarilla sin tapa o mal olor. Evita el contacto con las aguas negras, y si hay una alcantarilla sin tapa, señálala con algo visible si puedes hacerlo sin riesgo.",
    pasos: [
      {
        titulo: "¿Es tu casa o la calle?",
        texto:
          "Si el agua se regresa solo en tu casa, puede ser tu instalación. Si brota en la calle o afecta a varias casas, es la red de drenaje.",
      },
      {
        titulo: "Evita el contacto",
        texto: "Las aguas negras pueden causar enfermedades del estómago y de la piel. No las pises y mantén lejos a niños y mascotas.",
      },
      {
        titulo: "Márcalo en el mapa",
        texto: "Elige Drenaje y el tipo: tapado, aguas negras en la calle, alcantarilla sin tapa o mal olor. Una alcantarilla sin tapa sale con borde rojo por peligrosa.",
        enlace: { href: "/?reportar=1", texto: "Marcar el drenaje" },
      },
      {
        titulo: "Repórtalo a OOMAPASC y pide folio",
        texto: "El teléfono de atención normalmente viene en tu recibo del agua. Da la ubicación exacta y desde cuándo está así.",
      },
      {
        titulo: "Si sigue igual, haz un escrito",
        texto: "Un escrito de petición a OOMAPASC obliga a que te contesten por escrito.",
        enlace: { href: "/herramientas/carta", texto: "Hacer mi escrito" },
      },
    ],
    canales: [REPORTA_CAJEME, canalOficial("OOMAPASC"), redes("OOMAPASC"), ESCRITO],
    preguntas: [
      {
        p: "¿Quién destapa el drenaje de la calle en Ciudad Obregón?",
        r: "OOMAPASC, el organismo municipal de agua potable, alcantarillado y saneamiento de Cajeme.",
      },
      {
        p: "¿Las aguas negras en la calle son un riesgo?",
        r: "Sí: pueden transmitir enfermedades gastrointestinales y de la piel. Evita pisarlas y mantén lejos a niños y mascotas.",
      },
      {
        p: "¿Por qué se tapa el drenaje?",
        r: "Por basura, grasa de cocina, toallitas y pañales tirados al excusado, raíces o tubería vieja. No tires grasa ni toallitas al drenaje.",
      },
      {
        p: "¿Y si la calle se inunda?",
        r: "Márcala en el mapa como calle cerrada por \"inundada o fuga de agua\" para avisar a los demás que no pasen por ahí.",
      },
    ],
    llamado: {
      titulo: "¿Hay aguas negras en tu calle?",
      texto: "Márcalo en un minuto para que los vecinos sepan y se vea desde cuándo está así.",
      href: "/?reportar=1",
      boton: "Marcar el drenaje",
    },
    herramientas: ["carta"],
    relacionadas: ["no-hay-agua-en-mi-colonia", "donde-reportar-problemas-cajeme"],
  },
  {
    slug: "donde-reportar-problemas-cajeme",
    emoji: "🧭",
    titulo: "¿Dónde reportar problemas de la ciudad en Cajeme?",
    tituloSeo: "Dónde reportar baches, agua, drenaje y alumbrado en Cajeme",
    descripcion:
      "A quién le toca cada problema en Ciudad Obregón (OOMAPASC, Ayuntamiento, CFE, 911) y qué canal conviene: comparación de opciones.",
    respuesta:
      "El agua y el drenaje le tocan a OOMAPASC; los baches, el alumbrado público, las banquetas y los baldíos, al Ayuntamiento de Cajeme; los cables de luz caídos, a la CFE (071); y las emergencias, al 911. Lo que mejor funciona es combinar el reporte oficial, que da un folio, con un reporte público en Reporta Cajeme, que deja constancia con fecha y muestra cuántos vecinos tienen el mismo problema.",
    pasos: [
      { titulo: "Agua: falta, baja presión o agua sucia", texto: "OOMAPASC. El teléfono de atención normalmente viene en tu recibo.", enlace: { href: "/guias/no-hay-agua-en-mi-colonia", texto: "Guía: no hay agua" } },
      { titulo: "Drenaje y alcantarillas", texto: "OOMAPASC.", enlace: { href: "/guias/drenaje-tapado-aguas-negras", texto: "Guía: drenaje tapado" } },
      { titulo: "Baches y calles", texto: "Ayuntamiento de Cajeme. Carreteras federales: SICT; estatales: Gobierno de Sonora.", enlace: { href: "/guias/reportar-bache-ciudad-obregon", texto: "Guía: reportar un bache" } },
      { titulo: "Alumbrado público", texto: "Ayuntamiento de Cajeme (no la CFE).", enlace: { href: "/guias/reportar-lampara-fundida-cajeme", texto: "Guía: lámpara fundida" } },
      { titulo: "Banquetas y baldíos", texto: "Ayuntamiento de Cajeme, que también puede requerir al dueño de un baldío que lo limpie." },
      { titulo: "Cables de luz caídos o falla eléctrica", texto: "CFE, al 071. Si hay riesgo inmediato, al 911." },
      { titulo: "Emergencias", texto: "911: accidentes, incendios, quema de basura fuera de control, personas en riesgo." },
    ],
    canales: [REPORTA_CAJEME, canalOficial("la dependencia"), redes("la dependencia"), ESCRITO],
    preguntas: [
      {
        p: "¿Qué servicios le tocan al municipio?",
        r: "El artículo 115, fracción III, de la Constitución da a los municipios, entre otros: agua potable, drenaje y alcantarillado; alumbrado público; limpia y recolección de basura; y calles, parques y jardines.",
      },
      {
        p: "¿Por qué reportar también en un mapa público?",
        r: "Porque el reporte oficial no es público: nadie más ve cuántos vecinos reportaron lo mismo ni cuánto tarda en resolverse. En el mapa queda con fecha, se suma el +1 de otros vecinos y cualquiera puede consultarlo.",
      },
      {
        p: "¿Reporta Cajeme es del gobierno?",
        r: "No. Es un proyecto ciudadano sin afiliación al Ayuntamiento, OOMAPASC, el Gobierno de Sonora ni ningún partido. Los datos son percepción de vecinos.",
      },
      {
        p: "¿Qué hago si reporté y no pasa nada?",
        r: "Presenta un escrito de petición (artículo 8 de la Constitución): la autoridad debe contestarte por escrito. El generador de escritos lo arma por ti.",
      },
    ],
    llamado: {
      titulo: "Empieza por el mapa",
      texto: "Marca el problema en un minuto y sin registro. Después haz el reporte oficial con el enlace como evidencia.",
      href: "/?reportar=1",
      boton: "Reportar un problema",
    },
    herramientas: ["carta", "tinaco", "costo-baches"],
    relacionadas: ["reportar-bache-ciudad-obregon", "no-hay-agua-en-mi-colonia"],
  },
];

export const guiaPorSlug = (slug: string) => GUIAS.find((g) => g.slug === slug);
