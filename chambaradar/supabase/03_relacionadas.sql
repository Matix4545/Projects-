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
