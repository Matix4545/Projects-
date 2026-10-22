-- =====================================================================
-- Reporta Cajeme · 02 · Funciones y triggers
-- Ejecuta este archivo DESPUÉS de 01_esquema.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- Gravedad para desempatar la mayoría: sin agua > sucia > baja presión > con agua
-- ---------------------------------------------------------------------
create or replace function public.prioridad_estado(e public.estado_agua)
returns int
language sql immutable
set search_path = public
as $$
  select case e
    when 'sin_agua'     then 1
    when 'sucia'        then 2
    when 'baja_presion' then 3
    else 4
  end
$$;

-- ---------------------------------------------------------------------
-- (interna) Estado mayoritario de cada zona en las últimas p_horas horas
-- (entre 1 y 720). Los reportes nunca se borran: solo cambia la ventana.
-- ---------------------------------------------------------------------
create or replace function public._estado_mayoria(p_horas int)
returns table (zona_id bigint, estado public.estado_agua, total bigint)
language sql stable security definer
set search_path = public, extensions
as $$
  -- Estado de cada colonia: el más reportado en el periodo (en empate, el más grave).
  -- Si alguien reportó "con agua", los reportes de problema ANTERIORES dejan de contar:
  -- la colonia se pone verde hasta que lleguen reportes de problema nuevos.
  with ventana as (
    select r.zona_id, r.estado, r.creado_en
    from reportes_agua r
    where r.creado_en > now() - make_interval(hours => least(greatest(coalesce(p_horas, 168), 1), 720))
  ),
  resuelto as (
    select v.zona_id, max(v.creado_en) as desde from ventana v where v.estado = 'con_agua' group by v.zona_id
  ),
  conteos as (
    select v.zona_id, v.estado, count(*) as n
    from ventana v
    left join resuelto u on u.zona_id = v.zona_id
    where u.desde is null or v.creado_en >= u.desde
    group by v.zona_id, v.estado
  ),
  ordenados as (
    select c.zona_id, c.estado,
           sum(c.n) over (partition by c.zona_id) as total,
           row_number() over (partition by c.zona_id
                              order by c.n desc, prioridad_estado(c.estado)) as rn
    from conteos c
  )
  select o.zona_id, o.estado, o.total::bigint from ordenados o where o.rn = 1
$$;

create or replace function public._estado_mayoria_24h()
returns table (zona_id bigint, estado public.estado_agua, total bigint)
language sql stable security definer
set search_path = public, extensions
as $$ select * from _estado_mayoria(24) $$;

-- =====================================================================
-- FUNCIONES PÚBLICAS DE LECTURA (las puede llamar cualquiera)
-- Nunca devuelven hashes de dispositivo ni de IP.
-- =====================================================================

-- Polígonos de todas las zonas como GeoJSON (se descarga una vez)
create or replace function public.zonas_geojson()
returns json
language sql stable security definer
set search_path = public, extensions
as $$
  select json_build_object(
    'type', 'FeatureCollection',
    'features', coalesce(json_agg(json_build_object(
      'type', 'Feature',
      'id', z.id,
      'properties', json_build_object('id', z.id, 'nombre', z.nombre, 'fuente', z.fuente),
      'geometry', st_asgeojson(st_simplifypreservetopology(z.geom, 0.00003), 6)::json
    ) order by z.id), '[]'::json)
  )
  from zonas z
$$;

-- Color de cada zona según la mayoría de reportes de agua en las últimas p_horas horas
drop function if exists public.estado_zonas();
create or replace function public.estado_zonas(p_horas int default 168)
returns json
language sql stable security definer
set search_path = public, extensions
as $$
  select coalesce(json_agg(json_build_object('id', m.zona_id, 'estado', m.estado, 'total', m.total)), '[]'::json)
  from _estado_mayoria(p_horas) m
$$;

