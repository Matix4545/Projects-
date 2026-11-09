import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Este proyecto vive en una subcarpeta del repositorio: no usar el package-lock.json de la raíz
  turbopack: { root: import.meta.dirname },
  // Encabezados de seguridad básicos para todas las páginas
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
