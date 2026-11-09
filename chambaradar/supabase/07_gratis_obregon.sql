-- =====================================================================
-- ChambaRadar · Acceso gratis para la gente de Cd. Obregón (Sonora)
-- Correr DESPUÉS de 06_publicaciones.sql. Se puede correr más de una vez.
--
-- El sitio es para todo México y LATAM. Quien entra desde Sonora (según su
-- IP, lo detecta el servidor con el encabezado x-nf-geo de Netlify) ve todo
-- gratis: el servidor manda la clave privada de la app en el encabezado
-- "x-chambaradar-local" y tiene_acceso() la revisa. La clave nunca llega al
-- navegador, así que nadie puede fingirlo desde fuera.
--
-- Siempre completas para todos: las vacantes que publican los negocios
-- ('directa:...', ver vacante_json en 06_publicaciones.sql).
--
-- Para empezar a cobrar (cuando estén los Payment Links en Netlify):
--   update config_privada set valor = 'si' where nombre = 'muro_activo';
-- =====================================================================

create or replace function public.tiene_acceso()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select valor from config_privada where nombre = 'muro_activo'), 'si') = 'no'
      or exists (select 1 from perfiles where id = auth.uid() and acceso_hasta > now())
      or clave_valida(nullif(current_setting('request.headers', true), '')::json->>'x-chambaradar-local');
$$;
grant execute on function public.tiene_acceso() to anon, authenticated;

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