-- Detalle de una zona: estado y conteos del periodo elegido, conteos de 7 días,
-- último reporte y comentarios. (conteo_24h y detalles_sucia_24h se conservan por compatibilidad.)
drop function if exists public.detalle_zona(bigint);
create or replace function public.detalle_zona(p_id bigint, p_horas int default 168)
returns json
language sql stable security definer
set search_path = public, extensions
as $$
  with v as (select make_interval(hours => least(greatest(coalesce(p_horas, 168), 1), 720)) as ventana,
                    least(greatest(coalesce(p_horas, 168), 1), 720) as horas)
  select json_build_object(
    'id', z.id,
    'nombre', z.nombre,
    'fuente', z.fuente,
    'horas', v.horas,
    'estado', (select m.estado from _estado_mayoria(v.horas) m where m.zona_id = z.id),
    'conteo_periodo', (
      select coalesce(json_object_agg(c.estado, c.n), '{}'::json)
      from (select estado, count(*) as n from reportes_agua
            where zona_id = z.id and creado_en > now() - v.ventana
            group by estado) c),
    'conteo_24h', (
      select coalesce(json_object_agg(c.estado, c.n), '{}'::json)
      from (select estado, count(*) as n from reportes_agua
            where zona_id = z.id and creado_en > now() - interval '24 hours'
            group by estado) c),
    'conteo_7d', (
      select coalesce(json_object_agg(c.estado, c.n), '{}'::json)
      from (select estado, count(*) as n from reportes_agua
            where zona_id = z.id and creado_en > now() - interval '7 days'
            group by estado) c),
    'detalles_sucia', (
      select coalesce(json_object_agg(d.detalle, d.n), '{}'::json)
      from (select unnest(detalles_sucia) as detalle, count(*) as n from reportes_agua
            where zona_id = z.id and estado = 'sucia' and creado_en > now() - v.ventana
            group by 1) d),
    'detalles_sucia_24h', (
      select coalesce(json_object_agg(d.detalle, d.n), '{}'::json)
      from (select unnest(detalles_sucia) as detalle, count(*) as n from reportes_agua
            where zona_id = z.id and estado = 'sucia' and creado_en > now() - interval '24 hours'
            group by 1) d),
    'ultimo_reporte', (select max(creado_en) from reportes_agua where zona_id = z.id),
    'comentarios', (
      select coalesce(json_agg(c order by c.creado_en desc), '[]'::json)
      from (select id, estado, comentario as texto, creado_en from reportes_agua
            where zona_id = z.id and comentario is not null and not comentario_oculto
              and creado_en > now() - greatest(v.ventana, interval '7 days')
            order by creado_en desc limit 10) c)
  )
  from zonas z, v
  where z.id = p_id
$$;

-- Pins visibles: activos (con actividad en los últimos 60 días)
-- y arreglados en los últimos 7 días (se muestran en gris)
create or replace function public.pins_publicos()
returns json
language sql stable security definer
set search_path = public, extensions
as $$
  select coalesce(json_agg(json_build_object(
    'id', p.id,
    'tipo', p.tipo,
    'subtipo', p.subtipo,
    'lat', round(st_y(p.ubicacion)::numeric, 6),
    'lng', round(st_x(p.ubicacion)::numeric, 6),
    'foto', case when p.foto_oculta then null else p.foto_ruta end,
    'comentario', case when p.comentario_oculto then null else p.comentario end,
    'confirmaciones', p.confirmaciones,
    'votos_arreglado', p.votos_arreglado,
    'estado', p.estado,
    'creado_en', p.creado_en,
    'arreglado_en', p.arreglado_en,
    'colonia', z.nombre,
    -- Tramo de calle como [[lat, lng], ...]; null en reportes de un solo punto
    'trazo', case when p.trazo is null then null else (
      select json_agg(json_build_array(round(st_y(d.geom)::numeric, 6), round(st_x(d.geom)::numeric, 6)) order by d.path)
      from st_dumppoints(p.trazo) d
    ) end
  ) order by p.creado_en desc), '[]'::json)
  from (
    select * from reportes_pin
    where (estado = 'activo'    and ultima_actividad > now() - interval '60 days')
       or (estado = 'arreglado' and arreglado_en     > now() - interval '90 days')
    order by creado_en desc
    limit 3000
  ) p
  left join zonas z on z.id = p.zona_id
$$;

