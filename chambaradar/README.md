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
- **Alertas por correo:** `netlify/functions/alertas.mts` corre cada hora y manda a cada alerta sus vacantes nuevas (máximo un correo al día por alerta). Necesita Resend (ver pendientes)
- **Pagos:** apagados por ahora. Los planes dicen "Próximamente" hasta que se configuren los enlaces de pago (ver abajo)

## Cómo funciona

```
data/empresas.json ──► lib/recolector.ts ──► Supabase ──► web Next.js
 (~240 empresas)        APIs públicas de 9      funciones de la base     muestra la vista
                        sistemas (Greenhouse,   aplican el muro de pago  previa o todo,
                        Lever, Ashby, Workable,                          según la base
                        SmartRecruiters,
                        Recruitee, BambooHR,
                        Teamtailor, Workday)
```

1. **Recolector** (`lib/recolector.ts`): para cada empresa llama la API pública de su sistema de reclutamiento. Son las mismas APIs que usan las empresas para mostrar vacantes en su sitio, así que no se copian portales.
2. **Normalización** (`lib/normalizar.ts`): detecta país, modalidad, si acepta gente de LATAM, área, nivel, idioma y sueldo. Las que no sirven desde LATAM se descartan.
3. **Muro de pago en la base de datos** (`supabase/01_esquema.sql`): la app solo tiene claves **públicas**. Las tablas no se pueden leer directo; la función `buscar_vacantes()` revisa si quien pregunta pagó y, si no, devuelve las vacantes sin empresa, sin enlace y sin descripción. Escribir (recolector y pagos) requiere la **clave de la app** (`CHAMBARADAR_CLAVE`), guardada en la tabla privada `config_privada`.
4. **Pagos** (`app/api/pago`, `app/api/stripe/webhook`): enlaces de pago de Stripe (tarjeta y OXXO). El webhook verifica la firma de Stripe, reconoce el plan por el monto y llama `registrar_pago()`, que alarga `acceso_hasta` y es idempotente.
5. **Cuentas**: Supabase Auth con enlace mágico al correo (sin contraseña).
6. **Alertas** (`supabase/02_alertas.sql`, `lib/alertas.ts`): cada usuario guarda hasta 10 búsquedas. `alertas_por_enviar()` calcula en la base las vacantes nuevas de cada una (vistas por primera vez después del último correo) aplicando el mismo muro de pago, y la función programada las manda en lotes con Resend. Cada correo trae baja con un clic.

## Ciudad Obregón y Sonora

- `lib/normalizar.ts → detectarZonas()` marca cada vacante con `cajeme` (Cd. Obregón) y/o `sonora`. Distingue Cd. Obregón de la alcaldía Álvaro Obregón (CDMX).
- Filtro **Ciudad** en el listado (`?zona=cajeme` o `?zona=sonora`), opción "En Cd. Obregón" en `/empezar` y la página **`/obregon`** (Cajeme, resto de Sonora y remoto desde Obregón).
- Las vacantes locales de Sonora vienen sobre todo de Workday (BBVA, Citi, Constellation Brands, Grupo Modelo, Grupo Peña Verde, ESAB…). Para agregar otra empresa de Workday, en `data/empresas.json` usa `"ats": "workday"` y `"board": "inquilino|wdN|sitio"`, tomado de su enlace `https://inquilino.wdN.myworkdayjobs.com/sitio`.
- No se copian OCC, Computrabajo ni Indeed: sus términos lo prohíben.

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
3. **Alertas por correo.** Crea una cuenta en [resend.com](https://resend.com), verifica un dominio propio (el correo de alertas debe salir de él) y agrega en Netlify `RESEND_API_KEY` y `CORREO_REMITENTE` (p. ej. `ChambaRadar <alertas@chambaradar.com>`). Ese mismo dominio sirve para el SMTP de Supabase del paso 1.
4. **Legal:** completa `DOMICILIO` en `lib/legal.ts` y que un abogado revise `app/privacidad` y `app/terminos`.
5. Opcional: dominio propio (p. ej. chambaradar.com) en Netlify → Domain management; luego actualiza `NEXT_PUBLIC_SITE_URL` y la configuración de Supabase del paso 1.

## Desplegar cambios (GitHub → Netlify)

Conectar el repositorio (una sola vez, desde el navegador, porque hay que autorizar a Netlify en GitHub):

1. Netlify → proyecto **chambaradar** → **Project configuration → Build & deploy → Continuous deployment → Link repository**.
2. Elige **GitHub**, autoriza la app de Netlify y selecciona `Matix4545/Projects-`.
3. Configura:
   - **Branch to deploy:** `main` (cuando este trabajo esté fusionado en `main`)
   - **Base directory:** `chambaradar`
   - Build command, publish y funciones se leen de `chambaradar/netlify.toml`; no hace falta escribirlos.
4. Guarda. Desde entonces cada push a `main` que toque `chambaradar/` se publica solo; los cambios de la raíz (Reporta Cajeme) no disparan builds aquí.

Los pull requests generan una vista previa (Deploy Preview) con su propio enlace.

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
