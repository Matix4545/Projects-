# Reporta Cajeme

Mapa ciudadano para que los vecinos de **Ciudad Obregón, Sonora (municipio de Cajeme)** reporten problemas de
servicios públicos: **agua**, **baches** y **drenaje**. Es anónimo, está en español y está hecho primero para celular.

> Proyecto ciudadano **sin afiliación al gobierno**. Los datos son percepción de vecinos, no análisis oficiales.

## Qué hace

| Reporte | Cómo se reporta | Qué se ve en el mapa |
|---|---|---|
| 💧 **Agua** | Por colonia: sin agua · baja presión · agua sucia (mal olor, turbia, sedimentos, color extraño) · con agua | Cada colonia se pinta con el estado que más se reportó en 24 h: 🟥 sin agua · 🟧 baja presión · 🟪 sucia · 🟩 con agua · ⬜ sin reportes. En empate gana el más grave. |
| 🕳️ **Bache** | Punto exacto (GPS o tocando el mapa) + tamaño, foto y comentario opcionales | Círculo amarillo (más grande si es más grande; borde rojo si es peligroso) |
| 🚧 **Drenaje** | Punto exacto + tipo (tapado, aguas negras, sin tapa, mal olor) | Círculo café |

- Los vecinos pueden dar **"+1 Yo también lo vi"** a un bache o drenaje.
- Con **3 votos de "Ya lo arreglaron"** el punto se pone gris 7 días y luego desaparece. Los puntos sin actividad en
  60 días se archivan solos.
- Al tocar una colonia se ven los conteos de 24 h y 7 días, la hora del último reporte y los comentarios recientes.
- La barra de abajo muestra "X reportes en las últimas 24 h · Y colonias afectadas".

### Antispam y privacidad

- **Sin nombre, teléfono ni correo.** Solo se guarda un *hash* (huella cifrada irreversible) de la IP y de un ID
  aleatorio del dispositivo, guardado en una cookie.
- **Cloudflare Turnstile** en cada envío: reportes, votos y denuncias.
- **Límites:** 1 reporte de agua por colonia por dispositivo cada 6 horas, y máximo 10 reportes por IP al día.
- **Comentarios y fotos:** en los comentarios se rechazan groserías, teléfonos, correos y enlaces. Comentarios y
  fotos tienen botón "Denunciar": con 3 denuncias se ocultan solos.
- **Votos y denuncias:** 1 por dispositivo **y** 1 por conexión (IP), y máximo 40 al día por IP. Así nadie puede
  marcar un bache como arreglado ni ocultar un comentario solo con borrar sus cookies.
- **Fotos:** se comprimen en el celular a ≤ 1 MB. El servidor las vuelve a codificar, lo que **borra todos los
  metadatos EXIF, incluida la ubicación GPS**.
- **Base de datos:** Row Level Security está activado. El público no puede leer ni escribir tablas, solo llamar
  funciones que devuelven datos agregados. Todos los envíos pasan por el servidor (`/api/...`), que revisa Turnstile y
  los límites antes de guardar.

---

## Estructura del proyecto

```
app/
  page.tsx                  Mapa principal
  acerca/page.tsx           Acerca de + aviso de privacidad
  api/reportes/agua/        POST reporte de agua
  api/reportes/pin/         POST bache o drenaje (con foto)
  api/pins/[id]/voto/       POST "+1" o "ya lo arreglaron"
  api/denuncias/            POST denunciar comentario
components/                 Mapa, flujo de reporte, paneles, barra de resumen, Turnstile
lib/                        Supabase, Turnstile, identidad anónima, filtro de groserías, fotos
supabase/
  01_esquema.sql            Tablas
  02_funciones.sql          Funciones y triggers
  03_seguridad.sql          RLS, permisos y bucket de fotos
  04_datos_prueba.sql       Llena el mapa con reportes falsos
  05_borrar_datos_prueba.sql
  06_zonas_aproximadas.sql  Zonas listas para pegar (si no puedes correr el script)
scripts/importar-zonas.mjs  Descarga colonias de OpenStreetMap y rellena con hexágonos H3
tests/                      Pruebas del filtro de groserías
```

