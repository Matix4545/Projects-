import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Imagen que sale al compartir chambaradar.com en Facebook, WhatsApp o X (1200×630).
export const alt = "ChambaRadar · Vacantes que no están en OCC ni LinkedIn";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Imagen() {
  const [icono, gruesa] = await Promise.all([
    readFile(join(process.cwd(), "public/icono.svg")),
    readFile(join(process.cwd(), "assets/Inter-ExtraBold.ttf")),
  ]);
  const logo = `data:image/svg+xml;base64,${icono.toString("base64")}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "radial-gradient(circle at 85% 20%, #1e3a8a 0%, #0f172a 55%)",
          color: "#ffffff",
          fontFamily: "Inter",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} width={84} height={84} alt="" />
          <div style={{ display: "flex", fontSize: 46, fontWeight: 800 }}>
            Chamba<span style={{ color: "#60a5fa" }}>Radar</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <div style={{ display: "flex", flexWrap: "wrap", fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>
            Chamba que <span style={{ color: "#60a5fa", margin: "0 18px" }}>no está</span> en OCC ni LinkedIn
          </div>
          <div style={{ display: "flex", fontSize: 34, color: "#cbd5e1" }}>Home office · Empleos en Sonora</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 32, fontWeight: 700, color: "#ffffff", background: "#2563eb", padding: "14px 30px", borderRadius: 999 }}>
            chambaradar.com
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#94a3b8" }}>México y LATAM · actualizado cada día</div>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Inter", data: gruesa, weight: 800, style: "normal" }] },
  );
}
