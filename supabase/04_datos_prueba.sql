-- =====================================================================
-- Reporta Cajeme · 04 · DATOS DE PRUEBA
-- Llena el mapa con reportes falsos para ver cómo se ve antes de lanzar.
--
-- REQUISITO: ya debes haber importado las zonas (npm run importar-zonas).
-- Puedes correrlo varias veces; cada vez agrega más reportes.
-- Para borrarlos antes de lanzar usa 05_borrar_datos_prueba.sql
-- (todos los datos de prueba tienen dispositivo_hash = 'prueba-...').
-- =====================================================================

do $$
declare
  z            record;
  v_dominante  public.estado_agua;
  v_estado     public.estado_agua;
  v_n          int;
  v_detalles   text[];
  v_comentario text;
  v_fecha      timestamptz;
  v_estados    public.estado_agua[] := array['sin_agua', 'baja_presion', 'sucia', 'con_agua'];
  v_com_sin    text[] := array[
    'Desde la mañana no cae ni una gota',
    'Ya van dos días sin agua en la cuadra',
    'Se fue como a las 6 am',
    'Nadie avisó del corte'];
  v_com_baja   text[] := array[
    'Sale muy poquita, no sube al tinaco',
    'Solo hay presión en la madrugada',
    'Apenas un hilito de agua'];
  v_com_sucia  text[] := array[
    'Sale amarilla y huele a cloro fuerte',
    'Trae arenita, hay que dejarla correr',
    'Color café después del corte'];
  v_com_con    text[] := array[
    'Ya regresó el agua, buena presión',
    'Volvió como a las 3 pm',
    'Todo normal por aquí'];
  v_det_posibles text[] := array['mal_olor', 'turbia', 'sedimentos', 'color_extrano'];
begin
  if not exists (select 1 from public.zonas) then
    raise exception 'No hay zonas. Primero corre: npm run importar-zonas';
  end if;

  -- ------------------------- AGUA -------------------------------------
  for z in select id from public.zonas order by random() loop
    -- ~65 % de las zonas tienen reportes en las últimas 24 h
    if random() < 0.65 then
      v_dominante := (case
        when random() < 0.30 then 'sin_agua'
        when random() < 0.45 then 'baja_presion'
        when random() < 0.40 then 'sucia'
        else 'con_agua' end)::public.estado_agua;

      v_n := 2 + floor(random() * 8)::int;
      for i in 1..v_n loop
        v_estado := case when random() < 0.7 then v_dominante
                         else v_estados[1 + floor(random() * 4)::int] end;
        v_detalles := '{}';
        if v_estado = 'sucia' then
          select coalesce(array_agg(d), '{}') into v_detalles
          from unnest(v_det_posibles) d where random() < 0.45;
        end if;
        v_comentario := null;
        if random() < 0.30 then
          v_comentario := case v_estado
            when 'sin_agua'     then v_com_sin  [1 + floor(random() * array_length(v_com_sin, 1))::int]
            when 'baja_presion' then v_com_baja [1 + floor(random() * array_length(v_com_baja, 1))::int]
            when 'sucia'        then v_com_sucia[1 + floor(random() * array_length(v_com_sucia, 1))::int]
            else                     v_com_con  [1 + floor(random() * array_length(v_com_con, 1))::int] end;
        end if;
        insert into public.reportes_agua
          (zona_id, estado, detalles_sucia, comentario, dispositivo_hash, ip_hash, creado_en)
        values
          (z.id, v_estado, v_detalles, v_comentario,
           'prueba-' || md5(random()::text), 'prueba',
           now() - random() * interval '23 hours');
      end loop;
    end if;

    -- historial de la semana (días 1 a 7)
    if random() < 0.75 then
      v_n := 1 + floor(random() * 10)::int;
      for i in 1..v_n loop
        insert into public.reportes_agua
          (zona_id, estado, dispositivo_hash, ip_hash, creado_en)
        values
          (z.id, v_estados[1 + floor(random() * 4)::int],
           'prueba-' || md5(random()::text), 'prueba',
           now() - interval '1 day' - random() * interval '6 days');
      end loop;
    end if;
  end loop;

  -- ------------------------- BACHES Y DRENAJE -------------------------
  for z in
    select zn.id, (extensions.st_dump(extensions.st_generatepoints(zn.geom, 1 + floor(random() * 3)::int))).geom as punto
    from public.zonas zn
    where random() < 0.55
  loop
    v_fecha := now() - random() * interval '30 days';
    insert into public.reportes_pin
      (tipo, subtipo, ubicacion, zona_id, comentario, confirmaciones, votos_arreglado,
       estado, arreglado_en, ultima_actividad, dispositivo_hash, ip_hash, creado_en)
    select
      t.tipo,
      case t.tipo
        when 'bache'     then (array['chico', 'mediano', 'grande', 'peligroso'])[1 + floor(random() * 4)::int]
        when 'drenaje'   then (array['tapado', 'aguas_negras', 'sin_tapa', 'mal_olor'])[1 + floor(random() * 4)::int]
        when 'alumbrado' then (array['apagada', 'parpadea', 'poste_danado', 'cables_expuestos'])[1 + floor(random() * 4)::int]
        when 'banqueta'  then (array['quebrada', 'incompleta', 'obstruida'])[1 + floor(random() * 3)::int]
        else                  (array['basura', 'maleza', 'quema', 'escombro'])[1 + floor(random() * 4)::int] end,
      z.punto,
      z.id,
      case when random() < 0.35 then
        (array['Ya se tragó una llanta', 'Cuidado de noche, no se ve',
               'Lleva semanas así', 'Huele horrible toda la cuadra',
               'Los niños pasan por aquí para la escuela'])[1 + floor(random() * 5)::int]
      end,
      floor(random() * random() * 15)::int,
      t.votos,
      case when t.votos >= 3 then 'arreglado' else 'activo' end,
      case when t.votos >= 3 then now() - random() * interval '6 days' end,
      v_fecha + random() * (now() - v_fecha),
      'prueba-' || md5(random()::text), 'prueba',
      v_fecha
    from (select (array['bache', 'bache', 'bache', 'drenaje', 'drenaje', 'alumbrado', 'alumbrado', 'banqueta', 'baldio'])
                   [1 + floor(random() * 9)::int] as tipo,
                 case when random() < 0.08 then 3
                      when random() < 0.15 then 1 + floor(random() * 2)::int
                      else 0 end as votos) t;
  end loop;
end $$;

-- Resumen de lo que hay ahora
select
  (select count(*) from public.reportes_agua where dispositivo_hash like 'prueba-%') as reportes_agua_prueba,
  (select count(*) from public.reportes_pin  where dispositivo_hash like 'prueba-%') as pins_prueba;
