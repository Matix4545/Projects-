-- =====================================================================
-- Reporta Cajeme · 01 · Esquema de base de datos
-- Ejecuta este archivo PRIMERO en: Supabase → SQL Editor → New query
-- =====================================================================

-- PostGIS agrega tipos y funciones geográficas (puntos, polígonos, etc.)
create schema if not exists extensions;
create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------------
-- ZONAS: colonias de OpenStreetMap o hexágonos H3 de respaldo
-- ---------------------------------------------------------------------
create table if not exists public.zonas (
  id        bigint generated always as identity primary key,
  nombre    text not null,
  fuente    text not null check (fuente in ('osm', 'h3')),
  osm_id    text unique,          -- p. ej. "way/123456" o "relation/987"
  h3_index  text unique,
  geom      extensions.geometry(MultiPolygon, 4326) not null
);
create index if not exists zonas_geom_idx on public.zonas using gist (geom);

-- ---------------------------------------------------------------------
-- REPORTES DE AGUA (por colonia). No se guarda el punto exacto.
-- ---------------------------------------------------------------------
do $$ begin
  create type public.estado_agua as enum ('sin_agua', 'baja_presion', 'sucia', 'con_agua');
exception when duplicate_object then null; end $$;

create table if not exists public.reportes_agua (
  id                bigint generated always as identity primary key,
  zona_id           bigint not null references public.zonas (id) on delete cascade,
  estado            public.estado_agua not null,
  detalles_sucia    text[] not null default '{}'
                    check (detalles_sucia <@ array['mal_olor', 'turbia', 'sedimentos', 'color_extrano']),
  comentario        text check (char_length(comentario) <= 280),
  comentario_oculto boolean not null default false,
  denuncias         int not null default 0,
  dispositivo_hash  text not null,
  ip_hash           text not null,
  creado_en         timestamptz not null default now(),
  constraint detalles_solo_si_sucia check (estado = 'sucia' or cardinality(detalles_sucia) = 0)
);
create index if not exists reportes_agua_zona_fecha_idx on public.reportes_agua (zona_id, creado_en desc);
create index if not exists reportes_agua_fecha_idx      on public.reportes_agua (creado_en desc);
create index if not exists reportes_agua_disp_idx       on public.reportes_agua (dispositivo_hash, zona_id, creado_en desc);

-- ---------------------------------------------------------------------
-- REPORTES CON PIN: baches y drenaje (ubicación exacta)
-- ---------------------------------------------------------------------
create table if not exists public.reportes_pin (
  id                bigint generated always as identity primary key,
  tipo              text not null check (tipo in ('bache', 'drenaje')),
  subtipo           text not null,
  ubicacion         extensions.geometry(Point, 4326) not null,
  zona_id           bigint references public.zonas (id) on delete set null,
  foto_ruta         text,
  comentario        text check (char_length(comentario) <= 280),
  comentario_oculto boolean not null default false,
  denuncias         int not null default 0,
  estado            text not null default 'activo' check (estado in ('activo', 'arreglado')),
  confirmaciones    int not null default 0,   -- votos "+1 / yo también lo vi"
  votos_arreglado   int not null default 0,   -- al llegar a 3 → 'arreglado'
  arreglado_en      timestamptz,
  ultima_actividad  timestamptz not null default now(),
  dispositivo_hash  text not null,
  ip_hash           text not null,
  creado_en         timestamptz not null default now(),
  constraint subtipo_valido check (
    (tipo = 'bache'   and subtipo in ('chico', 'mediano', 'grande', 'peligroso')) or
    (tipo = 'drenaje' and subtipo in ('tapado', 'aguas_negras', 'sin_tapa', 'mal_olor'))
  )
);
create index if not exists reportes_pin_geom_idx   on public.reportes_pin using gist (ubicacion);
create index if not exists reportes_pin_estado_idx on public.reportes_pin (estado, ultima_actividad desc);
create index if not exists reportes_pin_fecha_idx  on public.reportes_pin (creado_en desc);

-- ---------------------------------------------------------------------
-- VOTOS sobre pins: un "+1" y un "ya lo arreglaron" por dispositivo
-- ---------------------------------------------------------------------
create table if not exists public.votos_pin (
  pin_id           bigint not null references public.reportes_pin (id) on delete cascade,
  tipo             text not null check (tipo in ('confirmo', 'arreglado')),
  dispositivo_hash text not null,
  creado_en        timestamptz not null default now(),
  primary key (pin_id, tipo, dispositivo_hash)
);

-- ---------------------------------------------------------------------
-- DENUNCIAS de comentarios: 3 denuncias → el comentario se oculta
-- ---------------------------------------------------------------------
create table if not exists public.denuncias (
  objetivo_tipo    text not null check (objetivo_tipo in ('agua', 'pin')),
  objetivo_id      bigint not null,
  dispositivo_hash text not null,
  creado_en        timestamptz not null default now(),
  primary key (objetivo_tipo, objetivo_id, dispositivo_hash)
);

-- ---------------------------------------------------------------------
-- LÍMITE POR IP: cuántos reportes lleva cada IP (hasheada) por día
-- ---------------------------------------------------------------------
create table if not exists public.limite_ip (
  ip_hash text not null,
  dia     date not null,
  total   int  not null default 0,
  primary key (ip_hash, dia)
);

-- =====================================================================
-- CAMBIOS POSTERIORES (se pueden correr varias veces sin problema)
-- =====================================================================

-- Fotos denunciables: con 3 denuncias la foto deja de mostrarse
alter table public.reportes_pin add column if not exists foto_oculta    boolean not null default false;
alter table public.reportes_pin add column if not exists denuncias_foto int     not null default 0;

alter table public.denuncias drop constraint if exists denuncias_objetivo_tipo_check;
alter table public.denuncias add  constraint denuncias_objetivo_tipo_check
  check (objetivo_tipo in ('agua', 'pin', 'foto'));

-- Votos "ya lo arreglaron" y denuncias: además de 1 por dispositivo, 1 por conexión (IP).
-- Así nadie puede ocultar un pin o un comentario solo con borrar sus cookies.
alter table public.votos_pin add column if not exists ip_hash text;
alter table public.denuncias add column if not exists ip_hash text;
create unique index if not exists votos_pin_arreglado_una_ip
  on public.votos_pin (pin_id, ip_hash) where tipo = 'arreglado' and ip_hash is not null;
create unique index if not exists denuncias_una_ip
  on public.denuncias (objetivo_tipo, objetivo_id, ip_hash) where ip_hash is not null;
