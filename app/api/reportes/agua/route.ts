import { after } from "next/server";
import { z } from "zod";
import { DETALLES_SUCIA, ESTADOS_AGUA, HORAS_ENTRE_REPORTES_AGUA, LIMITE_DIARIO_IP, MAX_COMENTARIO, dentroDeCajeme } from "@/lib/constantes";
import { avisarSiHayHito } from "@/lib/notificaciones";
import { limpiarComentario, revisarComentario } from "@/lib/groserias";
import { obtenerIdentidad } from "@/lib/identidad";
import { error, ok } from "@/lib/respuestas";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { verificarTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";

const Esquema = z.object({
  estado: z.enum(ESTADOS_AGUA),
  detalles: z.array(z.enum(DETALLES_SUCIA)).max(4).default([]),
  comentario: z.string().max(MAX_COMENTARIO * 2).optional().nullable(),
  lat: z.number().finite(),
  lng: z.number().finite(),
  token: z.string(),
});

export async function POST(req: Request) {
  let cuerpo: z.infer<typeof Esquema>;
  try {
    cuerpo = Esquema.parse(await req.json());
  } catch {
    return error("Datos del reporte incompletos o inválidos.");
  }

  if (!dentroDeCajeme(cuerpo.lat, cuerpo.lng)) {
    return error("La ubicación está fuera de Cajeme.");
  }

  const comentario = limpiarComentario(cuerpo.comentario);
  if (comentario && comentario.length > MAX_COMENTARIO) return error(`El comentario debe tener máximo ${MAX_COMENTARIO} caracteres.`);
  const problema = revisarComentario(comentario);
  if (problema) return error(problema);

  const { ip, dispositivoHash, ipHash } = await obtenerIdentidad();
  if (!(await verificarTurnstile(cuerpo.token, ip))) {
    return error("No pudimos verificar que eres una persona. Intenta de nuevo.", 403);
  }

  const db = supabaseServidor();

  // ¿En qué colonia cae el punto?
  const { data: zona, error: errZona } = await db.rpc("zona_de_punto", { p_lng: cuerpo.lng, p_lat: cuerpo.lat });
  if (errZona) return error("Error al buscar la colonia. Intenta más tarde.", 500);
  if (!zona) return error("Ese punto no está dentro de ninguna colonia registrada.");

  // Límite: 1 reporte de agua por colonia por dispositivo cada 6 horas
  const desde = new Date(Date.now() - HORAS_ENTRE_REPORTES_AGUA * 3600_000).toISOString();
  const { count, error: errCuenta } = await db
    .from("reportes_agua")
    .select("id", { count: "exact", head: true })
    .eq("dispositivo_hash", dispositivoHash)
    .eq("zona_id", zona.id)
    .gte("creado_en", desde);
  if (errCuenta) return error("Error al guardar. Intenta más tarde.", 500);
  if ((count ?? 0) > 0) {
    return error(`Ya reportaste el agua de ${zona.nombre}. Puedes volver a reportar en ${HORAS_ENTRE_REPORTES_AGUA} horas.`, 429);
  }

  // Límite: máximo 10 reportes por IP al día
  const { data: hayCupo, error: errCupo } = await db.rpc("consumir_cupo_ip", { p_ip_hash: ipHash, p_max: LIMITE_DIARIO_IP });
  if (errCupo) return error("Error al guardar. Intenta más tarde.", 500);
  if (!hayCupo) return error("Llegaste al límite de reportes de hoy. Gracias por participar; vuelve mañana.", 429);

  const { error: errInsert } = await db.from("reportes_agua").insert({
    zona_id: zona.id,
    estado: cuerpo.estado,
    detalles_sucia: cuerpo.estado === "sucia" ? [...new Set(cuerpo.detalles)] : [],
    comentario,
    dispositivo_hash: dispositivoHash,
    ip_hash: ipHash,
  });
  if (errInsert) {
    console.error(errInsert);
    return error("Error al guardar. Intenta más tarde.", 500);
  }

  // El aviso se manda después de responder, para no hacer esperar a quien reporta
  after(() => avisarSiHayHito(db));
  return ok({ zona });
}
