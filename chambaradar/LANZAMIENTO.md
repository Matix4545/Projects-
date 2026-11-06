# Lanzamiento en Cd. Obregón · lista de pasos

Todo el código está listo en la rama `claude/blissful-shannon-hjgmud`. Falta esto, en orden:

## 1. Base de datos (tú, 2 minutos, desde una computadora)

Elige una:

- **Pegarlo tú:** abre `supabase/lanzamiento_obregon.sql`, copia todo y pégalo en
  Supabase → proyecto **chambaradar** → **SQL Editor** → **Run**.
- **Que lo mande Claude:** escribe "listo" y acepta el aviso de aprobación de Supabase en cuanto aparezca.

El archivo no borra nada: el sitio publicado sigue funcionando mientras tanto.
Al final apaga el muro de pago (todos ven empresa y enlace para aplicar).

## 2. Publicar (Claude, en cuanto esté el paso 1)

1. Volver a recolectar las vacantes (se agregan las zonas Cajeme/Sonora y se cierran las que ya no entran en el enfoque).
2. Desplegar en Netlify y revisar el sitio en escritorio y celular.

## 3. Inicio de sesión (tú, 1 minuto) — necesario para las alertas

Supabase → **Authentication → URL Configuration**:
- Site URL: `https://chambaradar.com`
- Redirect URLs: `https://chambaradar.com/**`

## 4. Cobro (gratis para quien está en Sonora, de pago para el resto)

El sitio es para todo México y LATAM. Quien entra desde Sonora (según su IP; Netlify lo manda en el encabezado `x-nf-geo`) ve todo completo gratis: el servidor le pasa a Supabase la clave privada de la app en el encabezado `x-chambaradar-local` y `tiene_acceso()` la revisa (`supabase/07_gratis_obregon.sql`, ya aplicado). Las vacantes que publican los negocios siempre se ven completas. Se usa el estado y no la ciudad porque muchos celulares de Obregón aparecen como de otra ciudad de Sonora.

Estado: **cobro activo en modo real** (cuenta Stripe "ChambaRadar", `acct_1UXVQR8aIWKf2fFm`, México, MXN).
- Payment Links reales de 49 / 129 / 699 MXN con tarjeta y OXXO; después del pago regresan a `https://chambaradar.com/cuenta?pago=ok`. Están en Netlify como `STRIPE_ENLACE_SEMANA`, `STRIPE_ENLACE_MES` y `STRIPE_ENLACE_ANIO`.
- Webhook real hacia `https://chambaradar.com/api/stripe/webhook` (Snapshot) con `checkout.session.completed` y `checkout.session.async_payment_succeeded`. Su secreto está en Netlify como `STRIPE_WEBHOOK_SECRET`.
- Muro de pago encendido (`muro_activo = 'si'`). Gratis completo: visitantes desde Sonora y vacantes publicadas por negocios.
- Para apagar el cobro: `update config_privada set valor = 'no' where nombre = 'muro_activo';`
- En Netlify no se puede sobrescribir una variable existente desde la herramienta (error 422): se borra y se vuelve a crear.

## 5. Opcionales

- **Correos (listo):** Resend con el dominio chambaradar.com (DNS en Cloudflare). Supabase usa SMTP de Resend (`smtp.resend.com:465`, usuario `resend`, remitente `hola@chambaradar.com`) para el enlace de entrar; Netlify tiene `RESEND_API_KEY` y `CORREO_REMITENTE = ChambaRadar <alertas@chambaradar.com>` para las alertas. Plantillas en español en Supabase → Authentication → Emails → Templates.
- **Píxel de Meta (listo, apagado):** crear el píxel en Meta Events Manager y poner su ID en Netlify como `NEXT_PUBLIC_META_PIXEL_ID`, luego volver a desplegar. Aparece el aviso de cookies; solo con "Aceptar" se carga el píxel. Eventos: PageView, Lead ("Aplicar" con candado), InitiateCheckout ("Pagar", con el precio) y Purchase (regreso de Stripe).
- **Anuncios:** usar enlaces con `?utm_source=facebook&utm_campaign=nombre`; se ven en Panel → Tráfico → Campañas.
- **Despliegue automático:** Netlify → proyecto chambaradar → Link repository → GitHub `Matix4545/Projects-`, rama `main`, base directory `chambaradar`.
- **Legal:** ciudad y estado en `lib/legal.ts` (`DOMICILIO`).
- **Difusión:** compartir `https://chambaradar.com` en los grupos de empleo de Obregón en Facebook.

## Qué incluye

- 10 vacantes en Cd. Obregón, 54 en Sonora y ~610 de home office abiertas a México (se actualiza cada 30 minutos).
- Primero lo de Obregón; filtro "¿Dónde?" (Obregón / Sonora / home office).
- Alertas por correo, "Más vacantes de esta empresa" y la portada nueva.

## Pendiente: "Vacantes para ti" (IA) — activar con el primer cliente que pague
- Qué es: correo diario con las 5 vacantes que mejor le quedan al CV del usuario y botón "Preparar mi aplicación"
  (resumen y experiencia ajustados a la vacante + carta de presentación, en el idioma de la vacante, con enlace para aplicar).
- Incluido en todos los planes. Modelo: Claude Haiku 5.5 (≈ US$0.15 al mes por usuario activo; la IA solo corre cuando abren la vacante).
- Requiere: cuenta en console.anthropic.com con saldo (mín. US$5) y la llave en Netlify como ANTHROPIC_API_KEY (scope Functions y Builds).
- No construir "aplicamos por ti" automático en portales de terceros (Workday, Greenhouse…): viola sus términos y las empresas descartan aplicaciones masivas.


## Landing de anuncios `/remoto-dolares` (nov 2026)

- El anuncio puede seguir apuntando a `/vacantes?donde=remoto`: si trae `utm_source`, redirige a `/remoto-dolares` con los mismos parámetros. Mejor apuntarlo directo a `https://chambaradar.com/remoto-dolares?utm_source=meta&utm_campaign=prueba1`.
- Pendientes de configuración (no son código):
  1. Correr `supabase/20_landing_remoto_dolares.sql` en el SQL Editor (agrupa duplicados, landing, vacante de ejemplo, correos, compra confirmada).
  2. En Stripe, en los 3 Payment Links → "Después del pago" → redirigir a `https://chambaradar.com/cuenta?pago=ok&sesion={CHECKOUT_SESSION_ID}`. Con eso el navegador manda `Purchase` con el pago ya confirmado por el webhook y el mismo id que el servidor.
  3. Netlify: `NEXT_PUBLIC_CLARITY_ID` (Clarity), `META_CAPI_TOKEN` (API de conversiones del píxel), y `NEXT_PUBLIC_GARANTIA_DIAS=7` solo si se decide activar la garantía.
- Garantía de devolución: apagada por defecto. Si se activa, el reembolso se hace a mano en Stripe (Pagos → el pago → Reembolsar; el dinero tarda 5-10 días en regresar a la tarjeta; con OXXO Stripe no reembolsa a la tienda, hay que pedir CLABE y transferir). El acceso se quita poniendo `acceso_hasta = now()` en `perfiles` para ese usuario.
- Boletín "5 vacantes remotas en dólares cada semana": los correos van a `suscriptores`; `netlify/functions/boletin.mts` lo manda los martes 9:00 (Hermosillo) con Resend, completas (empresa y enlace), sin repetir vacantes en 30 días (`supabase/21_boletin_semanal.sql`). Baja en `/boletin/baja?t=…`.
