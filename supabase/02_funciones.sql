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
    -- Baches de la cámara: origen y tamaño medido (null en los demás)
    'origen', p.origen,
    'area_m2', p.area_m2,
    'area_sd_m2', p.area_sd_m2,
    'largo_m', p.largo_m,
    'ancho_m', p.ancho_m,
    'detecciones_camara', p.detecciones_camara,
    'calle', p.calle,
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

-- ---------------------------------------------------------------------
-- SECCIONES ELECTORALES (privadas: solo service_role, para el equipo)
-- ---------------------------------------------------------------------

-- Reportes por sección en los últimos p_dias días.
--   puntos: reportes con ubicación exacta (baches, drenaje, alumbrado, calles…), de cualquier estado.
--   agua:   reportes de falta de agua, baja presión o agua sucia. Como el agua solo guarda la
--           colonia (no el punto), se asigna a la sección donde cae el centro de la colonia: es aproximado.
create or replace function public.conteo_secciones(p_dias int default 30)
returns table (seccion int, distrito_local int, distrito_federal int, total bigint, puntos bigint, agua bigint)
language sql stable security definer
set search_path = public, extensions
as $$
  with desde as (select now() - make_interval(days => least(greatest(coalesce(p_dias, 30), 1), 3650)) as t),
  -- Si dos secciones se traslapan (bordes imprecisos o una sección dividida), cada reporte
  -- cuenta una sola vez: en la sección más chica que lo contiene.
  pin_seccion as (
    select distinct on (r.id) s.id
    from reportes_pin r
    join secciones s on st_intersects(s.geom, r.ubicacion)
    where r.creado_en > (select t from desde)
    order by r.id, st_area(s.geom)
  ),
  pin as (select id, count(*) as n from pin_seccion group by id),
  zona_seccion as (
    select distinct on (z.id) z.id as zona_id, s.id as seccion_id
    from zonas z
    join secciones s on st_intersects(s.geom, st_pointonsurface(z.geom))
    order by z.id, st_area(s.geom)
  ),
  agua as (
    select zs.seccion_id as id, count(*) as n
    from reportes_agua r
    join zona_seccion zs on zs.zona_id = r.zona_id
    where r.creado_en > (select t from desde) and r.estado <> 'con_agua'
    group by zs.seccion_id
  )
  select s.seccion, s.distrito_local, s.distrito_federal,
         coalesce(pin.n, 0) + coalesce(agua.n, 0), coalesce(pin.n, 0), coalesce(agua.n, 0)
  from secciones s
  left join pin  on pin.id  = s.id
  left join agua on agua.id = s.id
$$;

-- Secciones como GeoJSON con su conteo, para la capa del mapa del equipo
create or replace function public.secciones_mapa(p_dias int default 30)
returns json
language sql stable security definer
set search_path = public, extensions
as $$
  select json_build_object(
    'type', 'FeatureCollection',
    'features', coalesce(json_agg(json_build_object(
      'type', 'Feature',
      'properties', json_build_object(
        'seccion', s.seccion, 'distrito_local', s.distrito_local, 'distrito_federal', s.distrito_federal,
        'total', c.total, 'puntos', c.puntos, 'agua', c.agua),
      'geometry', st_asgeojson(st_simplifypreservetopology(s.geom, 0.00005), 5)::json
    )), '[]'::json)
  )
  from secciones s
  join conteo_secciones(p_dias) c on c.seccion = s.seccion
$$;

-- Reemplaza todas las secciones (se manda en lotes; el primer lote borra las anteriores)
create or replace function public.importar_secciones(p_secciones jsonb, p_borrar_antes boolean default false)
returns int
language plpgsql volatile security definer
set search_path = public, extensions
as $$
declare
  v_s    jsonb;
  v_geom geometry;
  v_n    int := 0;
