-- =====================================================================
-- ChambaRadar · Lanzamiento en Cd. Obregón (02 + 03 + 04 en un solo archivo)
--
-- Pégalo completo en Supabase → proyecto chambaradar → SQL Editor → Run.
-- Ya debe estar aplicado 01_esquema.sql (lo está en producción).
-- Se puede correr más de una vez sin romper nada.
--
-- No borra nada: la versión anterior de buscar_vacantes() se queda junto a
-- la nueva, así el sitio publicado sigue funcionando mientras se actualiza.
-- Al final apaga el muro de pago (todos ven empresa y enlace).
-- =====================================================================


-- =====================================================================
-- ChambaRadar · Alertas por correo
-- Correr DESPUÉS de 01_esquema.sql (Supabase → SQL Editor → Run).
-- Se puede correr más de una vez sin romper nada.
--
-- Cada usuario guarda hasta 10 búsquedas. Una vez al día la función
-- programada de Netlify (netlify/functions/alertas.mts) pide a la base las
-- vacantes NUEVAS de cada alerta y manda un correo. La base aplica el mismo
-- muro de pago: a quien no pagó no le da empresa ni enlace.
-- =====================================================================

-- Fecha en que el recolector vio la vacante por primera vez (no cambia al actualizarla)
alter table public.vacantes add column if not exists creada timestamptz not null default now();
create index if not exists vacantes_creada on public.vacantes (creada desc) where activa;

-- guardar_vacantes() debe respetar "creada" de las que ya existían
create or replace function public.guardar_vacantes(p_clave text, p_filas jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  if not clave_valida(p_clave) then raise exception 'clave inválida'; end if;
  insert into vacantes
  select (r).* from (
    select jsonb_populate_record(null::vacantes, f || jsonb_build_object('creada', now())) as r
      from jsonb_array_elements(p_filas) f
  ) x
  on conflict (id) do update set
    empresa_nombre = excluded.empresa_nombre, empresa_tipo = excluded.empresa_tipo, titulo = excluded.titulo,
    url = excluded.url, ubicacion = excluded.ubicacion, paises = excluded.paises, modalidad = excluded.modalidad,
    acepta_latam = excluded.acepta_latam, categoria = excluded.categoria, nivel = excluded.nivel, idioma = excluded.idioma,
    sueldo_min = excluded.sueldo_min, sueldo_max = excluded.sueldo_max, moneda = excluded.moneda, periodo = excluded.periodo,
    descripcion = excluded.descripcion, publicada = excluded.publicada, vista = excluded.vista, activa = true;
    -- "creada" no se toca: así sabemos cuáles son nuevas de verdad
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- Tabla de alertas
-- ---------------------------------------------------------------------
create table if not exists public.alertas (
  id              uuid primary key default gen_random_uuid(),
  usuario         uuid not null references auth.users (id) on delete cascade,
  -- {q, categoria, pais, modalidad, nivel, tipo, conSueldo}
  filtros         jsonb not null default '{}',
  activa          boolean not null default true,
  -- Para darse de baja desde el correo sin iniciar sesión
  token           uuid not null default gen_random_uuid() unique,
  creada          timestamptz not null default now(),
  ultima_envio    timestamptz,   -- las "nuevas" son las creadas después de esto
  ultima_revision timestamptz    -- para revisar cada alerta máximo una vez al día
);
create index if not exists alertas_usuario on public.alertas (usuario);
create index if not exists alertas_revision on public.alertas (ultima_revision nulls first) where activa;

alter table public.alertas enable row level security;

drop policy if exists "cada quien ve sus alertas" on public.alertas;
create policy "cada quien ve sus alertas" on public.alertas
  for select to authenticated using (usuario = auth.uid());

drop policy if exists "cada quien borra sus alertas" on public.alertas;
create policy "cada quien borra sus alertas" on public.alertas
  for delete to authenticated using (usuario = auth.uid());

-- ---------------------------------------------------------------------
-- ¿La vacante cumple los filtros guardados?
-- ---------------------------------------------------------------------
create or replace function public.cumple_filtros(v public.vacantes, f jsonb, acceso boolean)
returns boolean language sql stable set search_path = public as $$
  select v.activa and v.acepta_latam
     and (coalesce(f->>'q', '') = ''
          or v.titulo ilike '%' || (f->>'q') || '%'
          or (acceso and v.empresa_nombre ilike '%' || (f->>'q') || '%'))
     and (coalesce(f->>'categoria', '') = '' or v.categoria = f->>'categoria')
     and (coalesce(f->>'pais', '') = '' or (f->>'pais') = any(v.paises))
     and (coalesce(f->>'modalidad', '') = '' or v.modalidad = f->>'modalidad')
     and (coalesce(f->>'nivel', '') = '' or v.nivel = f->>'nivel')
     and (coalesce(f->>'tipo', '') = '' or v.empresa_tipo = f->>'tipo')
     and (coalesce((f->>'conSueldo')::boolean, false) = false or v.sueldo_max is not null);
$$;
revoke all on function public.cumple_filtros(public.vacantes, jsonb, boolean) from public, anon, authenticated;

-- Deja solo filtros válidos (lo que no se reconoce se descarta)
create or replace function public.limpiar_filtros(f jsonb)
returns jsonb language sql immutable set search_path = public as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'q', nullif(left(trim(coalesce(f->>'q', '')), 80), ''),
    'categoria', nullif(f->>'categoria', ''),
    'pais', nullif(upper(coalesce(f->>'pais', '')), ''),
    'modalidad', case when f->>'modalidad' in ('remoto', 'hibrido', 'presencial') then f->>'modalidad' end,
    'nivel', nullif(f->>'nivel', ''),
    'tipo', case when f->>'tipo' in ('local', 'remoto') then f->>'tipo' end,
    'conSueldo', case when (f->>'conSueldo') = 'true' then true end));
