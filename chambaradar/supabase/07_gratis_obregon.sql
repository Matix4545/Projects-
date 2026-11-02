-- =====================================================================
-- ChambaRadar · Gratis para Obregón, de pago para el resto
-- Correr DESPUÉS de 06_publicaciones.sql. Se puede correr más de una vez.
--
-- Siempre completas y gratis (sin importar el muro de pago):
--   · vacantes en Sonora (incluye Cajeme) y home office abierto a México
--     (lo mismo que cerca_de_obregon)
--   · vacantes publicadas directo por negocios ('directa:...')
-- El resto del catálogo (otras ciudades, LATAM, remoto solo para otros
-- países) se bloquea cuando muro_activo = 'si' y el usuario no ha pagado.
--
-- Para empezar a cobrar (cuando estén los Payment Links en Netlify):
--   update config_privada set valor = 'si' where nombre = 'muro_activo';
-- =====================================================================

create or replace function public.vacante_json(r public.vacantes, acceso boolean, sal text)
returns jsonb language sql stable set search_path = public as $$
  select case when acceso or r.id like 'directa:%' or cerca_de_obregon(r)
    then to_jsonb(r) - 'creada' || jsonb_build_object('bloqueada', false)
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