begin
  if p_borrar_antes then
    delete from secciones where id is not null;
  end if;
  for v_s in select * from jsonb_array_elements(p_secciones) loop
    v_geom := st_multi(st_collectionextract(st_makevalid(
                st_setsrid(st_geomfromgeojson(v_s->>'geometria'), 4326)), 3));
    continue when v_geom is null or st_isempty(v_geom);
    insert into secciones (seccion, distrito_local, distrito_federal, geom)
    values ((v_s->>'seccion')::int, (v_s->>'distrito_local')::int, (v_s->>'distrito_federal')::int, v_geom)
    on conflict (seccion) do update
      set distrito_local = excluded.distrito_local, distrito_federal = excluded.distrito_federal,
          geom = st_multi(st_union(secciones.geom, excluded.geom));
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- Rugosidad medida (privada, para el mapa del equipo): tramos y golpes de los últimos p_dias días
create or replace function public.rugosidad_equipo(p_dias int default 30)
returns json
language sql stable security definer
set search_path = public, extensions
as $$
  with t as (
    select * from tramos_rugosidad
    where fecha > current_date - least(greatest(coalesce(p_dias, 30), 1), 3650)
    order by fecha desc
    limit 20000
  )
  select json_build_object(
    'type', 'FeatureCollection',
    'sesiones', (select count(distinct sesion) from t),
    'km', (select round((coalesce(sum(largo_m), 0) / 1000)::numeric, 1) from t),
    'features', coalesce((
      select json_agg(f) from (
        select json_build_object(
          'type', 'Feature',
          'properties', json_build_object('tipo', 'tramo', 'rms', t.rms, 'vel_kmh', t.vel_kmh, 'vehiculo', t.vehiculo, 'fecha', t.fecha, 'n_golpes', t.n_golpes, 'nota', t.nota),
          'geometry', st_asgeojson(t.trazo, 6)::json) as f
        from t
        union all
        select json_build_object(
          'type', 'Feature',
          'properties', json_build_object('tipo', 'golpe', 'fecha', t.fecha),
          'geometry', st_asgeojson(g.geom, 6)::json)
        from t, st_dump(t.golpes) g
        where t.golpes is not null
      ) x), '[]'::json)
  )
$$;

-- Nivel de un bache a partir del área medida (igual que nivelBache en lib/constantes.ts):
-- diámetro equivalente < 45 cm chico, < 75 cm mediano, si no grande (rangos de ASTM D6433).
-- Sin área medida queda como mediano.
create or replace function public._tamano_bache(p_area real)
returns text
language sql immutable
as $$
  select case
    when p_area is null                    then 'mediano'
    when 2 * sqrt(p_area / pi()) < 0.45    then 'chico'
    when 2 * sqrt(p_area / pi()) < 0.75    then 'mediano'
    else 'grande'
  end
$$;

-- Acomoda un punto (un bache) dentro de la calle por la que iba el vehículo.
-- Busca a menos de 25 m el tramo de calle con la misma dirección que el vehículo (±35°, en
-- cualquier sentido, para no confundirse con la calle que cruza en una esquina). Si el punto quedó
-- fuera del ancho de esa calle (por el error del GPS) lo mueve hacia el centro, hasta la orilla; si
-- ya está dentro (con 1 m de tolerancia por el trazo de OSM), no lo mueve. Sin calles importadas o
-- sin una calle compatible cerca, devuelve el punto tal cual y calle null.
create or replace function public.ubicar_en_calle(p_lng double precision, p_lat double precision, p_rumbo real)
returns table (lng double precision, lat double precision, calle text, ajuste_m real)
language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  v_punto geometry := st_setsrid(st_makepoint(p_lng, p_lat), 4326);
  v_nombre text;
  v_ancho real;
  v_seg geometry;
  v_d double precision;
  v_mitad real;
  v_nuevo geometry;
