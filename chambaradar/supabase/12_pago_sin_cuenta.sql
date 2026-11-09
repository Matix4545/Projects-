-- =====================================================================
-- ChambaRadar · Pagar sin crear cuenta antes
-- Correr DESPUÉS de 11_nacional.sql. Se puede correr más de una vez.
--
-- El botón de pagar manda directo a Stripe; ahí la persona pone su correo.
-- Si ya tiene cuenta con ese correo, el acceso se activa al momento. Si no,
-- el pago queda guardado con el correo y se aplica en cuanto entra por
-- primera vez con él (enlace al correo).
-- =====================================================================

create table if not exists public.pagos_por_correo (
  id         text primary key,                  -- sesión de Stripe Checkout
  correo     text not null,
  plan       text not null,
  dias       int  not null,
  monto      int  not null,
  moneda     text not null,
  creado     timestamptz not null default now(),
  aplicado   timestamptz,
  usuario    uuid references auth.users (id) on delete set null
);
create index if not exists pagos_por_correo_correo on public.pagos_por_correo (correo) where aplicado is null;
alter table public.pagos_por_correo enable row level security;

create or replace function public.registrar_pago_por_correo(
  p_clave text, p_sesion text, p_correo text, p_plan text, p_dias int, p_monto int, p_moneda text
) returns text language plpgsql security definer set search_path = public as $$
declare
  c text := lower(trim(coalesce(p_correo, '')));
  u uuid;
begin
  if not clave_valida(p_clave) then raise exception 'clave inválida'; end if;
  if c !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'correo inválido'; end if;
  select id into u from perfiles where lower(email) = c limit 1;
  if u is not null then
    perform registrar_pago(p_clave, p_sesion, u, p_plan, p_dias, p_monto, p_moneda);
    return 'aplicado';
  end if;
  insert into pagos_por_correo (id, correo, plan, dias, monto, moneda)
  values (p_sesion, c, p_plan, p_dias, p_monto, p_moneda)
  on conflict (id) do nothing;
  return 'pendiente';
end $$;
revoke all on function public.registrar_pago_por_correo(text, text, text, text, int, int, text) from public;
grant execute on function public.registrar_pago_por_correo(text, text, text, text, int, int, text) to anon, authenticated;

-- Al crear la cuenta: el perfil y, si pagó antes con ese correo, su acceso
create or replace function public.crear_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  p record;
begin
  insert into public.perfiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  for p in select * from pagos_por_correo where correo = lower(new.email) and aplicado is null order by creado loop
    insert into pagos (id, usuario, plan, dias, monto, moneda) values (p.id, new.id, p.plan, p.dias, p.monto, p.moneda)
    on conflict (id) do nothing;
    update perfiles set acceso_hasta = greatest(coalesce(acceso_hasta, now()), now()) + make_interval(days => p.dias)
     where id = new.id;
    update pagos_por_correo set aplicado = now(), usuario = new.id where id = p.id;
  end loop;
  return new;
end $$;
revoke all on function public.crear_perfil() from public, anon, authenticated;
