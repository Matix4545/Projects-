-- =====================================================================
-- ChambaRadar · "Home office" para cualquier país de LATAM (Perú, Centroamérica…)
-- Correr DESPUÉS de 15_home_office_mexico.sql. Se puede correr más de una vez.
--
-- buscar_chambas recibe p_acepta_pais (código de país, opcional): deja solo
-- las remotas abiertas a cualquier país o que incluyen ese país. Se conserva
-- p_acepta_mx para que el sitio publicado siga funcionando durante el cambio.
-- =====================================================================

drop function if exists public.buscar_chambas(text, text, text, text, text, text, boolean, int, int, int, text, boolean, boolean);

create or replace function public.buscar_chambas(
  p_q text default '', p_categoria text default '', p_pais text default '', p_modalidad text default '',
  p_nivel text default '', p_tipo text default '', p_con_sueldo boolean default false, p_dias int default 0,
  p_pagina int default 1, p_por_pagina int default 20, p_zona text default '', p_cerca boolean default true,
  p_acepta_mx boolean default false, p_acepta_pais text default ''
) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  acceso boolean := tiene_acceso();
  q text := nullif(trim(coalesce(p_q, '')), '');
  cerca boolean := coalesce(p_cerca, true);
  por_pagina int := least(greatest(coalesce(p_por_pagina, 20), 1), 50);
  desde int := (least(greatest(coalesce(p_pagina, 1), 1), 500) - 1) * por_pagina;
  sal text := (select valor from config_privada where nombre = 'clave_app');
  total int;
  filas jsonb;
begin
  with f as (
    select v as fila, v.zonas, v.publicada, v.id,
           case when cerca then ('cajeme' = any(v.zonas))::int * 2 + ('sonora' = any(v.zonas))::int else 0 end as prioridad
      from vacantes v
     where v.activa and v.acepta_latam
       and (not cerca or cerca_de_obregon(v))
       and (q is null or v.titulo ilike '%' || q || '%' or (acceso and v.empresa_nombre ilike '%' || q || '%'))
       and (coalesce(p_categoria, '') = '' or v.categoria = p_categoria)
       and (coalesce(p_pais, '') = '' or p_pais = any(v.paises))
       and (coalesce(p_modalidad, '') = '' or v.modalidad = p_modalidad)
       and (coalesce(p_nivel, '') = '' or v.nivel = p_nivel)
       and (coalesce(p_tipo, '') = '' or v.empresa_tipo = p_tipo)
       and (not coalesce(p_con_sueldo, false) or v.sueldo_max is not null)
       and (coalesce(p_dias, 0) = 0 or v.publicada >= now() - make_interval(days => p_dias))
       and (coalesce(p_zona, '') = '' or p_zona = any(v.zonas))
       -- Home office para México: sin país (abierta) o que incluye a México
       and (not coalesce(p_acepta_mx, false) or cardinality(v.paises) = 0 or 'MX' = any(v.paises))
       -- Home office para cualquier país (Perú, Guatemala…): abierta o que incluye ese país
       and (coalesce(p_acepta_pais, '') = '' or cardinality(v.paises) = 0 or upper(p_acepta_pais) = any(v.paises))
  ),
  pagina as (
    select * from f order by prioridad desc, publicada desc, id offset desde limit por_pagina
  )
  select (select count(*) from f),
         coalesce(jsonb_agg(vacante_json(r.fila, acceso, sal) order by r.prioridad desc, r.publicada desc, r.id), '[]'::jsonb)
    into total, filas
    from pagina r;
  return jsonb_build_object('total', total, 'acceso', acceso, 'vacantes', filas);
end $$;
grant execute on function public.buscar_chambas(text, text, text, text, text, text, boolean, int, int, int, text, boolean, boolean, text) to anon, authenticated;
