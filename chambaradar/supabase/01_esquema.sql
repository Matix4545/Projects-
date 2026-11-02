-- =====================================================================
-- ChambaRadar · Esquema de base de datos
-- Pega este archivo completo en Supabase → SQL Editor → Run.
-- Se puede correr más de una vez sin romper nada.
--
-- Seguridad: las tablas NO se pueden leer directo con la clave pública.
-- Todo pasa por funciones que revisan quién pregunta:
--   · buscar_vacantes() oculta empresa, enlace y descripción si el
--     usuario no tiene acceso pagado. El muro de pago vive en la base.
--   · guardar_vacantes(), cerrar_vacantes() y registrar_pago() piden la
--     "clave de la app" (tabla config_privada), que solo conocen el
--     recolector y el webhook de pagos.
-- Así la app no necesita la clave service_role.
-- =====================================================================

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------
-- Configuración privada (nadie la puede leer con la API)
-- ---------------------------------------------------------------------
create table if not exists public.config_privada (
  nombre text primary key,
  valor  text not null
);
alter table public.config_privada enable row level security;

-- Clave de la app: se genera sola la primera vez. Para verla:
--   select valor from config_privada where nombre = 'clave_app';
insert into public.config_privada (nombre, valor)
values ('clave_app', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (nombre) do nothing;

create or replace function public.clave_valida(p_clave text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from config_privada where nombre = 'clave_app' and valor = p_clave and length(coalesce(p_clave, '')) >= 32);
$$;
revoke all on function public.clave_valida(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Vacantes (las llena el recolector)
-- ---------------------------------------------------------------------
create table if not exists public.vacantes (
  id              text primary key,             -- "empresa:idExterno"
  empresa_slug    text not null,
  empresa_nombre  text not null,
  empresa_tipo    text not null check (empresa_tipo in ('local', 'remoto')),
  titulo          text not null,
  url             text not null,
  ubicacion       text not null default '',
  paises          text[] not null default '{}',
  modalidad       text not null check (modalidad in ('remoto', 'hibrido', 'presencial')),
  acepta_latam    boolean not null default true,
  categoria       text not null,
  nivel           text not null,
  idioma          text not null default 'en',
  sueldo_min      numeric,
  sueldo_max      numeric,
  moneda          text,
  periodo         text,
  descripcion     text not null default '',
  publicada       timestamptz not null,
  vista           timestamptz not null,          -- última vez que el recolector la encontró
  activa          boolean not null default true
);

create index if not exists vacantes_activa_publicada on public.vacantes (activa, publicada desc);
create index if not exists vacantes_categoria on public.vacantes (categoria) where activa;
create index if not exists vacantes_paises on public.vacantes using gin (paises);
create index if not exists vacantes_titulo_trgm on public.vacantes using gin (titulo extensions.gin_trgm_ops);
create index if not exists vacantes_empresa on public.vacantes (empresa_slug);

alter table public.vacantes enable row level security;  -- sin políticas: nadie lee directo

-- ---------------------------------------------------------------------
-- Perfiles: uno por usuario, con la fecha hasta la que tiene acceso
-- ---------------------------------------------------------------------
create table if not exists public.perfiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text,
  acceso_hasta  timestamptz,
  creado        timestamptz not null default now()
);
alter table public.perfiles enable row level security;

drop policy if exists "cada quien ve su perfil" on public.perfiles;
create policy "cada quien ve su perfil" on public.perfiles
  for select to authenticated using (id = auth.uid());

create or replace function public.crear_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

revoke all on function public.crear_perfil() from public, anon, authenticated;

drop trigger if exists al_registrarse on auth.users;
create trigger al_registrarse after insert on auth.users
  for each row execute function public.crear_perfil();

create or replace function public.tiene_acceso()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and acceso_hasta > now());
$$;
grant execute on function public.tiene_acceso() to anon, authenticated;