-- Tablero de estadísticas del equipo (/estadisticas). PRIVADA: solo la llama el servidor
-- con la clave service_role, después de verificar la contraseña del panel.
--   Pendientes: activos con actividad en los últimos 60 días (los mismos del mapa).
--   Resueltos:  3 vecinos confirmaron el arreglo en los últimos 90 días.
create or replace function public.estadisticas_equipo()
returns json
language sql stable security definer
set search_path = public, extensions
as $$
  with pend as (
    select p.id, p.tipo, p.subtipo, p.zona_id, p.foto_oculta, p.foto_ruta, p.confirmaciones, p.creado_en,
           extract(epoch from now() - p.creado_en) / 86400 as dias
    from reportes_pin p
    where p.estado = 'activo' and p.ultima_actividad > now() - interval '60 days'
  ),
  res as (
    select p.tipo, extract(epoch from p.arreglado_en - p.creado_en) / 86400 as dias
    from reportes_pin p
    where p.estado = 'arreglado' and p.arreglado_en > now() - interval '90 days'
  ),
  tipos as (select unnest(array['bache', 'drenaje', 'alumbrado', 'banqueta', 'baldio', 'calle_cerrada', 'calle_baches']) as tipo)
  select json_build_object(
    'generado', now(),
    'pendientes', (select count(*) from pend),
    'criticos', (select count(*) from pend where dias > 30),
    'resueltos_90d', (select count(*) from res),
    'dias_promedio_resolucion', (select round(avg(dias)::numeric, 1) from res),
    'dias_promedio_pendientes', (select round(avg(dias)::numeric, 1) from pend),
    'agua_problemas_7d',
      (select count(*) from reportes_agua where creado_en > now() - interval '7 days' and estado <> 'con_agua'),
    'colonias_agua_afectadas', (select count(*) from _estado_mayoria(168) m where m.estado <> 'con_agua'),
    'por_tipo', (
      select json_agg(json_build_object(
        'tipo', t.tipo,
        'pendientes', (select count(*) from pend where pend.tipo = t.tipo),
        'criticos', (select count(*) from pend where pend.tipo = t.tipo and pend.dias > 30),
        'resueltos', (select count(*) from res where res.tipo = t.tipo),
        'suma_dias_resolucion', (select coalesce(round(sum(res.dias)::numeric, 1), 0) from res where res.tipo = t.tipo)
      ))
      from tipos t
    ),
    'top_colonias', (
      select coalesce(json_agg(c order by c.pendientes desc, c.criticos desc), '[]'::json)
      from (
        select z.nombre as colonia, count(*) as pendientes,
               count(*) filter (where pend.dias > 30) as criticos,
               floor(max(pend.dias))::int as dias_max
        from pend join zonas z on z.id = pend.zona_id
        group by z.nombre
        order by count(*) desc, count(*) filter (where pend.dias > 30) desc
        limit 10
      ) c
    ),
    'olvidados', (
      select coalesce(json_agg(o order by o.creado_en), '[]'::json)
      from (
        select pend.id, pend.tipo, pend.subtipo, z.nombre as colonia, pend.confirmaciones, pend.creado_en,
               case when pend.foto_oculta then null else pend.foto_ruta end as foto
        from pend left join zonas z on z.id = pend.zona_id
        order by pend.creado_en
        limit 10
      ) o
    )
  )
$$;

-- Resumen para la barra inferior: reportes y colonias afectadas en las últimas p_horas horas
create or replace function public.resumen(p_horas int default 168)
returns json
language sql stable security definer
set search_path = public, extensions
as $$
  with v as (select least(greatest(coalesce(p_horas, 168), 1), 720) as horas)
  select json_build_object(
    'horas', v.horas,
    'reportes',
      (select count(*) from reportes_agua where creado_en > now() - make_interval(hours => v.horas)) +
      (select count(*) from reportes_pin  where creado_en > now() - make_interval(hours => v.horas)),
    'colonias_afectadas',
      (select count(*) from _estado_mayoria(v.horas) m where m.estado <> 'con_agua')
  )
  from v
$$;

create or replace function public.resumen_24h()
returns json
language sql stable security definer
set search_path = public, extensions
as $$ select resumen(24) $$;

-- ¿En qué zona cae un punto? Si no cae en ninguna, la más cercana a < ~300 m
create or replace function public.zona_de_punto(p_lng double precision, p_lat double precision)
returns json
language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  v_punto geometry := st_setsrid(st_makepoint(p_lng, p_lat), 4326);
  v_res   json;
begin
  select json_build_object('id', z.id, 'nombre', z.nombre) into v_res
  from zonas z
  where st_intersects(z.geom, v_punto)
  order by (z.fuente <> 'h3') desc, st_area(z.geom) asc
  limit 1;

  if v_res is null then
    select json_build_object('id', z.id, 'nombre', z.nombre) into v_res
    from zonas z
    where st_dwithin(z.geom, v_punto, 0.003)
    order by z.geom <-> v_punto
    limit 1;
  end if;

  return v_res;
end;
$$;

-- =====================================================================
-- FUNCIONES SOLO PARA EL SERVIDOR (clave service_role)
-- =====================================================================

