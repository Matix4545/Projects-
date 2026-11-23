-- =====================================================================
-- ChambaRadar · Boletín semanal "5 vacantes remotas en dólares"
-- Correr DESPUÉS de 20_landing_remoto_dolares.sql. Se puede correr más de una vez.
--
-- Cada semana, la función programada netlify/functions/boletin.mts pide aquí
-- las 5 vacantes de la semana y los suscriptores que toca; manda los correos
-- con Resend y marca el envío. Las 5 son remotas, aceptan México, con sueldo
-- creíble en dólares, y no se repiten de un boletín a otro (30 días).
-- Los suscriptores reciben la vacante COMPLETA (empresa y enlace): es el regalo.
-- =====================================================================

alter table public.suscriptores add column if not exists ultimo_envio timestamptz;

-- Vacantes que ya salieron en un boletín (para no repetirlas)
create table if not exists public.boletin_enviados (
  vacante  text not null,
  fecha    date not null default current_date,
  primary key (vacante, fecha)
);
alter table public.boletin_enviados enable row level security;

-- Las 5 de la semana: sueldo en dólares, áreas masivas y nivel de entrada primero, lo más nuevo; sin repetir 30 días
create or replace function public.boletin_vacantes(p_clave text, p_pais text default 'MX', p_n int default 5)
returns jsonb language sql security definer set search_path = public as $$
  select case when clave_valida(p_clave) then coalesce((
    select jsonb_agg(to_jsonb(v) - 'creada' - 'descripcion' - 'rep' - 'orden' - 'creible' - 'apta' order by orden) from (
      select v.*, row_number() over (
        order by (v.id not in (select vacante from boletin_enviados where fecha > current_date - 30))::int desc,
                 (v.categoria in ('atencion-clientes', 'ventas', 'operaciones', 'recursos-humanos', 'otros', 'marketing', 'finanzas', 'banca', 'turismo'))::int desc,
                 (v.nivel in ('practicante', 'junior', 'intermedio'))::int desc,
                 (v.periodo in ('mes', 'hora'))::int desc,
                 v.publicada desc, v.id) as orden
        from (
          -- La misma vacante en varias ciudades cuenta una vez
          select x.*, sueldo_creible(x) as creible, apta_remoto_dolares(x) as apta,
                 row_number() over (partition by x.empresa_slug, lower(x.titulo) order by (upper(coalesce(nullif(p_pais, ''), 'MX')) = any(x.paises))::int desc, x.publicada desc, x.id) as rep
            from vacantes x
           where x.activa and x.acepta_latam and x.modalidad = 'remoto'
             and (cardinality(x.paises) = 0 or upper(coalesce(nullif(p_pais, ''), 'MX')) = any(x.paises))
             and x.moneda = 'USD'
        ) v
       where v.rep = 1 and v.creible and v.apta
         and v.titulo !~* '(senior|\msr\M|lead|principal|director|head of|staff|enterprise|strategic|manager|gerente)'
         and not (v.paises = '{}' and v.ubicacion ~* 'united states|\musa?\M')
    ) v where orden <= greatest(1, least(coalesce(p_n, 5), 10))
  ), '[]'::jsonb) end;
$$;
revoke all on function public.boletin_vacantes(text, text, int) from public;
grant execute on function public.boletin_vacantes(text, text, int) to anon, authenticated;

-- Suscriptores activos que no han recibido boletín en 6 días (por lotes de 100)
create or replace function public.boletin_suscriptores(p_clave text, p_limite int default 100)
returns jsonb language sql security definer set search_path = public as $$
  select case when clave_valida(p_clave) then coalesce((
    select jsonb_agg(jsonb_build_object('id', id, 'correo', correo, 'token', token, 'pais', pais) order by creado)
      from (select * from suscriptores where baja is null and (ultimo_envio is null or ultimo_envio < now() - interval '6 days')
             order by creado limit greatest(1, least(coalesce(p_limite, 100), 100))) s
  ), '[]'::jsonb) end;
$$;
revoke all on function public.boletin_suscriptores(text, int) from public;
grant execute on function public.boletin_suscriptores(text, int) to anon, authenticated;

create or replace function public.marcar_boletin_enviado(p_clave text, p_ids bigint[], p_vacantes text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not clave_valida(p_clave) then raise exception 'clave inválida'; end if;
  update suscriptores set ultimo_envio = now() where id = any(p_ids);
  insert into boletin_enviados (vacante) select unnest(p_vacantes) on conflict do nothing;
end $$;
revoke all on function public.marcar_boletin_enviado(text, bigint[], text[]) from public;
grant execute on function public.marcar_boletin_enviado(text, bigint[], text[]) to anon, authenticated;

-- Baja desde el correo (el token es secreto y único)
create or replace function public.baja_boletin(p_token uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update suscriptores set baja = now() where token = p_token and baja is null;
  return found;
end $$;
grant execute on function public.baja_boletin(uuid) to anon, authenticated;
