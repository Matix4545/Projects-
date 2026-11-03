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

Estado (modo de prueba, sandbox "ChambaRadar"):
- Productos, precios y Payment Links de 49 / 129 / 699 MXN con tarjeta y OXXO, ya creados. Están en Netlify como `STRIPE_ENLACE_SEMANA`, `STRIPE_ENLACE_MES` y `STRIPE_ENLACE_ANIO` (enlaces `buy.stripe.com/test_…`).
- Webhook `we_1UXVjNQHirVT2PS40AemWi3H` hacia `/api/stripe/webhook` con `checkout.session.completed` y `checkout.session.async_payment_succeeded`.
- Falta: copiar su *Signing secret* (`whsec_…`) a Netlify como `STRIPE_WEBHOOK_SECRET` y volver a desplegar. `STRIPE_SECRET_KEY` no hace falta: el webhook solo verifica firmas.

Para cobrar de verdad:
1. Activar la cuenta en modo real (datos fiscales y CLABE) y activar OXXO.
2. Repetir en modo real: los 3 Payment Links (después del pago, redirigir a `https://chambaradar.com/cuenta?pago=ok`) y el webhook hacia `https://chambaradar.com/api/stripe/webhook`.
3. Cambiar en Netlify los 3 enlaces y `STRIPE_WEBHOOK_SECRET` por los de modo real, y desplegar.
4. Encender el muro en Supabase: `update config_privada set valor = 'si' where nombre = 'muro_activo';`

## 5. Opcionales

- **Correos de alertas:** cuenta en resend.com con un dominio propio → variables `RESEND_API_KEY` y `CORREO_REMITENTE` en Netlify.
- **Despliegue automático:** Netlify → proyecto chambaradar → Link repository → GitHub `Matix4545/Projects-`, rama `main`, base directory `chambaradar`.
- **Legal:** ciudad y estado en `lib/legal.ts` (`DOMICILIO`).
- **Difusión:** compartir `https://chambaradar.com` en los grupos de empleo de Obregón en Facebook.

## Qué incluye

- 10 vacantes en Cd. Obregón, 54 en Sonora y ~610 de home office abiertas a México (se actualiza cada 30 minutos).
- Primero lo de Obregón; filtro "¿Dónde?" (Obregón / Sonora / home office).
- Alertas por correo, "Más vacantes de esta empresa" y la portada nueva.
