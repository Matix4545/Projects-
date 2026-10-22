const rtf = new Intl.RelativeTimeFormat("es-MX", { numeric: "auto" });

/** "hace 5 minutos", "hace 3 horas", "ayer", "hace 4 días"... */
export function haceCuanto(fechaIso: string | null | undefined): string {
  if (!fechaIso) return "—";
  const segundos = Math.round((new Date(fechaIso).getTime() - Date.now()) / 1000);
  const abs = Math.abs(segundos);
  if (abs < 60) return "hace un momento";
  if (abs < 3600) return rtf.format(Math.round(segundos / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(segundos / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(segundos / 86400), "day");
  // 45 días es "hace 1 mes", no "hace 2 meses"
  return rtf.format(Math.trunc(segundos / (86400 * 30)), "month");
}

export function horaLocal(fechaIso: string | null | undefined): string {
  if (!fechaIso) return "—";
  return new Date(fechaIso).toLocaleString("es-MX", {
    timeZone: "America/Hermosillo",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
