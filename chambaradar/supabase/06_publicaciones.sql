-- =====================================================================
-- ChambaRadar · "Publica tu vacante" y panel de captura
-- Correr DESPUÉS de 05_alcance.sql. Se puede correr más de una vez y no borra nada.
--
-- · Los negocios publican desde /publicar (con sesión). Quedan "pendientes"
--   hasta que un administrador las aprueba en /panel.
-- · El administrador también captura vacantes (p. ej. de un cartel) y las
--   publica de una vez.
-- · Al aprobarse se copian a "vacantes" con id "directa:…": salen primero en
--   Obregón, siempre gratis y completas (sin muro de pago), y caducan a los 30 días.
-- =====================================================================

alter table public.perfiles add column if not exists es_admin boolean not null default false;

create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select es_admin from perfiles where id = auth.uid()), false);
$$;
grant execute on function public.es_admin() to anon, authenticated;

create table if not exists public.publicaciones (
  id                uuid primary key default gen_random_uuid(),
  estado            text not null default 'pendiente' check (estado in ('pendiente', 'publicada', 'rechazada', 'retirada')),
  origen            text not null default 'negocio' check (origen in ('negocio', 'captura')),
  creada_por        uuid references auth.users (id) on delete set null,
  empresa           text not null,
  puesto            text not null,
  categoria         text not null default 'otros',
  modalidad         text not null default 'presencial' check (modalidad in ('remoto', 'hibrido', 'presencial')),
  ubicacion         text not null default 'Cd. Obregón, Sonora',
  sueldo_min        numeric,
  sueldo_max        numeric,
  periodo           text check (periodo in ('hora', 'mes', 'año', 'semana')),
  horario           text,
  descripcion       text not null default '',
  contacto_whatsapp text,
  contacto_correo   text,
  contacto_url      text,
  creada            timestamptz not null default now(),
  revisada          timestamptz,
  revisada_por      uuid references auth.users (id) on delete set null
);
create index if not exists publicaciones_estado on public.publicaciones (estado, creada desc);
create index if not exists publicaciones_creada_por on public.publicaciones (creada_por);
alter table public.publicaciones enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'publicaciones' and policyname = 'cada quien ve sus publicaciones') then
    create policy "cada quien ve sus publicaciones" on public.publicaciones
      for select to authenticated using (creada_por = auth.uid() or es_admin());
  end if;
end $$;

-- Valida y normaliza lo que llega del formulario. Lanza error si falta algo.
create or replace function public.limpiar_publicacion(d jsonb)
returns public.publicaciones language plpgsql immutable set search_path = public as $$
declare
  p publicaciones;
  wa text := regexp_replace(coalesce(d->>'contacto_whatsapp', ''), '\D', '', 'g');
begin
  p.empresa := left(trim(coalesce(d->>'empresa', '')), 120);
  p.puesto := left(trim(coalesce(d->>'puesto', '')), 160);
  if length(p.empresa) < 2 then raise exception 'Escribe el nombre del negocio'; end if;
  if length(p.puesto) < 3 then raise exception 'Escribe el puesto'; end if;
  p.categoria := coalesce(nullif(d->>'categoria', ''), 'otros');
  p.modalidad := case when d->>'modalidad' in ('remoto', 'hibrido', 'presencial') then d->>'modalidad' else 'presencial' end;
  p.ubicacion := coalesce(nullif(left(trim(coalesce(d->>'ubicacion', '')), 120), ''), 'Cd. Obregón, Sonora');
  p.sueldo_min := nullif(d->>'sueldo_min', '')::numeric;
  p.sueldo_max := nullif(d->>'sueldo_max', '')::numeric;
  p.periodo := case when d->>'periodo' in ('hora', 'mes', 'año', 'semana') then d->>'periodo' end;
  p.horario := nullif(left(trim(coalesce(d->>'horario', '')), 160), '');
  p.descripcion := left(trim(coalesce(d->>'descripcion', '')), 4000);
  -- WhatsApp: 10 dígitos de México (con o sin 52)
  if length(wa) = 12 and left(wa, 2) = '52' then wa := right(wa, 10); end if;
  p.contacto_whatsapp := case when length(wa) = 10 then wa end;
  p.contacto_correo := case when coalesce(d->>'contacto_correo', '') ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then lower(trim(d->>'contacto_correo')) end;
  p.contacto_url := case when coalesce(d->>'contacto_url', '') ~* '^https?://' then left(trim(d->>'contacto_url'), 500) end;
  if p.contacto_whatsapp is null and p.contacto_correo is null and p.contacto_url is null then
    raise exception 'Agrega cómo aplicar: WhatsApp, correo o enlace';
  end if;
  return p;
