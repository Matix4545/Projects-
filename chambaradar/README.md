# ChambaRadar

Vacantes de México y LATAM que no están en LinkedIn, OCC ni Indeed. Las sacamos todos los días directo de las páginas de empleo de cada empresa, en dos nichos:

- **Empresas de LATAM**: Bitso, Konfío, Clara, Nubank, Kavak, Kueski, Plata, Spin by OXXO, Skydropx, Stone, QuintoAndar, Despegar y más.
- **Remoto en dólares**: empresas extranjeras (Stripe, Canonical, GitLab, Kraken, Supabase…) con puestos abiertos a LATAM. Las que dicen “solo US” se descartan.

Modelo de negocio: la vista previa es gratis (puesto, sueldo, ubicación, modalidad y fecha). Para ver la **empresa**, la **descripción** y el **enlace para aplicar** se paga un plan único con tarjeta u **OXXO**: $49 MXN por 1 semana, $129 MXN por 1 mes o $699 MXN por 1 año.

> Este proyecto vive en la carpeta `chambaradar/` y es independiente de la app de la raíz del repositorio (Reporta Cajeme). Tiene su propio `package.json`, su propio proyecto de Supabase y su propio proyecto en Netlify.

## En producción

- **Sitio:** https://chambaradar.netlify.app (Netlify, proyecto `chambaradar`)
- **Base de datos:** Supabase, proyecto `chambaradar` (us-east-2), independiente del de Reporta Cajeme
- **Recolección:** la función programada `netlify/functions/recolectar.mts` corre cada 30 minutos y revisa un turno de empresas (48 turnos al día), así que todas se revisan cada 24 horas
- **Pagos:** apagados por ahora. Los planes dicen "Próximamente" hasta que se configuren los enlaces de pago (ver abajo)

## Cómo funciona

```
data/empresas.json ──► lib/recolector.ts ──► Supabase ──► web Next.js
 (~220 empresas)        APIs públicas de 8      funciones de la base     muestra la vista
                        sistemas (Greenhouse,   aplican el muro de pago  previa o todo,
                        Lever, Ashby, Workable,                          según la base
                        SmartRecruiters,
                        Recruitee, BambooHR,
                        Teamtailor)
```

1. **Recolector** (`lib/recolector.ts`): para cada empresa llama la API pública de su sistema de reclutamiento. Son las mismas APIs que usan las empresas para mostrar vacantes en su sitio, así que no se copian portales.
2. **Normalización** (`lib/normalizar.ts`): detecta país, modalidad, si acepta gente de LATAM, área, nivel, idioma y sueldo. Las que no sirven desde LATAM se descartan.
3. **Muro de pago en la base de datos** (`supabase/01_esquema.sql`): la app solo tiene claves **públicas**. Las tablas no se pueden leer directo; la función `buscar_vacantes()` revisa si quien pregunta pagó y, si no, devuelve las vacantes sin empresa, sin enlace y sin descripción. Escribir (recolector y pagos) requiere la **clave de la app** (`CHAMBARADAR_CLAVE`), guardada en la tabla privada `config_privada`.
4. **Pagos** (`app/api/pago`, `app/api/stripe/webhook`): enlaces de pago de Stripe (tarjeta y OXXO). El webhook verifica la firma de Stripe, reconoce el plan por el monto y llama `registrar_pago()`, que alarga `acceso_hasta` y es idempotente.
5. **Cuentas**: Supabase Auth con enlace mágico al correo (sin contraseña).

## Probarlo en tu computadora

Sin configurar nada (usa `data/vacantes.json`):

```bash
cd chambaradar
npm install
npm run recolectar
npm run dev
```

Con `.env.local` (ver `.env.example`) se conecta a Supabase y `npm run recolectar` guarda ahí. Para ver la versión "pagada" en modo local usa `DEMO_ACCESO_TOTAL=1` (se ignora en producción).

```bash
npm test
npm run typecheck
```

## Pendientes para terminar de publicar

1. **Login (obligatorio para que funcione el enlace del correo).** En Supabase → proyecto `chambaradar` → **Authentication → URL Configuration**:
   - *Site URL*: `https://chambaradar.netlify.app`
   - *Redirect URLs*: agrega `https://chambaradar.netlify.app/**`

   Recomendado: en **Authentication → Emails → SMTP Settings** conecta un proveedor de correo (Resend, Postmark…). El correo incluido de Supabase manda muy pocos correos por hora.
2. **Pagos (cuando tengas tu cuenta de Stripe para ChambaRadar).**
   1. Crea 3 enlaces de pago (Payment Links) en MXN de $49, $129 y $699 con tarjeta y OXXO.
   2. Crea un webhook hacia `https://chambaradar.netlify.app/api/stripe/webhook` con los eventos `checkout.session.completed` y `checkout.session.async_payment_succeeded`.
   3. En Netlify → Environment variables agrega `STRIPE_ENLACE_SEMANA`, `STRIPE_ENLACE_MES`, `STRIPE_ENLACE_ANIO` y `STRIPE_WEBHOOK_SECRET`, y vuelve a desplegar.
3. **Legal:** completa `DOMICILIO` en `lib/legal.ts` y que un abogado revise `app/privacidad` y `app/terminos`.
4. Opcional: dominio propio (p. ej. chambaradar.com) en Netlify → Domain management; luego actualiza `NEXT_PUBLIC_SITE_URL` y la configuración de Supabase del paso 1.

## Desplegar cambios

El sitio de Netlify no está conectado a GitHub; se despliega subiendo esta carpeta (`chambaradar/`), que se construye en Netlify. Para que se despliegue solo con cada push: Netlify → Project configuration → Build & deploy → Link repository, con **Base directory** = `chambaradar`.

## Agregar empresas

**Rápido:** agrega líneas a `data/candidatas.txt` (`Nombre | tipo | slug1, slug2`) y corre:

```bash
npm run descubrir              # solo muestra qué encontró
npm run descubrir -- --guardar # además las agrega a data/empresas.json
```

Prueba cada slug en Greenhouse, Lever, Ashby, Recruitee, SmartRecruiters, BambooHR y Teamtailor (y Workable con `--workable`).

**A mano:** agrega una línea a `data/empresas.json`:

```json
{ "slug": "miempresa", "nombre": "Mi Empresa", "ats": "greenhouse", "board": "miempresa", "tipo": "local" }
```

- `ats`: `greenhouse`, `lever`, `ashby`, `workable`, `smartrecruiters`, `recruitee`, `bamboohr` o `teamtailor`.
- `tipo`: `local` (empresa de LATAM) o `remoto` (extranjera que contrata desde LATAM).
- `remotoGlobal: true` solo si contrata en cualquier país (así "Remote" a secas cuenta como LATAM).

Prueba una sola con `npm run recolectar -- miempresa`.

## Ideas siguientes

Alertas por correo de vacantes nuevas, favoritos, Mercado Pago, más fuentes (Personio, Breezy, Workday), y más empresas mexicanas.
