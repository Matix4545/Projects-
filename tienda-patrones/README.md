# Tienda de patrones digitales

Tienda en línea para vender **patrones de costura digitales** (PDF y DXF hechos en AutoCAD) en toda Latinoamérica,
con precios en pesos y formas de pago locales.

- Catálogo con filtros (prenda, nivel, precio, búsqueda) y ficha de cada patrón con tabla de medidas, consumo de tela y mercería.
- **Precio aproximado en la moneda de cada país** (17 países, tipo de cambio del día) aunque cobres en MXN.
- **Licencia personal o emprendedora** (para quien vende lo que cose): lo que casi ninguna tienda internacional ofrece barato.
- Carrito y pago con **Mercado Pago** (tarjeta, OXXO, SPEI, meses) y/o **Stripe** (tarjetas de cualquier país).
- **Descarga inmediata y protegida**: los archivos viven en un almacenamiento privado; cada liga está firmada y vence en 24 h.
  La página de descargas de cada compra se puede volver a abrir siempre, y la liga también llega por correo.
- Patrón **gratis** para atraer clientas, páginas de tabla de medidas, cómo imprimir, preguntas frecuentes y licencias.
- Listo para Google: sitemap, datos de producto (precio) y preguntas frecuentes estructuradas.
- **Herramienta para AutoCAD**: convierte tu PDF a escala 1:1 en hojas Carta y A4 listas para imprimir en casa, conservando las capas por talla.

> Los 8 patrones del catálogo y sus dibujos son **ejemplos** para que veas la tienda funcionando. Cámbialos por los tuyos en
> `lib/catalogo.ts`. El nombre "Trazo" también es provisional: se cambia en `lib/config.ts`.

---

## 1. Probarla en tu computadora

Necesitas Node.js 22 o más nuevo.

```bash
cd tienda-patrones
npm install
npm run dev
```

Abre http://localhost:3000. Sin configurar pagos, el carrito muestra el botón **"Simular pago (modo demo)"** para que
pruebes la compra completa. Los archivos de prueba se leen de la carpeta `archivos-privados/` (no se sube a git):

```
archivos-privados/vestido-amapola/carta.pdf
archivos-privados/vestido-amapola/a4.pdf
...
```

Otros comandos: `npm test` (pruebas), `npm run typecheck`, `npm run build`.

## 2. Agregar o cambiar patrones

Todo está en **`lib/catalogo.ts`**. Cada patrón tiene nombre, tipo, categoría, nivel, precio (MXN; `0` = gratis),
descripción, telas, consumo, mercería y formatos incluidos. El `slug` es la dirección de la página
(`/patrones/vestido-amapola`) y el nombre de la carpeta de sus archivos.

**Fotos**: pon tus fotos en `public/fotos/` y agrégalas al patrón: `fotos: ["/fotos/amapola-1.jpg", "/fotos/amapola-2.jpg"]`.
Mientras no haya fotos se muestra el dibujo plano (`components/DibujoPlano.tsx`).

Nombre de la tienda, WhatsApp, precio de la licencia emprendedora, países y formatos: **`lib/config.ts`**.

## 3. Preparar los archivos desde AutoCAD

Cada patrón se entrega en 6 archivos. Así los sacas de AutoCAD:

1. **Dibuja a escala real en milímetros** (`UNITS` → milímetros) y pon **cada talla en su propia capa**
   (`TALLA-XS`, `TALLA-S`, …) más una capa `INFO` con nombres de piezas, hilo, piquetes y el cuadro de prueba de 5 cm.
