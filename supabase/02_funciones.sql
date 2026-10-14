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
-- (interna) Estado mayoritario de cada zona en las últimas 24 horas
-- ---------------------------------------------------------------------
create or replace function public._estado_mayoria_24h()
returns table (zona_id bigint, estado public.estado_agua, total bigint)
language sql stable security definer
set search_path = public, extensions
as $$
  with conteos as (
    select r.zona_id, r.estado, count(*) as n
    from reportes_agua r
    where r.creado_en > now() - interval '24 hours'
    group by r.zona_id, r.estado
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

-- Estado actual (color) de las zonas con reportes en 24 h
create or replace function public.estado_zonas()
returns json
language sql stable security definer
set search_path = public, extensions
as $$
  select coalesce(json_agg(json_build_object('id', m.zona_id, 'estado', m.estado, 'total', m.total)), '[]'::json)
  from _estado_mayoria_24h() m
$$;

-- Detalle de una zona: estado, conteos 24 h / 7 días, último reporte y comentarios
create or replace function public.detalle_zona(p_id bigint)
returns json
language sql stable security definer
set search_path = public, extensions
as $$
  select json_build_object(
    'id', z.id,
    'nombre', z.nombre,
    'fuente', z.fuente,
    'estado', (select m.estado from _estado_mayoria_24h() m where m.zona_id = z.id),
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
              and creado_en > now() - interval '7 days'
            order by creado_en desc limit 10) c)
  )
  from zonas z
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
    'colonia', z.nombre
  ) order by p.creado_en desc), '[]'::json)
  from (
    select * from reportes_pin
    where (estado = 'activo'    and ultima_actividad > now() - interval '60 days')
       or (estado = 'arreglado' and arreglado_en     > now() - interval '7 days')
    order by creado_en desc
    limit 3000
  ) p
  left join zonas z on z.id = p.zona_id
$$;

-- Resumen para la barra inferior
create or replace function public.resumen_24h()
returns json
language sql stable security definer
set search_path = public, extensions
as $$
  select json_build_object(
    'reportes',
      (select count(*) from reportes_agua where creado_en > now() - interval '24 hours') +
      (select count(*) from reportes_pin  where creado_en > now() - interval '24 hours'),
    'colonias_afectadas',
      (select count(*) from _estado_mayoria_24h() m where m.estado <> 'con_agua')
  )
$$;

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
  order by (z.fuente = 'osm') desc, st_area(z.geom) asc
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

-- Importa zonas (la usa scripts/importar-zonas.mjs).
-- Recibe un arreglo JSON: [{nombre, fuente, osm_id, h3_index, geometria}]
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

    if v_z->>'fuente' = 'osm' then
      insert into zonas (nombre, fuente, osm_id, geom)
      values (v_z->>'nombre', 'osm', v_z->>'osm_id', v_geom)
      on conflict (osm_id) do update set nombre = excluded.nombre, geom = excluded.geom;
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
    where not ((z.fuente = 'osm' and z.osm_id   = any (coalesce(p_osm, '{}')))
            or (z.fuente = 'h3'  and z.h3_index = any (coalesce(p_h3,  '{}'))));

  -- Reportes de agua: a la zona nueva que contiene el centro de la vieja (o la más cercana)
  update reportes_agua r
     set zona_id = (
       select z.id from zonas z
       where z.id not in (select id from _viejas)
       order by st_intersects(z.geom, v.punto) desc, (z.fuente = 'osm') desc, z.geom <-> v.punto
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
       order by st_intersects(z.geom, p.ubicacion) desc, (z.fuente = 'osm') desc,
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
