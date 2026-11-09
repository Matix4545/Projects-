-- =====================================================================
-- ChambaRadar · Página por empresa ("Trabajar en X: vacantes y sueldos")
-- Correr DESPUÉS de 18_orden_espanol.sql. Se puede correr más de una vez.
--
-- Devuelve el resumen de una empresa (áreas, modalidades, lugares) y sus
-- vacantes. Las vacantes pasan por vacante_json: sin plan, el enlace y la
-- descripción siguen bloqueados; el nombre de la empresa es público porque es
-- el título de la página.
-- =====================================================================

create or replace function public.vacantes_de_empresa(p_slug text, p_limite int default 60)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  acceso boolean := tiene_acceso();
  sal text := (select valor from config_privada where nombre = 'clave_app');
  r jsonb;
begin
  with v as (
    select * from vacantes where activa and acepta_latam and empresa_slug = p_slug
  )
  select case when (select count(*) from v) = 0 then null else jsonb_build_object(
    'slug', p_slug,
    'nombre', (select max(empresa_nombre) from v),
    'tipo', (select max(empresa_tipo) from v),
    'total', (select count(*) from v),
    'remotas', (select count(*) from v where modalidad = 'remoto'),
    'con_sueldo', (select count(*) from v where sueldo_max is not null),
    'en_espanol', (select count(*) from v where idioma = 'es'),
    'ultima', (select max(publicada) from v),
    'areas', coalesce((select jsonb_agg(jsonb_build_object('clave', categoria, 'n', n) order by n desc) from (select categoria, count(*) n from v group by categoria) a), '[]'::jsonb),
    'modalidades', coalesce((select jsonb_agg(jsonb_build_object('clave', modalidad, 'n', n) order by n desc) from (select modalidad, count(*) n from v group by modalidad) m), '[]'::jsonb),
    'paises', coalesce((select jsonb_agg(jsonb_build_object('clave', p, 'n', n) order by n desc) from (select p, count(*) n from v, unnest(paises) p group by p) x), '[]'::jsonb),
    'estados', coalesce((select jsonb_agg(jsonb_build_object('clave', z, 'n', n) order by n desc) from (select z, count(*) n from v, unnest(zonas) z where z <> 'cajeme' group by z) x), '[]'::jsonb),
    'acceso', acceso,
    'vacantes', coalesce((select jsonb_agg(vacante_json(x.fila, acceso, sal) order by x.publicada desc) from (
        -- Desde la tabla (no desde el CTE) para que la fila tenga el tipo "vacantes" que pide vacante_json
        select vv as fila, vv.publicada from vacantes vv where vv.activa and vv.acepta_latam and vv.empresa_slug = p_slug
         order by vv.publicada desc limit greatest(1, least(coalesce(p_limite, 60), 200))) x), '[]'::jsonb)
  ) end into r;
  return r;
end $$;
revoke all on function public.vacantes_de_empresa(text, int) from public;
grant execute on function public.vacantes_de_empresa(text, int) to anon, authenticated;