end $$;

-- Copia una publicación aprobada a "vacantes"
create or replace function public.publicar_en_vacantes(p public.publicaciones)
returns void language plpgsql security definer set search_path = public as $$
declare
  u text := plano_ubicacion(p.ubicacion);
  url text := coalesce(
    case when p.contacto_whatsapp is not null then
      'https://wa.me/52' || p.contacto_whatsapp || '?text=' ||
      -- Solo letras, números y espacios en el mensaje, para que el enlace nunca se rompa
      replace('Hola, vi su vacante de ' || regexp_replace(p.puesto, '[^[:alnum:] ]', ' ', 'g') || ' en ChambaRadar y me interesa', ' ', '%20') end,
    p.contacto_url,
    'mailto:' || p.contacto_correo || '?subject=' || replace('Vacante de ' || regexp_replace(p.puesto, '[^[:alnum:] ]', ' ', 'g') || ' ChambaRadar', ' ', '%20'));
  extra text := concat_ws(E'\n',
    case when p.horario is not null then 'Horario: ' || p.horario end,
    case when p.contacto_whatsapp is not null then 'WhatsApp: ' || p.contacto_whatsapp end,
    case when p.contacto_correo is not null then 'Correo: ' || p.contacto_correo end);
begin
  insert into vacantes (id, empresa_slug, empresa_nombre, empresa_tipo, titulo, url, ubicacion, paises, zonas, modalidad,
                        acepta_latam, categoria, nivel, idioma, sueldo_min, sueldo_max, moneda, periodo, descripcion,
                        publicada, vista, activa, creada)
  values ('directa:' || p.id,
          'directa-' || left(regexp_replace(lower(p.empresa), '[^a-z0-9]+', '-', 'g'), 60),
          p.empresa, 'local', p.puesto, url, p.ubicacion, array['MX'],
          case when u ~ '(obregon|cajeme|esperanza|pueblo yaqui|bacum)' then array['cajeme', 'sonora']
               when u ~ '(sonora|hermosillo|navojoa|guaymas|empalme|nogales|huatabampo|etchojoa)' then array['sonora']
               else array[]::text[] end,
          p.modalidad, true, p.categoria, 'intermedio', 'es', p.sueldo_min, p.sueldo_max,
          case when p.sueldo_min is not null or p.sueldo_max is not null then 'MXN' end,
          p.periodo,
          concat_ws(E'\n\n', nullif(p.descripcion, ''), nullif(extra, '')),
          now(), now(), true, now())
  on conflict (id) do update set
    empresa_nombre = excluded.empresa_nombre, titulo = excluded.titulo, url = excluded.url, ubicacion = excluded.ubicacion,
    zonas = excluded.zonas, modalidad = excluded.modalidad, categoria = excluded.categoria, sueldo_min = excluded.sueldo_min,
    sueldo_max = excluded.sueldo_max, moneda = excluded.moneda, periodo = excluded.periodo, descripcion = excluded.descripcion,
    vista = now(), activa = true;
end $$;
revoke all on function public.publicar_en_vacantes(public.publicaciones) from public, anon, authenticated;