-- ---------------------------------------------------------------------
-- Pagos (los registra el webhook de Stripe)
-- ---------------------------------------------------------------------
create table if not exists public.pagos (
  id        text primary key,                 -- id de la sesión de Stripe Checkout
  usuario   uuid not null references auth.users (id) on delete cascade,
  plan      text not null,
  dias      int  not null,
  monto     int  not null,                    -- en centavos
  moneda    text not null,
  creado    timestamptz not null default now()
);
alter table public.pagos enable row level security;

drop policy if exists "cada quien ve sus pagos" on public.pagos;
create policy "cada quien ve sus pagos" on public.pagos
  for select to authenticated using (usuario = auth.uid());

-- La versión anterior no pedía clave
drop function if exists public.registrar_pago(text, uuid, text, int, int, text);

-- Registra un pago y alarga el acceso. Si Stripe manda el mismo evento dos
-- veces, el segundo no hace nada (el id de la sesión ya existe).
create or replace function public.registrar_pago(
  p_clave text, p_sesion text, p_usuario uuid, p_plan text, p_dias int, p_monto int, p_moneda text
) returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  nuevo timestamptz;
begin
  if not clave_valida(p_clave) then raise exception 'clave inválida'; end if;

  insert into pagos (id, usuario, plan, dias, monto, moneda)
  values (p_sesion, p_usuario, p_plan, p_dias, p_monto, p_moneda)
  on conflict (id) do nothing;

  if not found then
    select acceso_hasta into nuevo from perfiles where id = p_usuario;
    return nuevo;
  end if;

  insert into perfiles (id) values (p_usuario) on conflict (id) do nothing;
  update perfiles
     set acceso_hasta = greatest(coalesce(acceso_hasta, now()), now()) + make_interval(days => p_dias)
   where id = p_usuario
  returning acceso_hasta into nuevo;
  return nuevo;