begin
  select c.nombre, c.ancho_m, s.geom, st_distance(s.geom::geography, v_punto::geography)
    into v_nombre, v_ancho, v_seg, v_d
    from calles c
    cross join lateral st_dumpsegments(c.geom) s
   where c.geom && st_expand(v_punto, 0.00025)
     and st_dwithin(s.geom::geography, v_punto::geography, 25)
     and (p_rumbo is null or (
           select least(x, 360 - x)
             from (select mod(abs(degrees(st_azimuth(st_startpoint(s.geom)::geography, st_endpoint(s.geom)::geography)) - p_rumbo)::numeric, 360) as x) y
         ) not between 35 and 145)
   order by 4
   limit 1;

  if not found then
    return query select p_lng, p_lat, null::text, 0::real;
    return;
  end if;
  v_mitad := v_ancho / 2;
  if v_d <= v_mitad + 1 then
    return query select p_lng, p_lat, v_nombre, 0::real;
    return;
  end if;
  -- Del punto más cercano del eje de la calle hacia el bache, hasta la orilla
  v_nuevo := st_lineinterpolatepoint(st_makeline(st_closestpoint(v_seg, v_punto), v_punto), least(1, v_mitad / v_d));
  return query select st_x(v_nuevo), st_y(v_nuevo), v_nombre, (v_d - v_mitad)::real;
end;
$$;

-- Carga calles de OpenStreetMap (scripts/importar-calles.mjs). Solo el servidor (service_role).
create or replace function public.importar_calles(p_calles jsonb, p_borrar_antes boolean default false)
returns int
language plpgsql volatile security definer
set search_path = public, extensions
as $$
declare
  v_n int;
begin
  if p_borrar_antes then
    -- Con "where": Supabase no permite borrar sin condición desde la API
    delete from calles where id is not null;
  end if;
  insert into calles (osm_id, nombre, tipo, sentido_unico, ancho_m, geom)
  select c->>'osm_id', nullif(c->>'nombre', ''), c->>'tipo', coalesce((c->>'sentido_unico')::boolean, false),
         (c->>'ancho_m')::real, st_setsrid(st_geomfromgeojson((c->'geom')::text), 4326)
    from jsonb_array_elements(p_calles) c
  on conflict (osm_id) do update
    set nombre = excluded.nombre, tipo = excluded.tipo, sentido_unico = excluded.sentido_unico,
        ancho_m = excluded.ancho_m, geom = excluded.geom;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Registra un bache detectado con la cámara (/api/baches-camara, solo equipo).
--  1. Lo acomoda dentro de la calle por la que iba el vehículo (ubicar_en_calle).
--  2. Si hay un bache activo a menos de 8 m, se le suma la detección: su tamaño pasa a ser la
--     mediana de las detecciones (chico, mediano o grande; "peligroso" lo deciden los vecinos y no se
--     cambia) y, si lo creó la cámara, su ubicación es el promedio de todas sus pasadas.
--  3. Si no hay, se crea un bache nuevo con su tamaño medido. Si no se pudo medir, NO se publica
--     (no se sabe si es chico, mediano o grande): solo queda la detección.
-- En un recorrido de prueba (p.prueba = la nota) solo se guarda la detección: no se publica ni
-- cambia ningún bache del mapa.
-- Devuelve {pin_id, nuevo, calle}; pin_id null si no se publicó.
create or replace function public.registrar_bache_camara(p jsonb)
returns json
language plpgsql volatile security definer
set search_path = public, extensions
as $$
declare
  v_lat    double precision := (p->>'lat')::double precision;
  v_lng    double precision := (p->>'lng')::double precision;
  v_gps    geometry := st_setsrid(st_makepoint(v_lng, v_lat), 4326);
  v_punto  geometry;
  v_sesion uuid := (p->>'sesion')::uuid;
  v_area   real := (p->>'area_m2')::real;
  v_prueba text := nullif(trim(p->>'prueba'), '');
  v_volunt boolean := coalesce((p->>'voluntario')::boolean, false);
  v_calle  text;
  v_ajuste real;
  v_pin    bigint;
  v_nuevo  boolean := false;
  v_visto  boolean := false;
