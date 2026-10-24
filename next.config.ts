import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Encabezados de seguridad básicos para todas las páginas
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), accelerometer=(self), gyroscope=(self), microphone=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          // Sin incrustar el sitio en otras páginas, sin plugins y sin formularios hacia otros dominios
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
