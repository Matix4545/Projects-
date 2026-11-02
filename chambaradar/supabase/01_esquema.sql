-- =====================================================================
-- ChambaRadar · Esquema de base de datos
-- Pega este archivo completo en Supabase → SQL Editor → Run.
-- Se puede correr más de una vez sin romper nada.
-- =====================================================================

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------
-- Vacantes (las llena scripts/recolectar.ts con la clave service_role)
-- ---------------------------------------------------------------------
create table if not exists public.vacantes (
  id              text primary key,             -- "empresa:idExterno"
  empresa_slug    text not null,
  empresa_nombre  text not null,
  empresa_tipo    text not null check (empresa_tipo in ('local', 'remoto')),
  titulo          text not null,
  url             text not null,
  ubicacion       text not null default '',
  paises          text[] not null default '{}',
  modalidad       text not null check (modalidad in ('remoto', 'hibrido', 'presencial')),
  acepta_latam    boolean not null default true,
  categoria       text not null,
  nivel           text not null,
  idioma          text not null default 'en',
  sueldo_min      numeric,
  sueldo_max      numeric,
  moneda          text,
  periodo         text,
  descripcion     text not null default '',
  publicada       timestamptz not null,
  vista           timestamptz not null,          -- última vez que el recolector la encontró
  activa          boolean not null default true
);

create index if not exists vacantes_activa_publicada on public.vacantes (activa, publicada desc);
create index if not exists vacantes_categoria on public.vacantes (categoria) where activa;
create index if not exists vacantes_paises on public.vacantes using gin (paises);
create index if not exists vacantes_titulo_trgm on public.vacantes using gin (titulo gin_trgm_ops);
create index if not exists vacantes_empresa on public.vacantes (empresa_slug);

-- Sin políticas: con RLS activo, la clave pública (anon) NO puede leer
-- vacantes. Solo el servidor (service_role) las lee y oculta la empresa
-- a quien no ha pagado.
alter table public.vacantes enable row level security;

-- ---------------------------------------------------------------------
-- Perfiles: uno por usuario, con la fecha hasta la que tiene acceso
-- ---------------------------------------------------------------------
create table if not exists public.perfiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text,
  acceso_hasta  timestamptz,
  creado        timestamptz not null default now()
);

alter table public.perfiles enable row level security;

drop policy if exists "cada quien ve su perfil" on public.perfiles;
create policy "cada quien ve su perfil" on public.perfiles
  for select to authenticated using (id = auth.uid());

-- Crear el perfil automáticamente cuando alguien se registra
create or replace function public.crear_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists al_registrarse on auth.users;
create trigger al_registrarse after insert on auth.users
  for each row execute function public.crear_perfil();

-- ---------------------------------------------------------------------
-- Pagos (los registra el webhook de Stripe)
-- ---------------------------------------------------------------------
create table if not exists public.pagos (
  id        text primary key,                 -- id de la sesión de Stripe Checkout
  usuario   uuid not null references auth.users (id) on delete cascade,
  plan      text not null,
  dias      int  not null,
  monto     int  not null,                    -- en centavos
  moneda    text not null,
  creado    timestamptz not null default now()
);

alter table public.pagos enable row level security;

drop policy if exists "cada quien ve sus pagos" on public.pagos;
create policy "cada quien ve sus pagos" on public.pagos
  for select to authenticated using (usuario = auth.uid());

-- Registra un pago y alarga el acceso. Si Stripe manda el mismo evento dos
-- veces, el segundo no hace nada (el id de la sesión ya existe).
create or replace function public.registrar_pago(
  p_sesion text, p_usuario uuid, p_plan text, p_dias int, p_monto int, p_moneda text
) returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  nuevo timestamptz;
begin
  insert into public.pagos (id, usuario, plan, dias, monto, moneda)
  values (p_sesion, p_usuario, p_plan, p_dias, p_monto, p_moneda)
  on conflict (id) do nothing;

  if not found then
    select acceso_hasta into nuevo from public.perfiles where id = p_usuario;
    return nuevo;
  end if;

  insert into public.perfiles (id) values (p_usuario) on conflict (id) do nothing;

  update public.perfiles
     set acceso_hasta = greatest(coalesce(acceso_hasta, now()), now()) + make_interval(days => p_dias)
   where id = p_usuario
  returning acceso_hasta into nuevo;

  return nuevo;
end $$;

revoke all on function public.registrar_pago(text, uuid, text, int, int, text) from public, anon, authenticated;
grant execute on function public.registrar_pago(text, uuid, text, int, int, text) to service_role;