begin
  select u.lng, u.lat, u.calle, u.ajuste_m into v_lng, v_lat, v_calle, v_ajuste
    from ubicar_en_calle(v_lng, v_lat, (p->>'rumbo')::real) u;
  v_punto := st_setsrid(st_makepoint(v_lng, v_lat), 4326);

  if v_prueba is not null then
    insert into detecciones_bache (sesion, fecha, ubicacion, ubicacion_gps, area_m2, area_sd_m2, largo_m, ancho_m,
                                   confianza, confianza_max, cuadros, medidas, distancia_m, foto_ruta,
                                   modelo, altura_m, fov, plataforma, calle, rumbo, precision_m, ajuste_m, prueba, voluntario)
    values (v_sesion, (p->>'fecha')::date, v_punto, v_gps, v_area, (p->>'area_sd_m2')::real,
            (p->>'largo_m')::real, (p->>'ancho_m')::real, (p->>'confianza')::real, (p->>'confianza_max')::real,
            (p->>'cuadros')::int, coalesce((p->>'medidas')::int, 0), (p->>'distancia_m')::real, p->>'foto_ruta',
            p->>'modelo', (p->>'altura_m')::real, (p->>'fov')::real, p->>'plataforma',
            v_calle, (p->>'rumbo')::real, (p->>'precision_m')::real, v_ajuste, left(v_prueba, 60), v_volunt);
    return json_build_object('pin_id', null, 'nuevo', false, 'calle', v_calle, 'prueba', true);
  end if;

  select r.id into v_pin
    from reportes_pin r
   where r.tipo = 'bache' and r.estado = 'activo'
     and r.ubicacion && st_expand(v_punto, 0.0002)        -- ~20 m, usa el índice
     and st_dwithin(r.ubicacion::geography, v_punto::geography, 8)
   order by r.ubicacion <-> v_punto
   limit 1;

  if v_pin is null and v_area is not null then
    insert into reportes_pin (tipo, subtipo, ubicacion, zona_id, foto_ruta, dispositivo_hash, ip_hash,
                              origen, area_m2, area_sd_m2, largo_m, ancho_m, detecciones_camara, calle)
    values ('bache', _tamano_bache(v_area), v_punto, (zona_de_punto(v_lng, v_lat)->>'id')::bigint,
            p->>'foto_ruta', 'camara', 'camara', 'camara',
            v_area, (p->>'area_sd_m2')::real, (p->>'largo_m')::real, (p->>'ancho_m')::real, 1, v_calle)
    returning id into v_pin;
    v_nuevo := true;
  elsif v_pin is not null then
    -- El mismo recorrido no cuenta dos veces el mismo bache (p. ej. dio la vuelta a la manzana)
    select exists (select 1 from detecciones_bache d where d.pin_id = v_pin and d.sesion = v_sesion) into v_visto;
  end if;

  insert into detecciones_bache (pin_id, sesion, fecha, ubicacion, ubicacion_gps, area_m2, area_sd_m2, largo_m, ancho_m,
                                 confianza, confianza_max, cuadros, medidas, distancia_m, foto_ruta,
                                 modelo, altura_m, fov, plataforma, calle, rumbo, precision_m, ajuste_m, voluntario)
  values (v_pin, v_sesion, (p->>'fecha')::date, v_punto, v_gps, v_area, (p->>'area_sd_m2')::real,
          (p->>'largo_m')::real, (p->>'ancho_m')::real, (p->>'confianza')::real, (p->>'confianza_max')::real,
          (p->>'cuadros')::int, coalesce((p->>'medidas')::int, 0), (p->>'distancia_m')::real, p->>'foto_ruta',
          p->>'modelo', (p->>'altura_m')::real, (p->>'fov')::real, p->>'plataforma',
          v_calle, (p->>'rumbo')::real, (p->>'precision_m')::real, v_ajuste, v_volunt);

  if v_pin is not null and not v_nuevo then
    update reportes_pin r set
      ultima_actividad   = now(),
      detecciones_camara = r.detecciones_camara + case when v_visto then 0 else 1 end,
      foto_ruta          = coalesce(r.foto_ruta, p->>'foto_ruta'),
      calle              = coalesce(r.calle, v_calle),
      area_m2            = coalesce(m.area, r.area_m2),
      area_sd_m2         = coalesce(m.sd, r.area_sd_m2),
      largo_m            = coalesce(m.largo, r.largo_m),
      ancho_m            = coalesce(m.ancho, r.ancho_m),
      subtipo            = case when m.area is not null and r.subtipo <> 'peligroso' then _tamano_bache(m.area) else r.subtipo end,
      ubicacion          = case when r.origen = 'camara' then m.centro else r.ubicacion end
    from (
      select percentile_cont(0.5) within group (order by d.area_m2) filter (where d.area_m2 is not null)::real as area,
             case when count(d.area_m2) >= 2 then stddev_samp(d.area_m2) else max(d.area_sd_m2) end::real as sd,
             percentile_cont(0.5) within group (order by d.largo_m) filter (where d.area_m2 is not null)::real as largo,
             percentile_cont(0.5) within group (order by d.ancho_m) filter (where d.area_m2 is not null)::real as ancho,
             st_centroid(st_collect(d.ubicacion)) as centro
        from detecciones_bache d
       where d.pin_id = v_pin
    ) m
    where r.id = v_pin;
  end if;

  return json_build_object('pin_id', v_pin, 'nuevo', v_nuevo, 'calle', v_calle);
