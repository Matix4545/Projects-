# ChambaRadar

Vacantes de México y LATAM que no están en LinkedIn, OCC ni Indeed. Las sacamos todos los días directo de las páginas de empleo de cada empresa, en dos nichos:

- **Empresas de LATAM**: Clara, Nubank, Kavak, Kueski, Addi, Platzi, QuintoAndar, Despegar, VTEX y más.
- **Remoto en dólares**: empresas extranjeras (Stripe, Canonical, GitLab, Kraken, Supabase…) con puestos abiertos a LATAM. Las que dicen “solo US” se descartan.

Modelo de negocio: la vista previa es gratis (puesto, sueldo, ubicación, modalidad y fecha). Para ver la **empresa**, la **descripción** y el **enlace para aplicar** se paga un plan único con tarjeta u **OXXO**: $49 MXN por 1 semana, $129 MXN por 1 mes o $699 MXN por 1 año.

> Este proyecto vive en la carpeta `chambaradar/` y es independiente de la app de la raíz del repositorio (Reporta Cajeme). Tiene su propio `package.json`, su propio proyecto de Supabase y su propio proyecto en Vercel.

## Cómo funciona

```
data/empresas.json ──► scripts/recolectar.ts ──► Supabase (tabla vacantes) ──► web Next.js
   (qué empresas)        lee APIs públicas de        (o data/vacantes.json         oculta la empresa a
                         Greenhouse, Lever,           en modo local)               quien no ha pagado
                         Ashby y Workable
```

1. **Recolector** (`scripts/recolectar.ts`): para cada empresa llama la API pública de su sistema de reclutamiento. Son las mismas APIs que usan las empresas para mostrar vacantes en su sitio, así que no se copian portales ni se "scrapea" HTML.
2. **Normalización** (`lib/normalizar.ts`): detecta país, modalidad (remoto, híbrido o presencial), si acepta gente de LATAM, área, nivel, idioma y sueldo (solo de campos estructurados, nunca de texto libre). Las vacantes que no sirven desde LATAM se descartan.
3. **Muro de pago** (`lib/muro.ts`): sin acceso, el servidor manda el nombre de la empresa y la descripción **revueltos**, sin enlace, y quita el nombre de la empresa de títulos e ids. Nada real llega al navegador. Además, la búsqueda por empresa solo funciona con acceso.
4. **Pagos** (`app/api/pago`, `app/api/stripe/webhook`): Stripe Checkout en MXN. El webhook llama `registrar_pago()` en Supabase, que alarga `acceso_hasta` y es idempotente (si Stripe repite el evento, no se cobra dos veces el acceso).
5. **Cuentas**: Supabase Auth con enlace mágico al correo (sin contraseña).

## Probarlo en tu computadora (sin configurar nada)

```bash
cd chambaradar
npm install
npm run recolectar     # descarga ~1,100 vacantes a data/vacantes.json
npm run dev            # http://localhost:3000
```

Para ver la versión "pagada" en local, crea `.env.local` con `DEMO_ACCESO_TOTAL=1` (se ignora en producción).

Pruebas y revisión de tipos:

```bash
npm test
npm run typecheck
```

## Ponerlo en producción

### 1. Supabase (proyecto NUEVO, no el de Reporta Cajeme)
1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En **SQL Editor** pega y corre `supabase/01_esquema.sql`.
3. En **Authentication → URL Configuration** pon tu dominio en *Site URL* y agrega `https://TU-DOMINIO/auth/confirmar` en *Redirect URLs*.
4. Opcional pero recomendado: en **Authentication → Emails → SMTP** configura un proveedor de correo (Resend, Postmark…). El correo incluido de Supabase tiene límites muy bajos.

### 2. Stripe
1. Activa tu cuenta en México y, en **Settings → Payment methods**, activa **OXXO**.
2. En **Developers → Webhooks** crea un endpoint `https://TU-DOMINIO/api/stripe/webhook` con los eventos `checkout.session.completed` y `checkout.session.async_payment_succeeded`.

### 3. Vercel
1. **Add New → Project**, importa este repositorio y en **Root Directory** elige `chambaradar`.
2. Captura las variables de `.env.example` (Supabase, Stripe y `NEXT_PUBLIC_SITE_URL`).

### 4. Recolección diaria (GitHub Actions)
El workflow `.github/workflows/chambaradar-recolectar.yml` corre todos los días a las 5:17 a. m. (hora de CDMX). Agrega en GitHub → **Settings → Secrets and variables → Actions**:
- `CHAMBARADAR_SUPABASE_URL`
- `CHAMBARADAR_SUPABASE_SERVICE_ROLE_KEY`

Usan otros nombres para no mezclarse con los secretos de Reporta Cajeme.

## Agregar empresas

Agrega una línea a `data/empresas.json`:

```json
{ "slug": "miempresa", "nombre": "Mi Empresa", "ats": "greenhouse", "board": "miempresa", "tipo": "local" }
```

- `ats`: `greenhouse`, `lever`, `ashby` o `workable`. Se ve en el enlace de su página de empleos (`boards.greenhouse.io/X`, `jobs.lever.co/X`, `jobs.ashbyhq.com/X`, `apply.workable.com/X`). `X` es el `board`.
- `tipo`: `local` (empresa de LATAM) o `remoto` (extranjera que contrata desde LATAM).
- `remotoGlobal: true` solo si la empresa contrata en cualquier país. Así sus vacantes que dicen "Remote" a secas cuentan como LATAM.

Prueba solo esa empresa con `npm run recolectar -- miempresa`.

## Pendiente antes de lanzar

- Completar el **aviso de privacidad** y los **términos** (`app/privacidad`, `app/terminos`, datos entre corchetes) y que los revise un abogado.
- Verificar el dominio y registrar la marca **ChambaRadar** en el IMPI.
- Agregar más empresas, sobre todo mexicanas, a `data/empresas.json`.
- Siguientes ideas: alertas por correo de vacantes nuevas, favoritos, Mercado Pago, más fuentes (SmartRecruiters, Teamtailor, BambooHR).