-- Suma 1 al contador diario de la IP si no ha llegado al máximo.
-- Devuelve true si el reporte puede pasar.
create or replace function public.consumir_cupo_ip(p_ip_hash text, p_max int)
returns boolean
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_dia   date := (now() at time zone 'America/Hermosillo')::date;
  v_total int;
begin
  insert into limite_ip as l (ip_hash, dia, total)
  values (p_ip_hash, v_dia, 1)
  on conflict (ip_hash, dia) do update
    set total = l.total + 1
    where l.total < p_max
  returning total into v_total;

  -- limpieza ocasional de días viejos
  if random() < 0.02 then
    delete from limite_ip where dia < v_dia - 2;
  end if;

  return v_total is not null;
end;
$$;

-- Si el total de reportes acaba de cruzar un múltiplo de p_cada (100, 200, 300…),
-- lo marca como avisado y devuelve ese número. Si no, devuelve null.
-- El UPDATE con "ultimo < nuevo" garantiza que solo una petición gane el aviso.
create or replace function public.reclamar_hito(p_cada int)
returns int
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_total bigint := (select count(*) from reportes_agua) + (select count(*) from reportes_pin);
  v_nuevo int    := (v_total / greatest(p_cada, 1))::int;
  v_hito  int;
begin
  update hitos set ultimo = v_nuevo
   where id = 1 and ultimo < v_nuevo
  returning ultimo * p_cada into v_hito;
  return v_hito;
end;
$$;

-- REPORTE EJECUTIVO (solo servidor): resumen de los últimos p_dias días
create or replace function public.reporte_ejecutivo(p_dias int)
returns json
language sql stable security definer
set search_path = public, extensions
as $$
  with
  rango as (
    select now() - make_interval(days => p_dias)     as desde,
           now() - make_interval(days => p_dias * 2) as desde_anterior,
           (now() at time zone 'America/Hermosillo')::date as hoy
  ),
  a as (select r.*, z.nombre from reportes_agua r join zonas z on z.id = r.zona_id, rango
        where r.creado_en > rango.desde),
  p as (select r.*, z.nombre from reportes_pin r left join zonas z on z.id = r.zona_id, rango
        where r.creado_en > rango.desde),
  todos as (select creado_en, nombre, 'agua'::text as tipo, estado::text as detalle from a
            union all
            select creado_en, coalesce(nombre, 'Sin colonia'), tipo, subtipo from p)
  select json_build_object(
    'dias', p_dias,
    'generado', now(),
    'total', (select count(*) from todos),
    'total_anterior', (select (select count(*) from reportes_agua, rango where creado_en > desde_anterior and creado_en <= desde)
                            + (select count(*) from reportes_pin,  rango where creado_en > desde_anterior and creado_en <= desde)),
    'total_historico', (select count(*) from reportes_agua) + (select count(*) from reportes_pin),
    'colonias_afectadas_ahora', (select count(*) from _estado_mayoria_24h() m where m.estado <> 'con_agua'),
    'activos', (select count(*) from reportes_pin where estado = 'activo' and ultima_actividad > now() - interval '60 days'),
    'arreglados', (select count(*) from reportes_pin, rango where arreglado_en > rango.desde),
    'dias_promedio_arreglo', (select round(avg(extract(epoch from arreglado_en - creado_en) / 86400)::numeric, 1)
                              from reportes_pin, rango where arreglado_en > rango.desde),
    'por_dia', (
      select json_agg(json_build_object('dia', d::date, 'n', coalesce(c.n, 0)) order by d)
      from rango, generate_series(rango.hoy - (p_dias - 1), rango.hoy, interval '1 day') d
      left join (select (creado_en at time zone 'America/Hermosillo')::date as dia, count(*) as n
                 from todos group by 1) c on c.dia = d::date),
    'por_tipo', (
      select coalesce(json_agg(json_build_object('tipo', tipo, 'n', n, 'arreglados', arreglados) order by n desc), '[]'::json)
      from (select 'agua' as tipo, count(*) as n, 0::bigint as arreglados from a
            union all
            select tipo, count(*), count(*) filter (where estado = 'arreglado') from p group by tipo) t
      where n > 0),
    'agua_por_estado', (select coalesce(json_object_agg(estado, n), '{}'::json)
                        from (select estado, count(*) as n from a group by estado) x),
    'por_detalle', (
      select coalesce(json_agg(json_build_object('tipo', tipo, 'detalle', subtipo, 'n', n) order by n desc), '[]'::json)
      from (select tipo, subtipo, count(*) as n from p group by tipo, subtipo order by n desc limit 12) x),
    'top_colonias', (
      select coalesce(json_agg(t order by t.total desc), '[]'::json)
      from (select nombre as colonia, count(*) as total,
                   count(*) filter (where tipo = 'agua') as agua,
                   count(*) filter (where tipo = 'agua' and detalle = 'sin_agua') as sin_agua,
                   count(*) filter (where tipo <> 'agua') as otros
            from todos group by nombre order by total desc limit 10) t),
    'urgentes', (
      select coalesce(json_agg(u), '[]'::json)
      from (select pn.id, pn.tipo, pn.subtipo, coalesce(z.nombre, 'Sin colonia') as colonia,
                   round(st_y(pn.ubicacion)::numeric, 6) as lat, round(st_x(pn.ubicacion)::numeric, 6) as lng,
                   pn.confirmaciones, pn.creado_en,
                   pn.subtipo in ('peligroso', 'sin_tapa', 'cables_expuestos', 'quema') as peligroso
            from reportes_pin pn left join zonas z on z.id = pn.zona_id
            where pn.estado = 'activo' and pn.ultima_actividad > now() - interval '60 days'
            order by (pn.subtipo in ('peligroso', 'sin_tapa', 'cables_expuestos', 'quema')) desc,
                     pn.confirmaciones desc, pn.creado_en
            limit 15) u),
    'moderacion', json_build_object(
      'comentarios_ocultos', (select count(*) from reportes_agua where comentario_oculto)
                           + (select count(*) from reportes_pin where comentario_oculto),
      'fotos_ocultas', (select count(*) from reportes_pin where foto_oculta),
      'en_revision', (select count(*) from reportes_agua where denuncias between 1 and 2 and not comentario_oculto)
                   + (select count(*) from reportes_pin where denuncias between 1 and 2 and not comentario_oculto)
                   + (select count(*) from reportes_pin where denuncias_foto between 1 and 2 and not foto_oculta))
  )
