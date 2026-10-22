-- =====================================================================
-- Reporta Cajeme · 03 · Seguridad (Row Level Security y permisos)
-- Ejecuta este archivo DESPUÉS de 02_funciones.sql
--
-- Modelo:
--   · El público (rol "anon") NO puede leer ni escribir tablas directamente.
--   · El público solo puede ejecutar las funciones de lectura agregada.
--   · Todos los envíos pasan por el servidor de Next.js (/api/...), que
--     verifica Turnstile, límites y groserías y luego inserta con la
--     clave service_role.
-- =====================================================================

-- 1) Activar RLS en todas las tablas, SIN políticas para el público.
--    Sin políticas = nadie (excepto service_role) puede leer o escribir.
alter table public.zonas         enable row level security;
alter table public.reportes_agua enable row level security;
alter table public.reportes_pin  enable row level security;
alter table public.votos_pin     enable row level security;
alter table public.denuncias     enable row level security;
alter table public.limite_ip     enable row level security;
alter table public.hitos         enable row level security;
alter table public.notas_pin     enable row level security;

-- 2) Quitar cualquier permiso directo sobre tablas al público.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- 3) Funciones: por defecto nadie puede ejecutarlas...
revoke execute on all functions in schema public from public, anon, authenticated;

-- ...excepto las de lectura agregada, que son públicas.
grant execute on function public.zonas_geojson()                               to anon, authenticated;
grant execute on function public.estado_zonas(integer)                         to anon, authenticated;
grant execute on function public.detalle_zona(bigint, integer)                 to anon, authenticated;
grant execute on function public.pins_publicos()                               to anon, authenticated;
grant execute on function public.resumen_24h()                                 to anon, authenticated;
grant execute on function public.resumen(integer)                              to anon, authenticated;
grant execute on function public.zona_de_punto(double precision, double precision) to anon, authenticated;

-- 4) El servidor (service_role) puede todo.
--    (Supabase ya da acceso al esquema "extensions"; se repite por si acaso.)
grant usage on schema extensions to anon, authenticated, service_role;
grant usage on schema public to service_role;
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- 5) Que las tablas y funciones que se creen después tampoco queden abiertas.
alter default privileges in schema public revoke all     on tables    from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- 6) Bucket de fotos: lectura pública por URL, escritura solo del servidor.
--    (máx. 1 MB, solo JPEG). No se crean políticas de escritura para el público.
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('fotos', 'fotos', true, 1048576, array['image/jpeg'])
    on conflict (id) do update
      set public = true, file_size_limit = 1048576, allowed_mime_types = array['image/jpeg'];
  end if;
end $$;

-- 7) Que la API de Supabase vea de inmediato las tablas/columnas nuevas.
notify pgrst, 'reload schema';