end;
$$;

-- Detecciones de la cámara para análisis (CSV del equipo)
create or replace function public.exportar_detecciones_bache(p_dias int default 3650)
returns json
language sql stable security definer
set search_path = public, extensions
as $$
  select coalesce(json_agg(x order by x.fecha desc, x.id), '[]'::json)
  from (
    select d.id, d.fecha, d.sesion, d.pin_id, d.area_m2, d.area_sd_m2, d.largo_m, d.ancho_m,
           d.confianza, d.confianza_max, d.cuadros, d.medidas, d.distancia_m, d.modelo,
           d.altura_m, d.fov, d.plataforma, d.foto_ruta, d.calle, d.rumbo, d.precision_m, d.ajuste_m, d.prueba, d.voluntario,
           round(st_y(d.ubicacion)::numeric, 6) as lat,
           round(st_x(d.ubicacion)::numeric, 6) as lng
    from detecciones_bache d
    where d.fecha > current_date - least(greatest(coalesce(p_dias, 3650), 1), 3650)
    order by d.fecha desc
    limit 200000
  ) x
$$;

-- Precisión de la cámara: cada medida de referencia contra la mediana de lo que midió la cámara a
-- menos de 10 m (de todos los recorridos, de prueba o no). error = (cámara − referencia) / referencia.
create or replace function public.comparar_referencias(p_dias int default 365)
returns json
language sql stable security definer
set search_path = public, extensions
as $$
  with r as (
    select * from mediciones_referencia
    where fecha > current_date - least(greatest(coalesce(p_dias, 365), 1), 3650)
  ),
  c as (
    select r.id, r.fecha, r.nota, r.referencia, r.area_m2 as area_ref, r.largo_m, r.ancho_m, r.precision_m,
           round(st_y(r.ubicacion)::numeric, 6) as lat, round(st_x(r.ubicacion)::numeric, 6) as lng,
           d.area as area_camara, d.n as detecciones, d.dist_m, d.calle,
           case when d.area is not null and r.area_m2 > 0 then round(((d.area - r.area_m2) / r.area_m2 * 100)::numeric, 1) end as error_pct
      from r
      left join lateral (
        select percentile_cont(0.5) within group (order by x.area_m2)::real as area,
               count(*) as n,
               round(min(st_distance(x.ubicacion::geography, r.ubicacion::geography))::numeric, 1) as dist_m,
               max(x.calle) as calle
          from detecciones_bache x
         where x.area_m2 is not null
           and x.ubicacion && st_expand(r.ubicacion, 0.0002)
           and st_dwithin(x.ubicacion::geography, r.ubicacion::geography, 10)
        having count(*) > 0
      ) d on true
  )
  select json_build_object(
    'filas', coalesce((select json_agg(c order by c.fecha desc, c.id desc) from c), '[]'::json),
    'referencias', (select count(*) from c),
    'comparados', (select count(*) from c where error_pct is not null),
    'error_medio', (select round(avg(error_pct), 2) from c),
    'mape', (select round(avg(abs(error_pct)), 2) from c)
  )
$$;

