import { ImageResponse } from "next/og";

// Imagen que aparece al compartir el enlace en WhatsApp, Facebook, X, etc.
export const alt = "Reporta Cajeme: mapa ciudadano de agua, baches y drenaje en Ciudad Obregón";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const COLORES = ["#dc2626", "#f97316", "#7c3aed", "#16a34a", "#dc2626", "#16a34a", "#f97316", "#9ca3af", "#16a34a"];

export default function Imagen() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#1d4ed8", color: "white", padding: 70 }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1 }}>
          <div style={{ fontSize: 34, opacity: 0.85 }}>Ciudad Obregón, Sonora</div>
          <div style={{ fontSize: 96, fontWeight: 800, lineHeight: 1.05, marginTop: 10 }}>Reporta Cajeme</div>
          <div style={{ fontSize: 40, marginTop: 24, lineHeight: 1.3, maxWidth: 640 }}>
            ¿Sin agua? ¿Bache? ¿Drenaje tapado? Repórtalo en el mapa, sin registrarte.
          </div>
          <div style={{ fontSize: 26, marginTop: 30, opacity: 0.8 }}>Proyecto ciudadano · No es del gobierno</div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", width: 330, alignContent: "center", gap: 14 }}>
          {COLORES.map((c, i) => (
            <div key={i} style={{ width: 96, height: 96, borderRadius: 22, background: c, border: "5px solid rgba(255,255,255,0.85)" }} />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