$$;

-- EXPORTAR (solo servidor): reportes del periodo para Excel, sin datos de dispositivo ni IP
create or replace function public.exportar_reportes(p_dias int)
returns json
language sql stable security definer
set search_path = public, extensions
as $$
  select coalesce(json_agg(x order by x.fecha desc), '[]'::json)
  from (
    select r.creado_en as fecha, 'agua' as tipo, r.estado::text as detalle, z.nombre as colonia,
           null::numeric as lat, null::numeric as lng,
           case when r.comentario_oculto then null else r.comentario end as comentario,
           null::int as confirmaciones, null::text as estado
    from reportes_agua r join zonas z on z.id = r.zona_id
    where r.creado_en > now() - make_interval(days => p_dias)
    union all
    select p.creado_en, p.tipo, p.subtipo, z.nombre,
           round(st_y(p.ubicacion)::numeric, 6), round(st_x(p.ubicacion)::numeric, 6),
           case when p.comentario_oculto then null else p.comentario end,
           p.confirmaciones, p.estado
    from reportes_pin p left join zonas z on z.id = p.zona_id
    where p.creado_en > now() - make_interval(days => p_dias)
  ) x
$$;

-- Importa zonas (la usa scripts/importar-zonas.mjs).
-- Recibe un arreglo JSON: [{nombre, fuente, osm_id, h3_index, geometria}]
-- fuente 'osm' u 'oficial' usan osm_id como identificador; 'h3' usa h3_index.
create or replace function public.importar_zonas(p_zonas jsonb)
returns int
language plpgsql volatile security definer
set search_path = public, extensions
as $$
declare
  v_z    jsonb;
  v_geom geometry;
  v_n    int := 0;
begin
  for v_z in select * from jsonb_array_elements(p_zonas) loop
    v_geom := st_multi(st_collectionextract(st_makevalid(
                st_setsrid(st_geomfromgeojson(v_z->>'geometria'), 4326)), 3));
    continue when v_geom is null or st_isempty(v_geom);

    if v_z->>'fuente' in ('osm', 'oficial') then
      insert into zonas (nombre, fuente, osm_id, geom)
      values (v_z->>'nombre', v_z->>'fuente', v_z->>'osm_id', v_geom)
      on conflict (osm_id) do update set nombre = excluded.nombre, fuente = excluded.fuente, geom = excluded.geom;
    else
      insert into zonas (nombre, fuente, h3_index, geom)
      values (v_z->>'nombre', 'h3', v_z->>'h3_index', v_geom)
      on conflict (h3_index) do update set nombre = excluded.nombre, geom = excluded.geom;
    end if;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- Retira las zonas que ya no están en la importación más reciente
