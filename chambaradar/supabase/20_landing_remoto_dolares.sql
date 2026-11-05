-- =====================================================================
-- ChambaRadar · Landing "Remoto en dólares", duplicados agrupados, vacante de
-- ejemplo, lista de correos y compra confirmada por Stripe.
-- Correr DESPUÉS de 19_pagina_empresa.sql. Se puede correr más de una vez.
--
-- 1. buscar_chambas: la misma vacante publicada en varias ciudades (mismo
--    título + misma empresa) sale UNA vez, con 'otras_ubicaciones' = cuántas
--    más hay. Se prefiere la fila del país del visitante (o México).
-- 2. remoto_dolares(): listado para la landing de anuncios. Primero las que
--    publican sueldo, luego áreas masivas y puestos de entrada; fuera las
--    traducciones entre idiomas que no son español/inglés y los puestos de campo.
-- 3. vacante_ejemplo(): UNA vacante completa (empresa y enlace) para que quien
--    no ha pagado vea exactamente qué recibe.
-- 4. suscriptores + suscribir_correo(): "5 vacantes remotas en dólares cada semana".
-- 5. intentos_pago + pago_confirmado(): para mandar a Meta la compra que Stripe
--    confirmó (webhook), con el mismo id en el navegador y en el servidor.
-- =====================================================================

-- 1 ---------------------------------------------------------------------------
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
  pref text := upper(coalesce(nullif(p_acepta_pais, ''), nullif(p_pais, ''), 'MX'));
  total int;
  filas jsonb;
begin
  with f0 as (
    select v as fila, v.zonas, v.publicada, v.id, v.empresa_slug, v.titulo, v.paises, (v.idioma = 'es')::int as espanol,
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
       and (not coalesce(p_acepta_mx, false) or cardinality(v.paises) = 0 or 'MX' = any(v.paises))
       and (coalesce(p_acepta_pais, '') = '' or cardinality(v.paises) = 0 or upper(p_acepta_pais) = any(v.paises))
  ),
  -- Mismo título + misma empresa = una sola tarjeta (la del país del visitante, o la más nueva)
  f as (
    select *, count(*) over (partition by empresa_slug, lower(titulo)) as repetidas,
           row_number() over (partition by empresa_slug, lower(titulo) order by (pref = any(paises))::int desc, prioridad desc, publicada desc, id) as rn
      from f0
  ),
  pagina as (
    select * from f where rn = 1 order by prioridad desc, publicada::date desc, espanol desc, publicada desc, id offset desde limit por_pagina
  )
  select (select count(*) from f where rn = 1),
         coalesce(jsonb_agg(vacante_json(r.fila, acceso, sal) || jsonb_build_object('otras_ubicaciones', r.repetidas - 1)
                            order by r.prioridad desc, r.publicada::date desc, r.espanol desc, r.publicada desc, r.id), '[]'::jsonb)
    into total, filas
    from pagina r;
  return jsonb_build_object('total', total, 'acceso', acceso, 'vacantes', filas);
end $$;
grant execute on function public.buscar_chambas(text, text, text, text, text, text, boolean, int, int, int, text, boolean, boolean, text) to anon, authenticated;

-- 2 ---------------------------------------------------------------------------
-- ¿El sueldo publicado es creíble? (hay "1 USD al mes" de relleno en algunos portales)
create or replace function public.sueldo_creible(r vacantes) returns boolean language sql immutable as $$
  select r.sueldo_max is not null and r.moneda is not null and (
    r.moneda <> 'USD' and r.sueldo_max > 0
    or r.periodo = 'hora' and r.sueldo_max >= 4
    or r.periodo = 'semana' and r.sueldo_max >= 75
    or r.periodo = 'mes' and r.sueldo_max >= 300
    or r.periodo = 'año' and r.sueldo_max >= 5000
  );
$$;

-- Puestos que no sirven en una landing de "trabajo remoto": traducción entre
-- idiomas que no son español/inglés, y trabajo de campo que dice "Remote".
create or replace function public.apta_remoto_dolares(r vacantes) returns boolean language sql immutable as $$
  select not (r.titulo ~* '(translat|traduc|linguist|transcri|interpret|subtitl)'
              and r.titulo !~* '(spanish|espa[ñn]ol|english|ingl[eé]s|bilingual|biling[üu]e|latam|mexic)')
     and r.titulo !~* '(\mfield\M|\mcampo\M|territor|on[- ]?site|presencial|in[- ]person|door[- ]to[- ]door|\mdriver\M|chofer|repartidor)';
