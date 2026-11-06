// Función programada de Netlify: cada 30 minutos dispara la recolección de un
// turno de empresas (48 turnos al día, así en 24 horas se revisan todas).
// Las programadas solo duran unos 30 segundos, así que el trabajo lo hace
// recolectar-background.mts, que puede durar hasta 15 minutos.

const TURNOS = 48;

export default async () => {
  const claveApp = process.env.CHAMBARADAR_CLAVE;
  const sitio = process.env.URL;
  if (!claveApp || !sitio) {
    console.error("Faltan CHAMBARADAR_CLAVE o URL");
    return;
  }
  const ahora = new Date();
  const turno = Math.floor((ahora.getUTCHours() * 60 + ahora.getUTCMinutes()) / 30) % TURNOS;
  const r = await fetch(`${sitio}/.netlify/functions/recolectar-background?turno=${turno}`, {
    method: "POST",
    headers: { "x-chambaradar-clave": claveApp },
  });
  console.log(`Turno ${turno}/${TURNOS} disparado: HTTP ${r.status}`);
};

export const config = { schedule: "*/30 * * * *" };
