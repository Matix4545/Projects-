-- =====================================================================
-- ChambaRadar · Creador de CV
-- Correr DESPUÉS de 07_gratis_obregon.sql. Se puede correr más de una vez.
--
-- Un CV por cuenta, guardado como JSON (la app lo valida con limpiarCv() en
-- lib/cv.ts). La tabla no se puede leer directo (RLS sin políticas): solo
-- con mi_cv() y guardar_cv(), que usan la sesión de quien pregunta.
-- =====================================================================

create table if not exists public.curriculums (
  usuario     uuid primary key references auth.users (id) on delete cascade,
  datos       jsonb not null check (jsonb_typeof(datos) = 'object' and pg_column_size(datos) < 60000),
  actualizado timestamptz not null default now()
);
alter table public.curriculums enable row level security;

create or replace function public.mi_cv()
returns jsonb language sql stable security definer set search_path = public as $$
  select datos from curriculums where usuario = auth.uid();
$$;
revoke all on function public.mi_cv() from public, anon;
grant execute on function public.mi_cv() to authenticated;

create or replace function public.guardar_cv(p_datos jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Inicia sesión para guardar tu CV'; end if;
  if jsonb_typeof(p_datos) <> 'object' or pg_column_size(p_datos) >= 60000 then raise exception 'CV inválido o demasiado largo'; end if;
  insert into curriculums (usuario, datos, actualizado) values (auth.uid(), p_datos, now())
  on conflict (usuario) do update set datos = excluded.datos, actualizado = now();
end $$;
revoke all on function public.guardar_cv(jsonb) from public, anon;
grant execute on function public.guardar_cv(jsonb) to authenticated;