$$;

create or replace function public.remoto_dolares(p_pais text default 'MX', p_pagina int default 1, p_por_pagina int default 20)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  acceso boolean := tiene_acceso();
  pais text := upper(coalesce(nullif(p_pais, ''), 'MX'));
  por_pagina int := least(greatest(coalesce(p_por_pagina, 20), 1), 50);
  desde int := (least(greatest(coalesce(p_pagina, 1), 1), 100) - 1) * por_pagina;
  sal text := (select valor from config_privada where nombre = 'clave_app');
  total int; con_sueldo int; filas jsonb;
begin
  with f0 as (
    select v as fila, v.id, v.publicada, v.empresa_slug, v.titulo, v.paises,
           sueldo_creible(v)::int as con_sueldo,
           -- Áreas donde hay más gente buscando (atención a clientes, ventas, asistentes, operaciones) primero; lo técnico al final
           case when v.categoria in ('atencion-clientes', 'ventas', 'operaciones', 'recursos-humanos', 'otros', 'marketing', 'finanzas', 'banca', 'turismo') then 2
                when v.categoria in ('software', 'datos-ia', 'producto', 'diseno', 'seguridad') then 0 else 1 end as masiva,
           case v.nivel when 'practicante' then 3 when 'junior' then 3 when 'intermedio' then 2 when 'senior' then 1 else 0 end as entrada,
           (v.idioma = 'es')::int as espanol
      from vacantes v
     where v.activa and v.acepta_latam and v.modalidad = 'remoto'
       and (cardinality(v.paises) = 0 or pais = any(v.paises))
       and apta_remoto_dolares(v)
  ),
  f as (
    select *, count(*) over (partition by empresa_slug, lower(titulo)) as repetidas,
           row_number() over (partition by empresa_slug, lower(titulo) order by (pais = any(paises))::int desc, con_sueldo desc, publicada desc, id) as rn
      from f0
  ),
  pagina as (
    select * from f where rn = 1
     order by con_sueldo desc, masiva desc, entrada desc, espanol desc, publicada desc, id
    offset desde limit por_pagina
  )
  select (select count(*) from f where rn = 1), (select count(*) from f where rn = 1 and con_sueldo = 1),
         coalesce(jsonb_agg(vacante_json(r.fila, acceso, sal) || jsonb_build_object('otras_ubicaciones', r.repetidas - 1)
                            order by r.con_sueldo desc, r.masiva desc, r.entrada desc, r.espanol desc, r.publicada desc, r.id), '[]'::jsonb)
    into total, con_sueldo, filas
    from pagina r;
  return jsonb_build_object('total', total, 'con_sueldo', con_sueldo, 'acceso', acceso, 'vacantes', filas);
end $$;
revoke all on function public.remoto_dolares(text, int, int) from public;
grant execute on function public.remoto_dolares(text, int, int) to anon, authenticated;

-- 3 ---------------------------------------------------------------------------
-- Una vacante remota para el país, con sueldo creíble, de área masiva y nivel de
-- entrada/medio, COMPLETA (empresa y enlace) aunque no haya pagado. Es la muestra
-- de lo que se recibe. Cambia sola cuando esa vacante se cierra.
create or replace function public.vacante_ejemplo(p_pais text default 'MX')
returns jsonb language sql stable security definer set search_path = public as $$
  select to_jsonb(v) - 'creada' || jsonb_build_object('bloqueada', false, 'otras_ubicaciones', 0)
    from vacantes v
   where v.activa and v.acepta_latam and v.modalidad = 'remoto'
     and (cardinality(v.paises) = 0 or upper(coalesce(nullif(p_pais, ''), 'MX')) = any(v.paises))
     and sueldo_creible(v) and apta_remoto_dolares(v)
     and v.categoria in ('atencion-clientes', 'ventas', 'operaciones', 'recursos-humanos', 'otros', 'marketing')
     and v.nivel in ('junior', 'intermedio', 'practicante')
     and v.titulo !~* '(senior|\msr\M|lead|principal|enterprise|director|head of|manager|gerente)'
     and not (v.paises = '{}' and v.ubicacion ~* 'united states|\musa?\M')
   order by case v.periodo when 'mes' then 2 when 'hora' then 1 else 0 end desc, v.publicada desc, v.id
   limit 1;
