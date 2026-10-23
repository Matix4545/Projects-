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
-- REPORTES CON PIN: baches, drenaje, alumbrado, banquetas y baldíos (ubicación exacta)
-- (los tipos permitidos se amplían más abajo, en CAMBIOS POSTERIORES)
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

-- Avisos al administrador cada N reportes: guarda el último hito avisado
-- (p. ej. ultimo = 3 con avisos cada 100 → ya se avisó de los 300 reportes)
create table if not exists public.hitos (
  id     int primary key default 1 check (id = 1),
  ultimo int not null default 0
);
insert into public.hitos (id, ultimo)
values (1, ((select count(*) from public.reportes_agua) + (select count(*) from public.reportes_pin))::int / 100)
on conflict (id) do nothing;

-- Nuevos tipos de pin: alumbrado, banquetas y baldíos
alter table public.reportes_pin drop constraint if exists reportes_pin_tipo_check;
alter table public.reportes_pin drop constraint if exists subtipo_valido;
alter table public.reportes_pin add constraint subtipo_valido check (
  (tipo = 'bache'     and subtipo in ('chico', 'mediano', 'grande', 'peligroso')) or
  (tipo = 'drenaje'   and subtipo in ('tapado', 'aguas_negras', 'sin_tapa', 'mal_olor')) or
  (tipo = 'alumbrado' and subtipo in ('apagada', 'parpadea', 'poste_danado', 'cables_expuestos')) or
  (tipo = 'banqueta'  and subtipo in ('quebrada', 'incompleta', 'obstruida')) or
  (tipo = 'baldio'    and subtipo in ('basura', 'maleza', 'quema', 'escombro')) or
  (tipo = 'calle_cerrada' and subtipo in ('obra', 'inundada', 'accidente', 'otro_cierre')) or
  (tipo = 'calle_baches'  and subtipo in ('mitad', 'toda'))
);

-- Calles cerradas y calles con baches: se guardan como un tramo (línea).
-- "ubicacion" guarda el punto medio del tramo (para colonia, mapa de calor y listados).
alter table public.reportes_pin add column if not exists trazo extensions.geometry(LineString, 4326);
alter table public.reportes_pin drop constraint if exists trazo_solo_en_calles;
alter table public.reportes_pin add constraint trazo_solo_en_calles check (
  (tipo in ('calle_cerrada', 'calle_baches')) = (trazo is not null)
);

-- Zonas "oficiales": colonias importadas de un archivo (IMIP, catastro, dibujadas a mano…).
-- Usan la columna osm_id como identificador externo (p. ej. "archivo/las-misiones").
alter table public.zonas drop constraint if exists zonas_fuente_check;
alter table public.zonas add constraint zonas_fuente_check check (fuente in ('osm', 'h3', 'oficial'));

-- Notas privadas del equipo sobre un reporte (p. ej. "ya se le avisó a OOMAPASC").
-- Nunca se muestran al público: solo las leen y escriben las rutas /api/equipo.
create table if not exists public.notas_pin (
  id        bigint generated always as identity primary key,
  pin_id    bigint not null references public.reportes_pin (id) on delete cascade,
  texto     text   not null check (char_length(texto) between 1 and 500),
  autor     text   check (char_length(autor) <= 40),
  creado_en timestamptz not null default now()
);
create index if not exists notas_pin_pin_idx on public.notas_pin (pin_id, creado_en);

-- Secciones electorales del INE (solo Cajeme). Uso interno del equipo: nunca son públicas.
-- Se cargan con scripts/importar-secciones.mjs (o el workflow "Importar secciones electorales").
create table if not exists public.secciones (
  id               bigint generated always as identity primary key,
  seccion          int    not null unique,
  distrito_local   int,
  distrito_federal int,
  geom             extensions.geometry(MultiPolygon, 4326) not null
);
create index if not exists secciones_geom_idx on public.secciones using gist (geom);

-- Rugosidad medida con el celular ("Medir mi recorrido", /medir).
-- Cada fila es un tramo de ~100 m. "sesion" es un id al azar por recorrido (no identifica a la
-- persona) para poder calibrar por vehículo. Nunca se guarda la hora exacta ni el inicio/final.
create table if not exists public.tramos_rugosidad (
  id         bigint generated always as identity primary key,
  sesion     uuid not null,
  fecha      date not null,
  vehiculo   text not null check (vehiculo in ('auto', 'camioneta', 'pickup', 'moto', 'otro')),
  trazo      extensions.geometry(LineString, 4326) not null,
  largo_m    real not null,
  vel_kmh    real not null,
  rms        real not null,
  golpes     extensions.geometry(MultiPoint, 4326),
  n_golpes   int not null default 0,
  hz         real,
  creado_en  timestamptz not null default now()
);
create index if not exists tramos_rugosidad_geom_idx  on public.tramos_rugosidad using gist (trazo);
create index if not exists tramos_rugosidad_fecha_idx on public.tramos_rugosidad (fecha desc);
