-- =====================================================================
-- ChambaRadar · Contar clics en "Pagar" / "Desbloquear" (evento 'pagar')
-- Correr DESPUÉS de 16_home_office_por_pais.sql. Se puede correr más de una vez.
-- =====================================================================

alter table public.eventos drop constraint if exists eventos_tipo_check;
alter table public.eventos add constraint eventos_tipo_check check (tipo in ('vista', 'aplicar', 'aplicar_bloqueada', 'pagar'));

create or replace function public.estadisticas_trafico(p_dias int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  desde timestamptz := date_trunc('day', now() at time zone 'America/Hermosillo') at time zone 'America/Hermosillo'
                       - make_interval(days => greatest(1, least(coalesce(p_dias, 30), 400)) - 1);
  r jsonb;
begin
  if not es_admin() then raise exception 'Solo administradores'; end if;
  with e as (select *, (creado at time zone 'America/Hermosillo')::date as dia from eventos where creado >= desde)
  select jsonb_build_object(
    'desde', desde,
    'resumen', (select jsonb_build_object(
        'visitantes', count(distinct (dia, visitante)) filter (where tipo = 'vista'),
        'vistas', count(*) filter (where tipo = 'vista'),
        'aplicar', count(*) filter (where tipo = 'aplicar'),
        'aplicar_bloqueada', count(*) filter (where tipo = 'aplicar_bloqueada'),
        'pagar', count(distinct (dia, visitante)) filter (where tipo = 'pagar'),
        'busquedas', count(*) filter (where tipo = 'vista' and busqueda is not null),
        'obregon', count(distinct (dia, visitante)) filter (where tipo = 'vista' and zona = 'obregon')) from e),
    'por_dia', coalesce((select jsonb_agg(x order by x->>'dia') from (
        select jsonb_build_object('dia', d::date, 'visitantes', count(distinct e.visitante) filter (where e.tipo = 'vista'),
               'vistas', count(e.id) filter (where e.tipo = 'vista'), 'aplicar', count(e.id) filter (where e.tipo = 'aplicar')) x
        from generate_series((desde at time zone 'America/Hermosillo')::date, (now() at time zone 'America/Hermosillo')::date, interval '1 day') d
        left join e on e.dia = d::date group by d) t), '[]'::jsonb),
    'por_zona', coalesce((select jsonb_agg(jsonb_build_object('clave', zona, 'visitantes', v, 'aplicar', a) order by v desc) from (
        select zona, count(distinct (dia, visitante)) filter (where tipo = 'vista') v, count(*) filter (where tipo = 'aplicar') a from e group by zona) t), '[]'::jsonb),
    'por_origen', coalesce((select jsonb_agg(jsonb_build_object('clave', origen, 'n', n) order by n desc) from (
        select origen, count(distinct (dia, visitante)) n from e where tipo = 'vista' and origen <> 'interno' group by origen order by 2 desc limit 10) t), '[]'::jsonb),
    'por_dispositivo', coalesce((select jsonb_agg(jsonb_build_object('clave', dispositivo, 'n', n) order by n desc) from (
        select dispositivo, count(distinct (dia, visitante)) n from e where tipo = 'vista' group by dispositivo) t), '[]'::jsonb),
    'busquedas', coalesce((select jsonb_agg(jsonb_build_object('clave', busqueda, 'n', n) order by n desc) from (
        select busqueda, count(*) n from e where busqueda is not null group by busqueda order by 2 desc limit 15) t), '[]'::jsonb),
    'paginas', coalesce((select jsonb_agg(jsonb_build_object('clave', ruta, 'n', n) order by n desc) from (
        select ruta, count(*) n from e where tipo = 'vista' group by ruta order by 2 desc limit 15) t), '[]'::jsonb),
    'empresas', coalesce((select jsonb_agg(jsonb_build_object('clave', empresa, 'n', n) order by n desc) from (
        select empresa, count(*) n from e where tipo = 'aplicar' and empresa is not null group by empresa order by 2 desc limit 15) t), '[]'::jsonb),
    -- Por campaña: los visitantes que llegaron con ella y lo que hicieron ese mismo día
    'campanas', coalesce((select jsonb_agg(jsonb_build_object('clave', c.campana, 'visitantes', c.v, 'aplicar', c.a, 'pagar', c.p) order by c.v desc) from (
        select l.campana, count(distinct (l.dia, l.visitante)) v,
               count(distinct (x.dia, x.visitante)) filter (where x.tipo = 'aplicar_bloqueada' or x.tipo = 'aplicar') a,
               count(distinct (x.dia, x.visitante)) filter (where x.tipo = 'pagar') p
          from (select distinct dia, visitante, campana from e where campana is not null) l
          left join e x on x.dia = l.dia and x.visitante = l.visitante and x.tipo in ('aplicar', 'aplicar_bloqueada', 'pagar')
         group by l.campana order by 2 desc limit 15) c), '[]'::jsonb)
  ) into r;
  return r;
end $$;
revoke all on function public.estadisticas_trafico(int) from public, anon;
grant execute on function public.estadisticas_trafico(int) to authenticated;