$$;
revoke all on function public.vacante_ejemplo(text) from public;
grant execute on function public.vacante_ejemplo(text) to anon, authenticated;

-- 4 ---------------------------------------------------------------------------
create table if not exists public.suscriptores (
  id       bigserial primary key,
  correo   text not null unique,
  origen   text,                               -- página o botón donde se apuntó
  pais     text,
  creado   timestamptz not null default now(),
  baja     timestamptz,
  token    uuid not null default gen_random_uuid()  -- para darse de baja desde el correo
);
alter table public.suscriptores enable row level security;
-- Nadie lee la tabla desde la web; solo esta función escribe
create or replace function public.suscribir_correo(p_correo text, p_origen text default '', p_pais text default '')
returns text language plpgsql security definer set search_path = public as $$
declare
  c text := lower(trim(coalesce(p_correo, '')));
  nuevo boolean;
begin
  if c !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(c) > 120 then raise exception 'correo inválido'; end if;
  insert into suscriptores (correo, origen, pais) values (c, left(coalesce(p_origen, ''), 80), left(upper(coalesce(p_pais, '')), 2))
  on conflict (correo) do update set baja = null
  returning (xmax = 0) into strict nuevo;  -- true si es nuevo
  return case when nuevo then 'nuevo' else 'ya' end;
end $$;
revoke all on function public.suscribir_correo(text, text, text) from public;
grant execute on function public.suscribir_correo(text, text, text) to anon, authenticated;

-- 5 ---------------------------------------------------------------------------
-- Quién fue a pagar (cookies del píxel de Meta, ip y navegador) para que el
-- webhook pueda mandar la compra a Meta con atribución. Se borra a los 30 días.
create table if not exists public.intentos_pago (
  id       text primary key,
  usuario  uuid,
  fbp      text,
  fbc      text,
  ip       text,
  ua       text,
  creado   timestamptz not null default now()
);
alter table public.intentos_pago enable row level security;

create or replace function public.guardar_intento_pago(p_clave text, p_id text, p_usuario uuid, p_fbp text, p_fbc text, p_ip text, p_ua text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not clave_valida(p_clave) then raise exception 'clave inválida'; end if;
  delete from intentos_pago where creado < now() - interval '30 days';
  insert into intentos_pago (id, usuario, fbp, fbc, ip, ua)
  values (left(p_id, 64), p_usuario, left(p_fbp, 80), left(p_fbc, 200), left(p_ip, 64), left(p_ua, 300))
  on conflict (id) do nothing;
end $$;
revoke all on function public.guardar_intento_pago(text, text, uuid, text, text, text, text) from public;
grant execute on function public.guardar_intento_pago(text, text, uuid, text, text, text, text) to anon, authenticated;

create or replace function public.leer_intento_pago(p_clave text, p_id text, p_usuario uuid)
returns jsonb language sql security definer set search_path = public as $$
  select case when clave_valida(p_clave) then (
    select to_jsonb(i) from intentos_pago i
     where (p_id is not null and i.id = p_id) or (p_usuario is not null and i.usuario = p_usuario)
     order by i.creado desc limit 1) end;
$$;
revoke all on function public.leer_intento_pago(text, text, uuid) from public;
grant execute on function public.leer_intento_pago(text, text, uuid) to anon, authenticated;

-- ¿Stripe ya confirmó esta sesión de pago? (el id cs_… solo lo conoce quien pagó)
create or replace function public.pago_confirmado(p_sesion text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('plan', plan, 'monto', monto, 'moneda', moneda) from (
    select plan, monto, moneda from pagos where id = p_sesion
    union all
    select plan, monto, moneda from pagos_por_correo where id = p_sesion
  ) p limit 1;
$$;
revoke all on function public.pago_confirmado(text) from public;
grant execute on function public.pago_confirmado(text) to anon, authenticated;
