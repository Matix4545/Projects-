-- =====================================================================
-- ChambaRadar · Catálogo completo con Obregón primero
-- Correr DESPUÉS de lanzamiento_obregon.sql (o 02–04). Se puede correr más
-- de una vez y no borra nada.
--
-- La base guarda todas las vacantes que sirven desde LATAM. "Cerca de
-- Obregón" (lo que se ve por defecto) = Sonora en cualquier modalidad, o
-- 100 % remoto abierto a México. Con p_cerca = false se ve todo, para
-- usuarios de otras ciudades.
-- =====================================================================

create or replace function public.cerca_de_obregon(v public.vacantes)
returns boolean language sql immutable set search_path = public as $$
  select 'sonora' = any(v.zonas)
      or (v.modalidad = 'remoto' and (cardinality(v.paises) = 0 or 'MX' = any(v.paises)));
$$;

-- Nombre nuevo para no chocar con buscar_empleos() mientras se publica el sitio nuevo
create or replace function public.buscar_chambas(
  p_q text default '', p_categoria text default '', p_pais text default '', p_modalidad text default '',
  p_nivel text default '', p_tipo text default '', p_con_sueldo boolean default false, p_dias int default 0,
  p_pagina int default 1, p_por_pagina int default 20, p_zona text default '', p_cerca boolean default true
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
    select v as fila, v.zonas, v.publicada, v.id from vacantes v
     where v.activa and v.acepta_latam
       and (not coalesce(p_cerca, true) or cerca_de_obregon(v))
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
grant execute on function public.buscar_chambas(text, text, text, text, text, text, boolean, int, int, int, text, boolean) to anon, authenticated;

-- Las alertas guardan si son "cerca de Obregón" (por defecto) o de todo el catálogo
create or replace function public.cumple_filtros(v public.vacantes, f jsonb, acceso boolean)
returns boolean language sql stable set search_path = public as $$
  select v.activa and v.acepta_latam
     and (coalesce(f->>'alcance', 'cerca') = 'todo' or cerca_de_obregon(v))
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
    'alcance', case when f->>'alcance' = 'todo' then 'todo' end,
    'conSueldo', case when (f->>'conSueldo') = 'true' then true end));
$$;

-- Resumen: los números de la portada cuentan lo de cerca de Obregón; "total" es todo el catálogo
create or replace function public.resumen_vacantes()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'total', count(*),
    'empresas', count(distinct empresa_slug),
    'remotas', count(*) filter (where modalidad = 'remoto' and cerca_de_obregon(v)),
    'enMexico', count(*) filter (where 'MX' = any(paises)),
    'enCajeme', count(*) filter (where 'cajeme' = any(zonas)),
    'enSonora', count(*) filter (where 'sonora' = any(zonas)))
  from vacantes v where activa and acepta_latam;
$$;
grant execute on function public.resumen_vacantes() to anon, authenticated;