-- (p. ej. hexágonos "Sector N" que ahora cubre una colonia real).
-- Antes de borrarlas, pasa sus reportes de agua a la zona nueva que cubre
-- su centro y recalcula la zona de todos los pins. Así no se pierde nada.
create or replace function public.retirar_zonas_viejas(p_osm text[], p_h3 text[])
returns int
language plpgsql volatile security definer
set search_path = public, extensions
as $$
declare
  v_n int;
begin
  if coalesce(cardinality(p_osm), 0) + coalesce(cardinality(p_h3), 0) < 20 then
    raise exception 'La importación nueva tiene muy pocas zonas; no se retira nada por seguridad.';
  end if;

  create temp table _viejas on commit drop as
    select z.id, st_pointonsurface(z.geom) as punto
    from zonas z
    where not ((z.fuente <> 'h3' and z.osm_id   = any (coalesce(p_osm, '{}')))
            or (z.fuente = 'h3'  and z.h3_index = any (coalesce(p_h3,  '{}'))));

  -- Reportes de agua: a la zona nueva que contiene el centro de la vieja (o la más cercana)
  update reportes_agua r
     set zona_id = (
       select z.id from zonas z
       where z.id not in (select id from _viejas)
       order by st_intersects(z.geom, v.punto) desc, (z.fuente <> 'h3') desc, z.geom <-> v.punto
       limit 1)
    from _viejas v
   where r.zona_id = v.id;

  delete from zonas where id in (select id from _viejas);
  get diagnostics v_n = row_count;

  -- Pins: recalcular su colonia con las zonas nuevas
  update reportes_pin p
     set zona_id = (
       select z.id from zonas z
       where st_dwithin(z.geom, p.ubicacion, 0.003)
       order by st_intersects(z.geom, p.ubicacion) desc, (z.fuente <> 'h3') desc,
                st_area(z.geom) asc, z.geom <-> p.ubicacion
       limit 1)
   where p.id is not null;  -- Supabase exige WHERE en todo UPDATE (extensión safeupdate)

  return v_n;
end;
$$;

-- ---------------------------------------------------------------------
-- TRIGGER: al votar en un pin se actualizan los contadores.
-- Con 3 votos de "ya lo arreglaron" el pin pasa a 'arreglado'.
-- ---------------------------------------------------------------------
create or replace function public._tras_voto_pin()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.tipo = 'confirmo' then
    update reportes_pin
       set confirmaciones = confirmaciones + 1,
           ultima_actividad = now()
     where id = new.pin_id;
  else
    update reportes_pin
       set votos_arreglado  = votos_arreglado + 1,
           ultima_actividad = now(),
           estado       = case when votos_arreglado + 1 >= 3 then 'arreglado' else estado end,
           arreglado_en = case when votos_arreglado + 1 >= 3 and arreglado_en is null
                               then now() else arreglado_en end
     where id = new.pin_id;
  end if;
  return new;
end;
$$;

drop trigger if exists tras_voto_pin on public.votos_pin;
create trigger tras_voto_pin
  after insert on public.votos_pin
  for each row execute function public._tras_voto_pin();

-- ---------------------------------------------------------------------
-- TRIGGER: 3 denuncias → el comentario (o la foto) se oculta automáticamente
-- ---------------------------------------------------------------------
create or replace function public._tras_denuncia()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.objetivo_tipo = 'agua' then
    update reportes_agua
       set denuncias = denuncias + 1,
           comentario_oculto = comentario_oculto or denuncias + 1 >= 3
     where id = new.objetivo_id;
  elsif new.objetivo_tipo = 'foto' then
    update reportes_pin
       set denuncias_foto = denuncias_foto + 1,
           foto_oculta = foto_oculta or denuncias_foto + 1 >= 3
     where id = new.objetivo_id;
  else
    update reportes_pin
       set denuncias = denuncias + 1,
           comentario_oculto = comentario_oculto or denuncias + 1 >= 3
     where id = new.objetivo_id;
  end if;
  return new;
end;
$$;

drop trigger if exists tras_denuncia on public.denuncias;
create trigger tras_denuncia
  after insert on public.denuncias
  for each row execute function public._tras_denuncia();