end $$;
grant execute on function public.registrar_pago(text, text, uuid, text, int, int, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Recolector: guardar y cerrar vacantes (con la clave de la app)
-- ---------------------------------------------------------------------
create or replace function public.guardar_vacantes(p_clave text, p_filas jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  if not clave_valida(p_clave) then raise exception 'clave inválida'; end if;
  insert into vacantes
  select * from jsonb_populate_recordset(null::vacantes, p_filas)
  on conflict (id) do update set
    empresa_nombre = excluded.empresa_nombre, empresa_tipo = excluded.empresa_tipo, titulo = excluded.titulo,
    url = excluded.url, ubicacion = excluded.ubicacion, paises = excluded.paises, modalidad = excluded.modalidad,
    acepta_latam = excluded.acepta_latam, categoria = excluded.categoria, nivel = excluded.nivel, idioma = excluded.idioma,
    sueldo_min = excluded.sueldo_min, sueldo_max = excluded.sueldo_max, moneda = excluded.moneda, periodo = excluded.periodo,
    descripcion = excluded.descripcion, publicada = excluded.publicada, vista = excluded.vista, activa = true;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function public.guardar_vacantes(text, jsonb) to anon, authenticated;

-- Las vacantes de estas empresas que no se vieron en esta corrida se cierran.
create or replace function public.cerrar_vacantes(p_clave text, p_empresas text[], p_antes timestamptz)
returns int language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  if not clave_valida(p_clave) then raise exception 'clave inválida'; end if;
  update vacantes set activa = false where activa and empresa_slug = any(p_empresas) and vista < p_antes;
  get diagnostics n = row_count;
  -- Las cerradas hace más de 60 días se borran para no crecer sin fin
  delete from vacantes where not activa and vista < now() - interval '60 days';
  return n;
end $$;
grant execute on function public.cerrar_vacantes(text, text[], timestamptz) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Lectura pública: búsqueda con muro de pago, resumen y empresas
-- ---------------------------------------------------------------------

-- Tapa el nombre de la empresa dentro de un texto ("Account Executive - Stripe")
create or replace function public.tapar_empresa(p_texto text, p_nombre text, p_slug text)
returns text language plpgsql immutable set search_path = public as $$
declare
  t text := p_texto;
  n text;
begin
  foreach n in array array[p_nombre, regexp_replace(p_nombre, '\s*\(.*\)\s*', '', 'g'), substring(p_nombre from '\(([^)]+)\)'), p_slug] loop
    if n is not null and length(trim(n)) >= 3 then
      t := regexp_replace(t, '\m' || regexp_replace(trim(n), '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g') || '\M', '•••', 'gi');
    end if;
  end loop;
  return t;
end $$;

create or replace function public.buscar_vacantes(
  p_q text default '', p_categoria text default '', p_pais text default '', p_modalidad text default '',
  p_nivel text default '', p_tipo text default '', p_con_sueldo boolean default false, p_dias int default 0,
  p_pagina int default 1, p_por_pagina int default 20
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
  with f as (
    select v.* from vacantes v
     where v.activa and v.acepta_latam
       -- Sin acceso solo se busca en el título; si no, escribir "Stripe" revelaría qué vacantes son de quién
       and (q is null or v.titulo ilike '%' || q || '%' or (acceso and v.empresa_nombre ilike '%' || q || '%'))
       and (coalesce(p_categoria, '') = '' or v.categoria = p_categoria)
       and (coalesce(p_pais, '') = '' or p_pais = any(v.paises))
       and (coalesce(p_modalidad, '') = '' or v.modalidad = p_modalidad)
       and (coalesce(p_nivel, '') = '' or v.nivel = p_nivel)
       and (coalesce(p_tipo, '') = '' or v.empresa_tipo = p_tipo)
       and (not coalesce(p_con_sueldo, false) or v.sueldo_max is not null)
       and (coalesce(p_dias, 0) = 0 or v.publicada >= now() - make_interval(days => p_dias))
  ),
  pagina as (select * from f order by publicada desc, id offset desde limit por_pagina)
  select (select count(*) from f),
         coalesce(jsonb_agg(
           case when acceso then to_jsonb(r) || jsonb_build_object('bloqueada', false)
           else jsonb_build_object(
             'id', 'v' || left(md5(r.id || sal), 16),
             'empresa_slug', null,
             'empresa_nombre', null,
             'empresa_tipo', r.empresa_tipo,
             'titulo', tapar_empresa(r.titulo, r.empresa_nombre, r.empresa_slug),
             'url', null,
             'ubicacion', tapar_empresa(r.ubicacion, r.empresa_nombre, r.empresa_slug),
             'paises', r.paises, 'modalidad', r.modalidad, 'acepta_latam', r.acepta_latam,
             'categoria', r.categoria, 'nivel', r.nivel, 'idioma', r.idioma,
             'sueldo_min', r.sueldo_min, 'sueldo_max', r.sueldo_max, 'moneda', r.moneda, 'periodo', r.periodo,
             'descripcion', null,
             'largo_descripcion', length(r.descripcion),
             'largo_empresa', length(r.empresa_nombre),
             'publicada', r.publicada, 'vista', r.vista,
             'bloqueada', true)
           end order by r.publicada desc, r.id), '[]'::jsonb)
    into total, filas
    from pagina r;

  return jsonb_build_object('total', total, 'acceso', acceso, 'vacantes', filas);
end $$;
grant execute on function public.buscar_vacantes(text, text, text, text, text, text, boolean, int, int, int) to anon, authenticated;

create or replace function public.resumen_vacantes()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'total', count(*),
    'empresas', count(distinct empresa_slug),
    'remotas', count(*) filter (where modalidad = 'remoto'),
    'enMexico', count(*) filter (where 'MX' = any(paises)))
  from vacantes where activa and acepta_latam;
$$;
grant execute on function public.resumen_vacantes() to anon, authenticated;

create or replace function public.empresas_con_vacantes()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(e order by e.total desc), '[]'::jsonb) from (
    select empresa_slug as slug, max(empresa_nombre) as nombre, max(empresa_tipo) as tipo,
           count(*)::int as total, (count(*) filter (where modalidad = 'remoto'))::int as remotas,
           array(select distinct p from vacantes v2, unnest(v2.paises) p where v2.empresa_slug = v.empresa_slug and v2.activa and v2.acepta_latam order by p) as paises
      from vacantes v where activa and acepta_latam
     group by empresa_slug
  ) e;
$$;
grant execute on function public.empresas_con_vacantes() to anon, authenticated;
