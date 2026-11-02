-- =====================================================================
-- ChambaRadar · Zonas locales (Cd. Obregón / Cajeme y Sonora)
-- Correr DESPUÉS de 03_relacionadas.sql. Se puede correr más de una vez.
-- =====================================================================

alter table public.vacantes add column if not exists zonas text[] not null default '{}';
create index if not exists vacantes_zonas on public.vacantes using gin (zonas);

-- buscar_vacantes() gana el parámetro p_zona: se reemplaza la versión anterior
drop function if exists public.buscar_vacantes(text, text, text, text, text, text, boolean, int, int, int);

create or replace function public.buscar_vacantes(
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
  with f as (
    select v.* from vacantes v
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
  pagina as (select * from f order by publicada desc, id offset desde limit por_pagina)
  select (select count(*) from f), coalesce(jsonb_agg(vacante_json(r, acceso, sal) order by r.publicada desc, r.id), '[]'::jsonb)
    into total, filas
    from pagina r;

  return jsonb_build_object('total', total, 'acceso', acceso, 'vacantes', filas);
end $$;
grant execute on function public.buscar_vacantes(text, text, text, text, text, text, boolean, int, int, int, text) to anon, authenticated;

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
