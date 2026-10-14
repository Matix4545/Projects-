-- =====================================================================
-- Reporta Cajeme · 05 · Borrar los DATOS DE PRUEBA
-- Córrelo antes de anunciar la app al público.
-- Solo borra lo que creó 04_datos_prueba.sql; los reportes reales no se tocan.
-- =====================================================================

delete from public.denuncias d
 using public.reportes_agua r
 where d.objetivo_tipo = 'agua' and d.objetivo_id = r.id and r.dispositivo_hash like 'prueba-%';

delete from public.denuncias d
 using public.reportes_pin p
 where d.objetivo_tipo = 'pin' and d.objetivo_id = p.id and p.dispositivo_hash like 'prueba-%';

delete from public.reportes_agua where dispositivo_hash like 'prueba-%';
delete from public.reportes_pin  where dispositivo_hash like 'prueba-%';  -- sus votos se borran en cascada
delete from public.limite_ip     where ip_hash = 'prueba';

-- Reajusta el contador de avisos al total real (para no saltarse el aviso de los 100)
update public.hitos
   set ultimo = ((select count(*) from public.reportes_agua) + (select count(*) from public.reportes_pin))::int / 100
 where id = 1;