---

## Guía de despliegue paso a paso

Vas a necesitar **4 cuentas gratuitas**: GitHub (ya la tienes), [Supabase](https://supabase.com),
[Vercel](https://vercel.com) y [Cloudflare](https://dash.cloudflare.com/sign-up). También necesitas
**Node.js 22 o más reciente** en tu computadora ([descárgalo aquí](https://nodejs.org), versión "LTS").

> 💡 Ve abriendo un archivo de notas para ir pegando las claves que vas a copiar. **No las compartas con nadie.**

### Paso 1 · Crear la base de datos en Supabase

1. Entra a <https://supabase.com/dashboard> y haz clic en **New project**.
2. Ponle de nombre `reporta-cajeme`. Inventa una contraseña de base de datos y guárdala. En **Region** elige
   **West US (North California)**, que es la más cercana a Sonora. Haz clic en **Create new project** y espera 1 o 2 minutos.
3. En el menú izquierdo abre **SQL Editor** y haz clic en **New query**.
4. Abre el archivo `supabase/01_esquema.sql` de este proyecto, copia **todo** su contenido, pégalo en el editor y
   haz clic en **Run**. Debe decir *Success. No rows returned*.
5. Repite lo mismo, en este orden, con `supabase/02_funciones.sql` y luego con `supabase/03_seguridad.sql`.
6. Ve a **Project Settings → API Keys** (o **Project Settings → API**) y copia:
   - **Project URL** (está en **Project Settings → Data API**), algo como `https://abcdefgh.supabase.co`
     → `NEXT_PUBLIC_SUPABASE_URL`
   - La clave **anon / public** (o la *Publishable key*) → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - La clave **service_role** (o la *Secret key*) → `SUPABASE_SERVICE_ROLE_KEY`. ⚠️ Esta es secreta: da acceso
     total a la base de datos.
7. Para confirmar que se creó el bucket de fotos, abre **Storage** en el menú. Debe aparecer `fotos` marcado como *Public*.

### Paso 2 · Crear el antispam en Cloudflare Turnstile

1. Entra a <https://dash.cloudflare.com>, abre **Turnstile** en el menú izquierdo y haz clic en **Add widget**.
2. Nombre: `Reporta Cajeme`. En **Hostnames** agrega `localhost`. Después agregarás el dominio de Vercel.
3. **Widget Mode:** *Managed*. Haz clic en **Create**.
4. Copia el **Site Key** (→ `NEXT_PUBLIC_TURNSTILE_SITE_KEY`) y el **Secret Key** (→ `TURNSTILE_SECRET_KEY`).

> Para probar en tu computadora también puedes usar las claves de prueba de Cloudflare, que siempre aprueban. Vienen
> en `.env.example`.

### Paso 3 · Probar en tu computadora

Abre una terminal (en Windows: *PowerShell*; en Mac: *Terminal*) y ejecuta:

```bash
git clone https://github.com/matix4545/projects-.git reporta-cajeme
cd reporta-cajeme
npm install
```

Copia el archivo de ejemplo de variables:

```bash
cp .env.example .env.local        # Mac / Linux
copy .env.example .env.local      # Windows
```

Abre `.env.local` con un editor de texto (por ejemplo VS Code o el Bloc de notas) y llena los valores que copiaste.
Para `HASH_SECRET` genera un texto aleatorio con:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Importa las colonias** (descarga OpenStreetMap y las sube a Supabase; tarda 1 o 2 minutos):

```bash
npm run importar-zonas
```

El script te dirá cuántas colonias encontró en OpenStreetMap y cuántos hexágonos usó para cubrir las zonas sin
colonia. También guarda `data/zonas.geojson`; puedes arrastrar ese archivo a <https://geojson.io> para verlo.

> **¿No puedes correr `npm run importar-zonas`?** En Supabase → SQL Editor pega y ejecuta
> `supabase/06_zonas_aproximadas.sql`. Cubre la ciudad con 103 hexágonos ("Sector 1", "Sector 2"…). Más adelante
> puedes cambiarlos por colonias reales con el script.

**Llena el mapa con datos de prueba:** en Supabase → SQL Editor, pega y ejecuta `supabase/04_datos_prueba.sql`.

**Arranca la app:**

```bash
npm run dev
```

Abre <http://localhost:3000>. Deberías ver el mapa con colonias de colores y puntos de baches y drenaje.

> El GPS del navegador solo funciona en `localhost` o con `https`. Para probar desde tu celular, espera al paso 4.

### Paso 4 · Publicar en Vercel

1. Entra a <https://vercel.com/new> e inicia sesión con GitHub.
2. Busca el repositorio `projects-` y haz clic en **Import**.
3. Abre **Environment Variables** y agrega **una por una** las variables de tu `.env.local`: nombre a la izquierda y
   valor a la derecha. Si estabas usando las claves de prueba de Turnstile, cámbialas por las reales.
4. Haz clic en **Deploy**. En 1 o 2 minutos te dará una dirección como `https://reporta-cajeme.vercel.app`.
5. Regresa a Cloudflare → Turnstile → tu widget → **Settings** y agrega ese dominio (`reporta-cajeme.vercel.app`)
   en **Hostnames**.
6. Abre la dirección en tu celular y haz un reporte de prueba.

> Si después cambias una variable en Vercel, ve a **Deployments → ⋯ → Redeploy** para que tome efecto.
> Cada vez que hagas `git push` a la rama principal, Vercel publica la nueva versión automáticamente.

### Paso 5 · Antes de anunciarlo al público ✅

- [ ] En Supabase → SQL Editor ejecuta `supabase/05_borrar_datos_prueba.sql` para borrar los reportes falsos.
- [ ] Revisa en el mapa que las colonias se vean bien. Si alguna falta o está mal, mira "Editar las zonas" abajo.
- [ ] Pon un correo de contacto en `NEXT_PUBLIC_CONTACTO` (aparece en el aviso de privacidad).
- [ ] Confirma que en Vercel estén las claves **reales** de Turnstile, no las de prueba.
- [ ] (Opcional) Conecta un dominio propio en Vercel → Settings → Domains y agrégalo también en Turnstile.

---

## Mantenimiento

### Nombres reales de colonias (sin instalar nada)
Con GitHub Actions se pueden descargar las colonias de OpenStreetMap y subirlas a Supabase desde el navegador:

1. En Supabase → SQL Editor vuelve a correr `supabase/02_funciones.sql` y luego `supabase/03_seguridad.sql`
   (agregan la función que acomoda los reportes existentes; se pueden correr las veces que quieras).
2. En GitHub → tu repositorio → **Settings → Secrets and variables → Actions → New repository secret**, crea:
   - `NEXT_PUBLIC_SUPABASE_URL` → la URL de tu proyecto de Supabase
   - `SUPABASE_SERVICE_ROLE_KEY` → tu clave secreta de Supabase
3. Ve a la pestaña **Actions → Importar colonias → Run workflow**.
4. En 2 o 3 minutos termina. Las colonias con nombre en OpenStreetMap reemplazan a los "Sector N" que cubrían;
   el resto de la ciudad sigue con hexágonos. Los reportes existentes se pasan a la colonia nueva.

### Actualizar la base de datos después de una actualización del código
Cuando se agregan funciones nuevas, vuelve a correr en Supabase → SQL Editor, en este orden:
`01_esquema.sql`, `02_funciones.sql` y `03_seguridad.sql`. Son seguros de repetir: no borran datos.

### Editar las zonas
- Para volver a descargar de OpenStreetMap: `npm run importar-zonas`. Actualiza las zonas existentes y agrega las nuevas.
- Para corregir a mano: abre `data/zonas.geojson` en <https://geojson.io>, edita, guarda y ejecuta
  `npm run importar-zonas -- --desde-archivo`.
- Si OpenStreetMap no responde: `npm run importar-zonas -- --aproximado` cubre la ciudad solo con hexágonos.
- Para mejorar el mapa para todos, puedes dibujar las colonias que faltan directamente en
  <https://www.openstreetmap.org> (etiqueta `place=neighbourhood` + `name=...`) y volver a importar.

### Moderar desde Supabase (SQL Editor)

```sql
-- Ver los comentarios y fotos con más denuncias
select 'agua' as tipo, id, comentario, denuncias, comentario_oculto as oculto from reportes_agua where denuncias > 0
union all
select 'pin', id, comentario, denuncias, comentario_oculto from reportes_pin where denuncias > 0
union all
select 'foto', id, foto_ruta, denuncias_foto, foto_oculta from reportes_pin where denuncias_foto > 0
order by denuncias desc;

-- Volver a mostrar una foto que se ocultó injustamente
update reportes_pin set foto_oculta = false where id = 123;

-- Ocultar un comentario a mano
update reportes_pin set comentario_oculto = true where id = 123;

-- Borrar un reporte (por ejemplo, una foto inapropiada)
delete from reportes_pin where id = 123;
-- (la foto queda en Storage → fotos; búscala por su ruta "foto_ruta" y bórrala ahí también)
```

### Ajustar las reglas
Los límites (10 por IP al día, 6 horas por colonia, 280 caracteres) están en `lib/constantes.ts`. La lista de
groserías está en `lib/groserias.ts`.

> ⚠️ Muchos celulares con datos móviles (Telcel, AT&T…) comparten IP. Si ves vecinos legítimos que topan con el
> límite de 10 al día, súbelo en `LIMITE_DIARIO_IP`.

### Límites de los planes gratuitos
- **Supabase gratis:** 500 MB de base de datos y 1 GB de fotos. El proyecto **se pausa si pasa 7 días sin uso**; se
  reactiva desde el panel.
- **Mapa:** los mosaicos de OpenStreetMap son gratuitos pero piden no usarlos para mucho tráfico. Si la app se
  vuelve popular, crea una cuenta en un proveedor (MapTiler, Stadia Maps…) y pon su URL en `NEXT_PUBLIC_TILES_URL`.

---

## Solución de problemas

| Problema | Solución |
|---|---|
| "No se pudieron cargar los datos" | Revisa `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Revisa que ejecutaste los 3 archivos SQL. Revisa que el proyecto de Supabase no esté pausado. |
| "No pudimos verificar que eres una persona" | El dominio no está en Hostnames de Turnstile, o las claves no coinciden (la *Site key* y la *Secret key* deben ser del mismo widget). |
| El mapa sale todo gris, sin colonias | Falta importar las zonas: `npm run importar-zonas`. |
| `importar-zonas` dice "Faltan NEXT_PUBLIC_SUPABASE_URL…" | Debes crear `.env.local` (paso 3) en la carpeta del proyecto. |
| "Ese punto no está dentro de ninguna colonia registrada" | El punto cae fuera de las zonas importadas. Toca el mapa dentro de la ciudad o agrega esa zona. |
| Error al subir foto | Revisa que exista el bucket `fotos` en Supabase → Storage. Si no está, vuelve a ejecutar `03_seguridad.sql`. |
| El GPS no funciona | El sitio debe abrirse con `https` (Vercel ya lo hace) y hay que darle permiso de ubicación al navegador. También se puede tocar el mapa. |

## Desarrollo

```bash
npm run dev         # servidor de desarrollo
npm run build       # compilación de producción
npm run typecheck   # revisión de tipos de TypeScript
npm test            # pruebas del filtro de groserías
```

Tecnologías: Next.js · React · Leaflet + OpenStreetMap · Supabase (Postgres + PostGIS + Storage) · Cloudflare
Turnstile · Tailwind CSS · Vercel.

## Licencia y créditos

Mapa © colaboradores de [OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL). Polígonos de colonias de
OpenStreetMap; zonas de respaldo con [H3](https://h3geo.org).