2. **PDF plotter** (`plotter.pdf`): `PLOT` → impresora **DWG To PDF.pc3** → tamaño de papel personalizado de **914 mm de
   ancho** (rollo de plotter de 36") por el largo que necesites → escala **1:1** (1 mm = 1 unidad), sin "Ajustar al papel".
   En **Opciones de PDF** activa **"Incluir información de capas"**: así la clienta puede apagar las tallas que no usa.
3. **PDF Carta y A4** (`carta.pdf`, `a4.pdf`): no los armes a mano. Usa el script incluido con el PDF del paso 2:

   ```bash
   npm run mosaico -- plotter.pdf --nombre "Vestido Amapola"
   # crea salida/plotter-carta.pdf y salida/plotter-a4.pdf
   ```

   Hace una portada con instrucciones, cuadro de prueba de 5 cm y mapa de armado; parte el patrón en hojas A1, A2, B1…
   con línea de recorte y rombos de unión, elige vertical u horizontal para gastar menos hojas y **conserva las capas por
   talla**. Opciones: `--papel carta|a4|ambos`, `--margen 12` (mm), `--salida carpeta/`.
4. **PDF proyector** (`proyector.pdf`): igual que el plotter pero con grosor de línea de 0.8 mm y una capa con cuadrícula de 10 cm.
5. **DXF** (`dxf.dxf`): `GUARDARCOMO` → *AutoCAD R2000 DXF* (el más compatible con Audaces, Optitex, Valentina y plotters de corte).
6. **Instructivo** (`instructivo.pdf`): tu paso a paso ilustrado.

La hoja de prueba de impresión gratuita (`public/cuadro-de-prueba.pdf`) se regenera con `npm run cuadro-prueba`.

## 4. Poner la tienda en internet

### a) Supabase (archivos privados y registro de ventas)

1. Crea un proyecto en [supabase.com](https://supabase.com) (sirve la cuenta gratis).
2. En **SQL Editor** pega y ejecuta `supabase/esquema.sql`: crea la tabla `pedidos` y el bucket privado `patrones`.
3. En **Storage → patrones** sube tus archivos con esta estructura: `vestido-amapola/carta.pdf`, `vestido-amapola/a4.pdf`,
   `vestido-amapola/plotter.pdf`, `vestido-amapola/proyector.pdf`, `vestido-amapola/dxf.dxf`, `vestido-amapola/instructivo.pdf`.
4. Copia la URL del proyecto y la **service_role key** (Settings → API) a las variables `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.

### b) Pagos

- **Mercado Pago** (recomendado en México: tarjeta, OXXO, SPEI, meses): en
  [Tus integraciones](https://www.mercadopago.com.mx/developers/panel/app) crea una aplicación de *Checkout Pro* y copia el
  **Access Token de producción** a `MP_ACCESS_TOKEN`. Los avisos de pago llegan solos a `/api/webhooks/mercadopago`.
- **Stripe** (opcional, para tarjetas de otros países): copia la *Secret key* a `STRIPE_SECRET_KEY`. En *Developers → Webhooks*
  agrega `https://tutienda.com/api/webhooks/stripe` con los eventos `checkout.session.completed` y
  `checkout.session.async_payment_succeeded`, y copia el *Signing secret* a `STRIPE_WEBHOOK_SECRET`. En *Settings → Payment
  methods* puedes activar OXXO y en *Adaptive Pricing* que cada cliente vea el total en su moneda.

Con cualquiera de los dos configurado, el modo demo se apaga solo.

### c) Correo de entrega (recomendado)

Crea una cuenta en [resend.com](https://resend.com), verifica tu dominio y pon `RESEND_API_KEY` y `CORREO_REMITENTE`.
Así, quien paga en OXXO o por transferencia recibe su liga de descarga cuando el pago se acredita.

### d) Publicar en Vercel

1. Importa este repositorio en [vercel.com](https://vercel.com) y en **Root Directory** escribe `tienda-patrones`.
2. Agrega las variables de `.env.example` (sobre todo `SECRETO_FIRMA`, que generas con `openssl rand -base64 48`, y
   `NEXT_PUBLIC_SITE_URL` con tu dominio).
3. Conecta tu dominio. Listo.

## 5. Cómo funciona por dentro

```
app/
  page.tsx                    Inicio
  patrones/page.tsx           Catálogo con filtros
  patrones/[slug]/page.tsx    Ficha del patrón
  carrito/page.tsx            Carrito y botones de pago
  gracias/page.tsx            Verifica el pago con Mercado Pago/Stripe y muestra las descargas
  medidas, como-imprimir, preguntas, licencia
  api/checkout                Recalcula precios en el servidor y crea el cobro
  api/descargar               Revisa la liga firmada y entrega el archivo privado
  api/webhooks/*              Avisos de pago → registra el pedido y manda el correo (una sola vez)
lib/
  config.ts  catalogo.ts      Lo que vas a editar
  precios.ts firma.ts         Precios y firmas (con pruebas en tests/)
  pagos/                      Mercado Pago, Stripe y modo demo
scripts/
  mosaico.mjs                 PDF 1:1 de AutoCAD → hojas Carta/A4
  cuadro-prueba.mjs           Hoja de prueba de impresión
```

- Los precios **siempre** se recalculan en el servidor; el navegador no puede cambiarlos.
- El pedido viaja con una referencia **firmada** (`vestido-amapola~e.kimono-brisa~p|firma`): solo se entregan los patrones
  que realmente se pagaron.
- No hay cuentas de usuario: la liga de `/gracias` (que también llega por correo) es el comprobante para volver a descargar.

## 6. Antes de vender: avisos importantes

- **No copies los patrones, fotos, instructivos ni nombres de otras tiendas** (por ejemplo, el "Perth" de Mood Fabrics o
  el "Milana" de Vikisews). Los archivos, instructivos y fotos tienen derechos de autor. Puedes hacer tus propias versiones de
  estilos clásicos (vestido cruzado, palazzo, kimono) trazadas por ti, con tus nombres y tus fotos.
- Los textos de licencia y aviso de privacidad (`app/licencia/page.tsx`) son una base: revísalos con un abogado o contador.
- En México, vender en línea requiere estar dado de alta en el SAT (el RESICO suele convenir para empezar) y poder facturar.
- Revisa las tablas de medidas de `lib/catalogo.ts` contra las de tu propio sistema de tallas: las incluidas son una referencia.