-- Tramos de rugosidad para análisis (CSV del equipo): todo lo medido, con los datos de calibración
create or replace function public.exportar_rugosidad(p_dias int default 3650)
returns json
language sql stable security definer
set search_path = public, extensions
as $$
  select coalesce(json_agg(x order by x.fecha desc, x.id), '[]'::json)
  from (
    select t.id, t.fecha, t.sesion, t.vehiculo, t.soporte, t.plataforma, t.nota,
           t.largo_m, t.vel_kmh, t.vel_sd, t.rms, t.rms_baja, t.p95, t.n_golpes, t.hz,
           round(st_y(st_lineinterpolatepoint(t.trazo, 0.5))::numeric, 6) as lat,
           round(st_x(st_lineinterpolatepoint(t.trazo, 0.5))::numeric, 6) as lng,
           st_astext(t.trazo, 6) as trazo
    from tramos_rugosidad t
    where t.fecha > current_date - least(greatest(coalesce(p_dias, 3650), 1), 3650)
    order by t.fecha desc
    limit 200000
  ) x
$$;

-- Resumen de lo medido (estadísticas del equipo). Los umbrales llegan de la app (lib/rugosidad.ts)
create or replace function public.resumen_rugosidad(p_regular real, p_mala real)
returns json
language sql stable security definer
set search_path = public, extensions
as $$
  select json_build_object(
    'km', round((coalesce(sum(largo_m), 0) / 1000)::numeric, 1),
    'sesiones', count(distinct sesion),
    'dias', count(distinct fecha),
    'km_buena', round((coalesce(sum(largo_m) filter (where rms < p_regular), 0) / 1000)::numeric, 1),
    'km_regular', round((coalesce(sum(largo_m) filter (where rms >= p_regular and rms < p_mala), 0) / 1000)::numeric, 1),
    'km_mala', round((coalesce(sum(largo_m) filter (where rms >= p_mala), 0) / 1000)::numeric, 1),
    'golpes', coalesce(sum(n_golpes), 0),
    'con_calibracion', count(*) filter (where rms_baja is not null),
    'pruebas', coalesce((
      select json_agg(p order by p.fecha desc) from (
        select nota, fecha, count(*) as tramos, round((sum(largo_m) / 1000)::numeric, 1) as km,
               round(avg(rms)::numeric, 2) as rms, round(avg(vel_kmh)::numeric) as vel_kmh,
               round(avg(vel_sd)::numeric, 1) as vel_sd
        from tramos_rugosidad where nota is not null
        group by sesion, nota, fecha
        order by fecha desc limit 30
      ) p), '[]'::json)
  )
  from tramos_rugosidad
$$;

-- Lo medido agrupado por rugosidad y velocidad, para la estimación económica (lib/economia.ts).
-- Sin recorridos de prueba (repiten la misma calle) ni motos (se sacuden distinto)
create or replace function public.rugosidad_distribucion()
returns json
language sql stable security definer
set search_path = public, extensions
as $$
  select coalesce(json_agg(x), '[]'::json)
  from (
    select round(rms::numeric, 2) as rms, (round(vel_kmh / 5) * 5)::int as vel_kmh, sum(largo_m) as m
    from tramos_rugosidad
    where nota is null and vehiculo <> 'moto'
    group by 1, 2
  ) x
$$;

-- Todos los reportes desde el inicio, para las burbujas del mapa (vista "Agrupados").
-- Solo tipo y ubicación: puntos en su lugar, y el agua contada por colonia en el centro de la colonia.
create or replace function public.historico_mapa()
returns json
language sql stable security definer
set search_path = public, extensions
as $$
  select json_build_object(
    'pins', coalesce((
      select json_agg(json_build_array(p.id, p.tipo, round(st_y(p.ubicacion)::numeric, 5), round(st_x(p.ubicacion)::numeric, 5)))
      from reportes_pin p), '[]'::json),
    'agua', coalesce((
      select json_agg(json_build_array(z.id, round(st_y(c.punto)::numeric, 5), round(st_x(c.punto)::numeric, 5), a.n))
      from (select zona_id, count(*) as n from reportes_agua group by zona_id) a
      join zonas z on z.id = a.zona_id
      cross join lateral (select st_pointonsurface(z.geom) as punto) c), '[]'::json)
  )
