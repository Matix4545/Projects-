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
- Site URL: `https://chambaradar.netlify.app`
- Redirect URLs: `https://chambaradar.netlify.app/**`

## 4. Cobro (gratis para quien está en Sonora, de pago para el resto)

El sitio es para todo México y LATAM. Quien entra desde Sonora (según su IP; Netlify lo manda en el encabezado `x-nf-geo`) ve todo completo gratis: el servidor le pasa a Supabase la clave privada de la app en el encabezado `x-chambaradar-local` y `tiene_acceso()` la revisa (`supabase/07_gratis_obregon.sql`, ya aplicado). Las vacantes que publican los negocios siempre se ven completas. Se usa el estado y no la ciudad porque muchos celulares de Obregón aparecen como de otra ciudad de Sonora.

Para empezar a cobrar:
1. Cuenta de Stripe para ChambaRadar (no la de Nexio), con OXXO activado.
2. Tres Payment Links en MXN: 49 (1 semana), 129 (1 mes), 699 (1 año). Después del pago, redirigir a `https://chambaradar.com/cuenta?pago=ok`.
3. En Netlify: `STRIPE_ENLACE_SEMANA`, `STRIPE_ENLACE_MES`, `STRIPE_ENLACE_ANIO`, `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET`; webhook hacia `/api/stripe/webhook` con `checkout.session.completed` y `checkout.session.async_payment_succeeded`.
4. Encender el muro en Supabase: `update config_privada set valor = 'si' where nombre = 'muro_activo';`

## 5. Opcionales

- **Correos de alertas:** cuenta en resend.com con un dominio propio → variables `RESEND_API_KEY` y `CORREO_REMITENTE` en Netlify.
- **Despliegue automático:** Netlify → proyecto chambaradar → Link repository → GitHub `Matix4545/Projects-`, rama `main`, base directory `chambaradar`.
- **Legal:** ciudad y estado en `lib/legal.ts` (`DOMICILIO`).
- **Difusión:** compartir `https://chambaradar.netlify.app` en los grupos de empleo de Obregón en Facebook.

## Qué incluye

- 10 vacantes en Cd. Obregón, 54 en Sonora y ~610 de home office abiertas a México (se actualiza cada 30 minutos).
- Primero lo de Obregón; filtro "¿Dónde?" (Obregón / Sonora / home office).
- Alertas por correo, "Más vacantes de esta empresa" y la portada nueva.
