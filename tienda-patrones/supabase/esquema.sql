-- Ejecuta esto una vez en Supabase → SQL Editor.

-- 1) Registro de pedidos pagados (sirve también para no mandar el correo dos veces)
create table if not exists public.pedidos (
  id          text primary key,          -- "mp:123456789" o "stripe:cs_..."
  proveedor   text not null,             -- "mp" o "stripe"
  correo      text,
  referencia  text not null,             -- patrones y licencias comprados (firmado)
  total       numeric,
  moneda      text,
  creado      timestamptz not null default now()
);

-- Nadie del público puede leer ni escribir; solo el servidor con la llave de servicio.
alter table public.pedidos enable row level security;

-- 2) Bucket PRIVADO para los archivos de los patrones
insert into storage.buckets (id, name, public)
values ('patrones', 'patrones', false)
on conflict (id) do update set public = false;

-- Estructura de archivos dentro del bucket:
--   patrones/<slug>/carta.pdf
--   patrones/<slug>/a4.pdf
--   patrones/<slug>/plotter.pdf
--   patrones/<slug>/proyector.pdf
--   patrones/<slug>/dxf.dxf
--   patrones/<slug>/instructivo.pdf

-- Ventas por mes (consulta útil para ti):
-- select date_trunc('month', creado) as mes, count(*), sum(total) from pedidos group by 1 order by 1 desc;