$$;

-- Datos públicos para /datos: solo cifras agregadas desde el inicio (nada de huellas, notas,
-- comentarios ni secciones electorales)
create or replace function public.datos_publicos()
returns json
language sql stable security definer
set search_path = public, extensions
as $$
  with
  hoy as (select (now() at time zone 'America/Hermosillo')::date as dia),
  inicio as (select least(
      coalesce((select min(creado_en) from reportes_pin), now()),
      coalesce((select min(creado_en) from reportes_agua), now())) as t),
  todos as (
    select creado_en, zona_id, 'agua'::text as tipo from reportes_agua
    union all
    select creado_en, zona_id, tipo from reportes_pin)
  select json_build_object(
    'generado', now(),
    'desde', (select (t at time zone 'America/Hermosillo')::date from inicio),
    'total', (select count(*) from todos),
    'total_agua', (select count(*) from reportes_agua),
    'total_puntos', (select count(*) from reportes_pin),
    'colonias_con_reportes', (select count(distinct zona_id) from todos where zona_id is not null),
    'colonias_afectadas_7d', (select count(*) from _estado_mayoria(168) m where m.estado <> 'con_agua'),
    'activos', (select count(*) from reportes_pin where estado = 'activo'),
    'arreglados', (select count(*) from reportes_pin where estado = 'arreglado'),
    'dias_promedio_arreglo', (select round(avg(extract(epoch from arreglado_en - creado_en) / 86400)::numeric, 1)
                              from reportes_pin where arreglado_en is not null),
    'dias_promedio_pendientes', (select round(avg(extract(epoch from now() - creado_en) / 86400)::numeric, 1)
                                 from reportes_pin where estado = 'activo'),
    -- Reportes por día desde el inicio (máximo 90 días)
    'por_dia', (
      select json_agg(json_build_object('dia', g.d::date, 'n', coalesce(c.n, 0)) order by g.d)
      from hoy, inicio,
           generate_series(greatest((inicio.t at time zone 'America/Hermosillo')::date, hoy.dia - 89), hoy.dia, interval '1 day') as g(d)
      left join (select (creado_en at time zone 'America/Hermosillo')::date as dia, count(*) as n from todos group by 1) c
        on c.dia = g.d::date),
    'por_tipo', (
      select coalesce(json_agg(json_build_object('tipo', tipo, 'n', n, 'activos', activos, 'arreglados', arreglados) order by n desc), '[]'::json)
      from (select 'agua' as tipo, count(*) as n, 0::bigint as activos, 0::bigint as arreglados from reportes_agua
            union all
            select tipo, count(*), count(*) filter (where estado = 'activo'), count(*) filter (where estado = 'arreglado')
            from reportes_pin group by tipo) t
      where n > 0),
    'agua_por_estado', (select coalesce(json_object_agg(estado, n), '{}'::json)
                        from (select estado, count(*) as n from reportes_agua group by estado) x),
    'top_colonias', (
      select coalesce(json_agg(t order by t.total desc), '[]'::json)
      from (select z.nombre as colonia, count(*) as total,
                   count(*) filter (where todos.tipo = 'agua') as agua,
                   count(*) filter (where todos.tipo <> 'agua') as otros
            from todos join zonas z on z.id = todos.zona_id
            group by z.nombre order by total desc limit 10) t),
    -- Los reportes que más vecinos han confirmado (siguen pendientes)
    'mas_confirmados', (
      select coalesce(json_agg(m), '[]'::json)
      from (select p.id, p.tipo, p.subtipo, coalesce(z.nombre, 'Cajeme') as colonia, p.confirmaciones, p.creado_en
            from reportes_pin p left join zonas z on z.id = p.zona_id
            where p.estado = 'activo' and p.confirmaciones > 0
            order by p.confirmaciones desc, p.creado_en
            limit 5) m)
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
    -- Todos los reportes desde el inicio (nunca baja; los del periodo sí)
    'total', (select count(*) from reportes_agua) + (select count(*) from reportes_pin),
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