create or replace function public.plano_ubicacion(t text)
returns text language sql immutable as $$
  select lower(translate(coalesce(t, ''), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'));
$$;

-- Negocio con sesión: manda su vacante a revisión (máximo 10 al día por cuenta)
create or replace function public.enviar_publicacion(p_datos jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  yo uuid := auth.uid();
  p publicaciones := limpiar_publicacion(p_datos);
begin
  if yo is null then raise exception 'Inicia sesión para publicar'; end if;
  if (select count(*) from publicaciones where creada_por = yo and creada > now() - interval '1 day') >= 10 then
    raise exception 'Llegaste al máximo de 10 vacantes por día';
  end if;
  p.id := gen_random_uuid(); p.estado := 'pendiente'; p.origen := 'negocio'; p.creada_por := yo; p.creada := now();
  insert into publicaciones select p.*;
  return p.id;
end $$;
revoke all on function public.enviar_publicacion(jsonb) from public, anon;
grant execute on function public.enviar_publicacion(jsonb) to authenticated;

-- Administrador: captura y publica de una vez
create or replace function public.capturar_publicacion(p_datos jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  p publicaciones := limpiar_publicacion(p_datos);
begin
  if not es_admin() then raise exception 'Solo administradores'; end if;
  p.id := gen_random_uuid(); p.estado := 'publicada'; p.origen := 'captura'; p.creada_por := auth.uid();
  p.creada := now(); p.revisada := now(); p.revisada_por := auth.uid();
  insert into publicaciones select p.*;
  perform publicar_en_vacantes(p);
  return p.id;
end $$;
revoke all on function public.capturar_publicacion(jsonb) from public, anon;
grant execute on function public.capturar_publicacion(jsonb) to authenticated;

-- Administrador: aprobar, rechazar o retirar
create or replace function public.revisar_publicacion(p_id uuid, p_accion text)
returns text language plpgsql security definer set search_path = public as $$
declare
  p publicaciones;
begin
  if not es_admin() then raise exception 'Solo administradores'; end if;
  select * into p from publicaciones where id = p_id for update;
  if p.id is null then raise exception 'No existe'; end if;
  if p_accion = 'aprobar' then
    update publicaciones set estado = 'publicada', revisada = now(), revisada_por = auth.uid() where id = p_id returning * into p;
    perform publicar_en_vacantes(p);
  elsif p_accion in ('rechazar', 'retirar') then
    update publicaciones set estado = case when p_accion = 'rechazar' then 'rechazada' else 'retirada' end,
                             revisada = now(), revisada_por = auth.uid() where id = p_id;
    update vacantes set activa = false where id = 'directa:' || p_id;
  else
    raise exception 'Acción inválida';
  end if;
  return p_accion;
end $$;
revoke all on function public.revisar_publicacion(uuid, text) from public, anon;
grant execute on function public.revisar_publicacion(uuid, text) to authenticated;

-- Las vacantes directas siempre se ven completas (son gratis para el negocio y para quien busca)
create or replace function public.vacante_json(r public.vacantes, acceso boolean, sal text)
returns jsonb language sql stable set search_path = public as $$
  select case when acceso or r.id like 'directa:%' then to_jsonb(r) - 'creada' || jsonb_build_object('bloqueada', false)
  else jsonb_build_object(
    'id', 'v' || left(md5(r.id || sal), 16),
    'empresa_slug', null, 'empresa_nombre', null, 'empresa_tipo', r.empresa_tipo,
    'titulo', tapar_empresa(r.titulo, r.empresa_nombre, r.empresa_slug),
    'url', null,
    'ubicacion', tapar_empresa(r.ubicacion, r.empresa_nombre, r.empresa_slug),
    'paises', r.paises, 'zonas', r.zonas, 'modalidad', r.modalidad, 'acepta_latam', r.acepta_latam,
    'categoria', r.categoria, 'nivel', r.nivel, 'idioma', r.idioma,
    'sueldo_min', r.sueldo_min, 'sueldo_max', r.sueldo_max, 'moneda', r.moneda, 'periodo', r.periodo,
    'descripcion', null, 'largo_descripcion', length(r.descripcion),
    'publicada', r.publicada, 'vista', r.vista, 'bloqueada', true)
  end;
$$;
revoke all on function public.vacante_json(public.vacantes, boolean, text) from public, anon, authenticated;

-- El recolector (cada 30 min) también cierra las vacantes directas de más de 30 días
create or replace function public.cerrar_vacantes(p_clave text, p_empresas text[], p_antes timestamptz)
returns int language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  if not clave_valida(p_clave) then raise exception 'clave inválida'; end if;
  update vacantes set activa = false where activa and empresa_slug = any(p_empresas) and vista < p_antes;
  get diagnostics n = row_count;
  update vacantes set activa = false where activa and id like 'directa:%' and publicada < now() - interval '30 days';
  delete from vacantes where not activa and vista < now() - interval '60 days';
  return n;
end $$;
grant execute on function public.cerrar_vacantes(text, text[], timestamptz) to anon, authenticated;

-- Administrador inicial (el dueño de ChambaRadar). Para agregar otro:
--   update perfiles set es_admin = true where lower(email) = 'correo@ejemplo.com';
update public.perfiles set es_admin = true where lower(email) = 'spencer.machuca@gmail.com';
