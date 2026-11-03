-- =====================================================================
-- ChambaRadar · Contador de visitas propio
-- Correr DESPUÉS de 08_curriculums.sql. Se puede correr más de una vez.
--
-- Sin cookies y sin IP: cada evento guarda la página, la zona (estado), el
-- dispositivo, de dónde llegó y un código anónimo del visitante que cambia
-- cada día. Solo el servidor (con la clave de la app) registra eventos y
-- solo los administradores ven las estadísticas.
-- =====================================================================

create table if not exists public.eventos (
  id          bigint generated always as identity primary key,
  creado      timestamptz not null default now(),
  tipo        text not null check (tipo in ('vista', 'aplicar', 'aplicar_bloqueada')),
  ruta        text not null,
  busqueda    text,
  zona        text not null check (zona in ('obregon', 'sonora', 'mexico', 'extranjero', 'desconocida')),
  dispositivo text not null check (dispositivo in ('movil', 'escritorio')),
  origen      text not null,
  visitante   text not null,
  vacante     text,
  empresa     text
);
create index if not exists eventos_creado on public.eventos (creado desc);
alter table public.eventos enable row level security;

create or replace function public.registrar_evento(p_clave text, p_datos jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not clave_valida(p_clave) then raise exception 'clave inválida'; end if;
  insert into eventos (tipo, ruta, busqueda, zona, dispositivo, origen, visitante, vacante, empresa)
  values (p_datos->>'tipo', left(coalesce(p_datos->>'ruta', '/'), 120), nullif(left(p_datos->>'busqueda', 60), ''),
          p_datos->>'zona', p_datos->>'dispositivo', left(coalesce(p_datos->>'origen', 'directo'), 60),
          left(p_datos->>'visitante', 32), nullif(left(p_datos->>'vacante', 120), ''), nullif(left(p_datos->>'empresa', 120), ''));
  -- Los eventos se guardan 13 meses
  if random() < 0.001 then delete from eventos where creado < now() - interval '13 months'; end if;
end $$;
revoke all on function public.registrar_evento(text, jsonb) from public;
grant execute on function public.registrar_evento(text, jsonb) to anon, authenticated;

-- Estadísticas de los últimos p_dias días (hora de Sonora). Solo administradores.
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
        select empresa, count(*) n from e where tipo = 'aplicar' and empresa is not null group by empresa order by 2 desc limit 15) t), '[]'::jsonb)
  ) into r;
  return r;
end $$;
revoke all on function public.estadisticas_trafico(int) from public, anon;
grant execute on function public.estadisticas_trafico(int) to authenticated;
