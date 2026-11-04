// Imagen para compartir (app/opengraph-image.tsx). Las páginas que definen su
// propio openGraph tienen que repetirla: Next no la hereda en ese caso.
const ALT = "ChambaRadar · Vacantes que no están en OCC ni LinkedIn";
export const IMAGEN_OG = [{ url: "/opengraph-image", width: 1200, height: 630, alt: ALT, type: "image/png" }];
export const IMAGEN_X = [{ url: "/twitter-image", width: 1200, height: 630, alt: ALT }];
