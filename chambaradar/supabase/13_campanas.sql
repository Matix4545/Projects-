-- ChambaRadar · Campañas de anuncios en el contador (utm_source/utm_campaign)
-- Correr DESPUÉS de 12_pago_sin_cuenta.sql. Se puede correr más de una vez.
alter table public.eventos add column if not exists campana text;