$$;

-- ---------------------------------------------------------------------
-- Para usuarios con sesión: crear una alerta (máximo 10)
-- ---------------------------------------------------------------------
create or replace function public.crear_alerta(p_filtros jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  yo uuid := auth.uid();
  limpios jsonb := limpiar_filtros(coalesce(p_filtros, '{}'));
  nueva uuid;
begin
  if yo is null then raise exception 'inicia sesión para crear alertas'; end if;
  -- Si ya tiene una alerta igual, se reactiva en lugar de duplicarla
  update alertas set activa = true where usuario = yo and filtros = limpios returning id into nueva;
  if nueva is not null then return nueva; end if;
  if (select count(*) from alertas where usuario = yo and activa) >= 10 then
    raise exception 'máximo 10 alertas por cuenta';
  end if;
  insert into alertas (usuario, filtros) values (yo, limpios) returning id into nueva;
  return nueva;
end $$;
revoke all on function public.crear_alerta(jsonb) from public, anon;
grant execute on function public.crear_alerta(jsonb) to authenticated;

-- Darse de baja desde el enlace del correo (el token es secreto y único)
create or replace function public.baja_alerta(p_token uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update alertas set activa = false where token = p_token and activa;
  return found;
end $$;
grant execute on function public.baja_alerta(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Para la función programada (con la clave de la app)
-- ---------------------------------------------------------------------

-- Devuelve las alertas que tienen vacantes nuevas, con el correo del usuario
-- y hasta 15 vacantes cada una (bloqueadas si el usuario no pagó).
-- Marca como revisadas todas las que procesa para no repetirlas en 20 horas.
create or replace function public.alertas_por_enviar(p_clave text, p_limite int default 100)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  sal text := (select valor from config_privada where nombre = 'clave_app');
  resultado jsonb := '[]'::jsonb;
  a record;
  acceso boolean;
  desde timestamptz;
  total int;
  lista jsonb;
begin
  if not clave_valida(p_clave) then raise exception 'clave inválida'; end if;

  for a in
    select al.*, u.email
      from alertas al join auth.users u on u.id = al.usuario
     where al.activa and u.email is not null
       and (al.ultima_revision is null or al.ultima_revision < now() - interval '20 hours')
     order by al.ultima_revision nulls first
     limit least(greatest(coalesce(p_limite, 100), 1), 500)
     for update of al skip locked
  loop
    -- Con el muro apagado todos ven todo; si no, solo quien tiene un plan vigente
    acceso := coalesce((select valor from config_privada where nombre = 'muro_activo'), 'si') = 'no'
              or exists (select 1 from perfiles where id = a.usuario and acceso_hasta > now());
    desde := coalesce(a.ultima_envio, a.creada);

    select count(*), coalesce(jsonb_agg(fila order by creada desc) filter (where n <= 15), '[]'::jsonb)
      into total, lista
      from (
        select v.creada, row_number() over (order by v.creada desc, v.id) as n,
          case when acceso then jsonb_build_object(
              'titulo', v.titulo, 'empresa', v.empresa_nombre, 'url', v.url, 'ubicacion', v.ubicacion,
              'modalidad', v.modalidad, 'sueldo_min', v.sueldo_min, 'sueldo_max', v.sueldo_max,
              'moneda', v.moneda, 'periodo', v.periodo)
          else jsonb_build_object(
              'titulo', tapar_empresa(v.titulo, v.empresa_nombre, v.empresa_slug), 'empresa', null, 'url', null,
              'ubicacion', tapar_empresa(v.ubicacion, v.empresa_nombre, v.empresa_slug),
              'modalidad', v.modalidad, 'sueldo_min', v.sueldo_min, 'sueldo_max', v.sueldo_max,
              'moneda', v.moneda, 'periodo', v.periodo)
          end as fila
          from vacantes v
         where v.creada > desde and cumple_filtros(v, a.filtros, acceso)
      ) x;

    update alertas set ultima_revision = now() where id = a.id;

    if total > 0 then
      resultado := resultado || jsonb_build_array(jsonb_build_object(
        'id', a.id, 'email', a.email, 'token', a.token, 'filtros', a.filtros,
        'acceso', acceso, 'total', total, 'vacantes', lista));
    end if;
  end loop;

  return resultado;
end $$;
revoke all on function public.alertas_por_enviar(text, int) from public;
grant execute on function public.alertas_por_enviar(text, int) to anon, authenticated;

-- Después de mandar los correos: las próximas "nuevas" serán desde este momento
create or replace function public.marcar_alertas_enviadas(p_clave text, p_ids uuid[], p_hasta timestamptz)
returns int language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  if not clave_valida(p_clave) then raise exception 'clave inválida'; end if;
  update alertas set ultima_envio = p_hasta where id = any(p_ids);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.marcar_alertas_enviadas(text, uuid[], timestamptz) from public;
grant execute on function public.marcar_alertas_enviadas(text, uuid[], timestamptz) to anon, authenticated;
-- =====================================================================
-- ChambaRadar · "Más vacantes de esta empresa"
-- Correr DESPUÉS de 02_alertas.sql. Se puede correr más de una vez.
--
-- Desde la tarjeta "Más" se piden las otras vacantes de la misma empresa.
-- Sin acceso pagado, la vacante llega con un id opaco y la respuesta
-- tampoco revela la empresa: solo puestos, sueldos y ubicaciones.
-- =====================================================================

-- La misma vacante en JSON, bloqueada o no (igual que buscar_vacantes)
create or replace function public.vacante_json(r public.vacantes, acceso boolean, sal text)
returns jsonb language sql stable set search_path = public as $$
  select case when acceso then to_jsonb(r) - 'creada' || jsonb_build_object('bloqueada', false)
  else jsonb_build_object(
    'id', 'v' || left(md5(r.id || sal), 16),
    'empresa_slug', null, 'empresa_nombre', null, 'empresa_tipo', r.empresa_tipo,
    'titulo', tapar_empresa(r.titulo, r.empresa_nombre, r.empresa_slug),
    'url', null,
    'ubicacion', tapar_empresa(r.ubicacion, r.empresa_nombre, r.empresa_slug),
    'paises', r.paises, 'modalidad', r.modalidad, 'acepta_latam', r.acepta_latam,
    'categoria', r.categoria, 'nivel', r.nivel, 'idioma', r.idioma,
    'sueldo_min', r.sueldo_min, 'sueldo_max', r.sueldo_max, 'moneda', r.moneda, 'periodo', r.periodo,
    'descripcion', null, 'largo_descripcion', length(r.descripcion),
    'publicada', r.publicada, 'vista', r.vista, 'bloqueada', true)
  end;
$$;
revoke all on function public.vacante_json(public.vacantes, boolean, text) from public, anon, authenticated;

create or replace function public.otras_de_empresa(p_id text, p_limite int default 10)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  acceso boolean := tiene_acceso();
  sal text := (select valor from config_privada where nombre = 'clave_app');
  base vacantes;
  total int;
  lista jsonb;
begin
  if acceso then
    select * into base from vacantes where id = p_id;
  else
    -- El id público es un resumen que no se puede revertir
    select * into base from vacantes where activa and 'v' || left(md5(id || sal), 16) = p_id;
  end if;
  if base.id is null then return jsonb_build_object('total', 0, 'vacantes', '[]'::jsonb); end if;

  select count(*) into total from vacantes
   where activa and acepta_latam and empresa_slug = base.empresa_slug and id <> base.id;

  select coalesce(jsonb_agg(vacante_json(x.fila, acceso, sal) order by x.publicada desc), '[]'::jsonb) into lista
    from (select v as fila, v.publicada from vacantes v
           where v.activa and v.acepta_latam and v.empresa_slug = base.empresa_slug and v.id <> base.id
           order by v.publicada desc
           limit least(greatest(coalesce(p_limite, 10), 1), 20)) x;

  return jsonb_build_object('total', total, 'vacantes', lista);
end $$;
grant execute on function public.otras_de_empresa(text, int) to anon, authenticated;
-- =====================================================================
-- ChambaRadar · Zonas locales (Cd. Obregón / Cajeme y Sonora)
-- Correr DESPUÉS de 03_relacionadas.sql. Se puede correr más de una vez.
-- =====================================================================

alter table public.vacantes add column if not exists zonas text[] not null default '{}';
create index if not exists vacantes_zonas on public.vacantes using gin (zonas);

-- Búsqueda nueva con zona y orden por cercanía. Se llama distinto que
-- buscar_vacantes() para no romper el sitio publicado mientras se actualiza
-- (con el mismo nombre, Postgres no sabría cuál usar).
create or replace function public.buscar_empleos(
  p_q text default '', p_categoria text default '', p_pais text default '', p_modalidad text default '',
  p_nivel text default '', p_tipo text default '', p_con_sueldo boolean default false, p_dias int default 0,
  p_pagina int default 1, p_por_pagina int default 20, p_zona text default ''
) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  acceso boolean := tiene_acceso();
  q text := nullif(trim(coalesce(p_q, '')), '');
  por_pagina int := least(greatest(coalesce(p_por_pagina, 20), 1), 50);
  desde int := (least(greatest(coalesce(p_pagina, 1), 1), 500) - 1) * por_pagina;
  sal text := (select valor from config_privada where nombre = 'clave_app');
  total int;
  filas jsonb;
begin
  -- "fila" es la vacante completa (tipo vacantes), para pasarla a vacante_json()
  with f as (
    select v as fila, v.zonas, v.publicada, v.id from vacantes v
     where v.activa and v.acepta_latam
       and (q is null or v.titulo ilike '%' || q || '%' or (acceso and v.empresa_nombre ilike '%' || q || '%'))
       and (coalesce(p_categoria, '') = '' or v.categoria = p_categoria)
       and (coalesce(p_pais, '') = '' or p_pais = any(v.paises))
       and (coalesce(p_modalidad, '') = '' or v.modalidad = p_modalidad)
       and (coalesce(p_nivel, '') = '' or v.nivel = p_nivel)
       and (coalesce(p_tipo, '') = '' or v.empresa_tipo = p_tipo)
       and (not coalesce(p_con_sueldo, false) or v.sueldo_max is not null)
       and (coalesce(p_dias, 0) = 0 or v.publicada >= now() - make_interval(days => p_dias))
       and (coalesce(p_zona, '') = '' or p_zona = any(v.zonas))
  ),
  -- Primero lo de Cd. Obregón, luego el resto de Sonora, luego lo demás (remoto); dentro, lo más nuevo
  pagina as (
    select * from f
     order by ('cajeme' = any(zonas)) desc, ('sonora' = any(zonas)) desc, publicada desc, id
     offset desde limit por_pagina
  )
  select (select count(*) from f),
         coalesce(jsonb_agg(vacante_json(r.fila, acceso, sal)
           order by ('cajeme' = any(r.zonas)) desc, ('sonora' = any(r.zonas)) desc, r.publicada desc, r.id), '[]'::jsonb)
    into total, filas
    from pagina r;

  return jsonb_build_object('total', total, 'acceso', acceso, 'vacantes', filas);
end $$;
grant execute on function public.buscar_empleos(text, text, text, text, text, text, boolean, int, int, int, text) to anon, authenticated;

-- La versión bloqueada también lleva las zonas
create or replace function public.vacante_json(r public.vacantes, acceso boolean, sal text)
returns jsonb language sql stable set search_path = public as $$
  select case when acceso then to_jsonb(r) - 'creada' || jsonb_build_object('bloqueada', false)
  else jsonb_build_object(
    'id', 'v' || left(md5(r.id || sal), 16),
    'empresa_slug', null, 'empresa_nombre', null, 'empresa_tipo', r.empresa_tipo,
    'titulo', tapar_empresa(r.titulo, r.empresa_nombre, r.empresa_slug),
    'url', null,
    'ubicacion', tapar_empresa(r.ubicacion, r.empresa_nombre, r.empresa_slug),
    'paises', r.paises, 'zonas', r.zonas, 'modalidad', r.modalidad, 'acepta_latam', r.acepta_latam,
    'categoria', r.categoria, 'nivel', r.nivel, 'idioma', r.idioma,
    'sueldo_min', r.sueldo_min, 'sueldo_max', r.sueldo_max, 'moneda', r.moneda, 'periodo', r.periodo,
    'descripcion', null, 'largo_descripcion', length(r.descripcion),
    'publicada', r.publicada, 'vista', r.vista, 'bloqueada', true)
  end;
$$;
revoke all on function public.vacante_json(public.vacantes, boolean, text) from public, anon, authenticated;

-- Las alertas también pueden ser por zona
create or replace function public.cumple_filtros(v public.vacantes, f jsonb, acceso boolean)
returns boolean language sql stable set search_path = public as $$
  select v.activa and v.acepta_latam
     and (coalesce(f->>'q', '') = ''
          or v.titulo ilike '%' || (f->>'q') || '%'
          or (acceso and v.empresa_nombre ilike '%' || (f->>'q') || '%'))
     and (coalesce(f->>'categoria', '') = '' or v.categoria = f->>'categoria')
     and (coalesce(f->>'pais', '') = '' or (f->>'pais') = any(v.paises))
     and (coalesce(f->>'modalidad', '') = '' or v.modalidad = f->>'modalidad')
     and (coalesce(f->>'nivel', '') = '' or v.nivel = f->>'nivel')
     and (coalesce(f->>'tipo', '') = '' or v.empresa_tipo = f->>'tipo')
     and (coalesce(f->>'zona', '') = '' or (f->>'zona') = any(v.zonas))
     and (coalesce((f->>'conSueldo')::boolean, false) = false or v.sueldo_max is not null);
$$;
revoke all on function public.cumple_filtros(public.vacantes, jsonb, boolean) from public, anon, authenticated;

create or replace function public.limpiar_filtros(f jsonb)
returns jsonb language sql immutable set search_path = public as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'q', nullif(left(trim(coalesce(f->>'q', '')), 80), ''),
    'categoria', nullif(f->>'categoria', ''),
    'pais', nullif(upper(coalesce(f->>'pais', '')), ''),
    'modalidad', case when f->>'modalidad' in ('remoto', 'hibrido', 'presencial') then f->>'modalidad' end,
    'nivel', nullif(f->>'nivel', ''),
    'tipo', case when f->>'tipo' in ('local', 'remoto') then f->>'tipo' end,
    'zona', case when f->>'zona' in ('cajeme', 'sonora') then f->>'zona' end,
    'conSueldo', case when (f->>'conSueldo') = 'true' then true end));
$$;

-- guardar_vacantes() también actualiza las zonas de las que ya existían
create or replace function public.guardar_vacantes(p_clave text, p_filas jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  if not clave_valida(p_clave) then raise exception 'clave inválida'; end if;
  insert into vacantes
  select (r).* from (
    select jsonb_populate_record(null::vacantes, f || jsonb_build_object('creada', now())) as r
      from jsonb_array_elements(p_filas) f
  ) x
  on conflict (id) do update set
    empresa_nombre = excluded.empresa_nombre, empresa_tipo = excluded.empresa_tipo, titulo = excluded.titulo,
    url = excluded.url, ubicacion = excluded.ubicacion, paises = excluded.paises, zonas = excluded.zonas,
    modalidad = excluded.modalidad, acepta_latam = excluded.acepta_latam, categoria = excluded.categoria,
    nivel = excluded.nivel, idioma = excluded.idioma, sueldo_min = excluded.sueldo_min, sueldo_max = excluded.sueldo_max,
    moneda = excluded.moneda, periodo = excluded.periodo, descripcion = excluded.descripcion,
    publicada = excluded.publicada, vista = excluded.vista, activa = true;
    -- "creada" no se toca: así sabemos cuáles son nuevas de verdad
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- Resumen con los números de Obregón y Sonora
-- ---------------------------------------------------------------------
create or replace function public.resumen_vacantes()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'total', count(*),
    'empresas', count(distinct empresa_slug),
    'remotas', count(*) filter (where modalidad = 'remoto'),
    'enMexico', count(*) filter (where 'MX' = any(paises)),
    'enCajeme', count(*) filter (where 'cajeme' = any(zonas)),
    'enSonora', count(*) filter (where 'sonora' = any(zonas)))
  from vacantes where activa and acepta_latam;
$$;
grant execute on function public.resumen_vacantes() to anon, authenticated;

-- ---------------------------------------------------------------------
-- Interruptor del muro de pago. Mientras no haya pagos, se puede dejar todo
-- visible para todos:   update config_privada set valor = 'no' where nombre = 'muro_activo';
-- Para volver a cobrar:  update config_privada set valor = 'si' where nombre = 'muro_activo';
-- ---------------------------------------------------------------------
insert into public.config_privada (nombre, valor) values ('muro_activo', 'si') on conflict (nombre) do nothing;

create or replace function public.tiene_acceso()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select valor from config_privada where nombre = 'muro_activo'), 'si') = 'no'
      or exists (select 1 from perfiles where id = auth.uid() and acceso_hasta > now());
$$;
grant execute on function public.tiene_acceso() to anon, authenticated;

-- Lanzamiento gratis: sin muro de pago (para volver a cobrar, cambia 'no' por 'si')
update public.config_privada set valor = 'no' where nombre = 'muro_activo';
