-- =====================================================================
-- ChambaRadar · Vacantes públicas (para su página propia y Google for Jobs)
-- Correr DESPUÉS de 13_campanas.sql. Se puede correr más de una vez.
--
-- Solo las vacantes que publican los negocios en ChambaRadar ("directa:…"),
-- que ya se ven completas para todos. Las de las páginas de las empresas
-- siguen detrás del muro.
-- =====================================================================

create or replace function public.vacantes_publicas(p_id text default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(v) - 'creada' order by v.publicada desc), '[]'::jsonb)
    from vacantes v
   where v.activa and v.id like 'directa:%' and (p_id is null or v.id = p_id);
$$;
revoke all on function public.vacantes_publicas(text) from public;
grant execute on function public.vacantes_publicas(text) to anon, authenticated;
