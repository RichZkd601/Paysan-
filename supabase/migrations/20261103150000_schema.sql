-- =============================================================================
-- PAYSAN — Lot 1 — Schéma initial (PRODUCT_SPEC §8)
-- =============================================================================
-- Règle §2 : aucune colonne de mise en avant (boost, priority, sponsored,
-- featured…) sur producers ou sales_points. Un test automatisé le vérifie.
-- =============================================================================

create extension if not exists postgis with schema extensions;

-- -----------------------------------------------------------------------------
-- Types énumérés
-- -----------------------------------------------------------------------------

-- Rôle applicatif. Le « visiteur » n'a pas de compte (rôle Postgres anon).
create type public.user_role as enum ('consumer', 'producer', 'admin');

-- Cycle de vie d'une fiche producteur (§4.2, §4.3).
create type public.producer_status as enum (
  'draft',           -- brouillon, visible par son propriétaire uniquement
  'pending_review',  -- soumise, en attente de validation admin
  'published',       -- publique
  'suspended',       -- masquée par un admin
  'archived'         -- retirée définitivement (suppression logique)
);

-- Types de points de vente (filtres §4.1). Liste à confirmer (§15.2) :
-- toute évolution passe par une nouvelle migration.
create type public.sales_point_type as enum ('farm', 'market', 'shop', 'vending_machine');

-- État d'un point de vente (désactivation / suppression logique, §4.2).
create type public.sales_point_status as enum ('active', 'inactive', 'archived');

-- Origine de la position (§7.1 règle 6) : la correction manuelle prime.
create type public.location_source as enum ('geocoded', 'manual');

create type public.report_status as enum ('open', 'resolved', 'dismissed');

create type public.slug_entity as enum ('producer', 'sales_point');

-- -----------------------------------------------------------------------------
-- Fonctions utilitaires
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles : un profil par compte (créé automatiquement, cf. migration RLS)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  role         public.user_role not null default 'consumer',
  display_name text check (display_name is null or char_length(display_name) between 1 and 80),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- producers
-- -----------------------------------------------------------------------------
create table public.producers (
  id                uuid primary key default gen_random_uuid(),
  owner_user_id     uuid references auth.users (id) on delete set null,
  name              text not null check (char_length(name) between 2 and 120),
  slug              text not null unique
                      check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  description       text check (description is null or char_length(description) <= 2000),
  photos            text[] not null default '{}'
                      check (cardinality(photos) <= 10),
  phone             text check (phone is null or char_length(phone) <= 30),
  website           text check (website is null or website ~* '^https?://'),
  social_links      jsonb not null default '{}'::jsonb
                      check (jsonb_typeof(social_links) = 'object'),
  status            public.producer_status not null default 'draft',
  verified_at       timestamptz,
  last_confirmed_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index producers_owner_idx on public.producers (owner_user_id);
create index producers_status_idx on public.producers (status);

create trigger producers_set_updated_at
  before update on public.producers
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- categories (référentiel administré) et liaison N-N
-- -----------------------------------------------------------------------------
create table public.categories (
  id         smallint generated always as identity primary key,
  name       text not null unique check (char_length(name) between 2 and 60),
  slug       text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- Ordre d'affichage des FILTRES uniquement, jamais du tri des producteurs (§8).
  sort_order smallint not null default 0,
  active     boolean not null default true
);

create table public.producer_categories (
  producer_id uuid not null references public.producers (id) on delete cascade,
  category_id smallint not null references public.categories (id) on delete cascade,
  primary key (producer_id, category_id)
);

create index producer_categories_category_idx on public.producer_categories (category_id);

-- -----------------------------------------------------------------------------
-- sales_points : chaque lieu a sa propre adresse, position et ses horaires
-- -----------------------------------------------------------------------------
create table public.sales_points (
  id                    uuid primary key default gen_random_uuid(),
  producer_id           uuid not null references public.producers (id) on delete cascade,
  name                  text not null check (char_length(name) between 2 and 120),
  type                  public.sales_point_type not null,
  slug                  text not null unique
                          check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 140),
  address_line          text check (address_line is null or char_length(address_line) <= 200),
  postal_code           text check (postal_code is null or postal_code ~ '^[0-9]{5}$'),
  city                  text not null check (char_length(city) between 1 and 100),
  insee_code            text check (insee_code is null or insee_code ~ '^[0-9][0-9AB][0-9]{3}$'),
  country_code          char(2) not null default 'FR',
  location              extensions.geography(Point, 4326) not null,
  geocode_score         real check (geocode_score is null or geocode_score between 0 and 1),
  geocode_type          text,  -- housenumber / street / locality / municipality (BAN)
  location_source       public.location_source not null default 'geocoded',
  location_confirmed_at timestamptz,
  hours_variable        boolean not null default false, -- « horaires variables » (§4.2)
  notes                 text check (notes is null or char_length(notes) <= 1000),
  status                public.sales_point_status not null default 'active',
  last_confirmed_at     timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index sales_points_producer_idx on public.sales_points (producer_id);
create index sales_points_location_gix on public.sales_points using gist (location);
create index sales_points_type_idx on public.sales_points (type);

create trigger sales_points_set_updated_at
  before update on public.sales_points
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- opening_hours : plusieurs créneaux par jour ; un jour sans créneau = fermé
-- -----------------------------------------------------------------------------
create table public.opening_hours (
  id             uuid primary key default gen_random_uuid(),
  sales_point_id uuid not null references public.sales_points (id) on delete cascade,
  day_of_week    smallint not null check (day_of_week between 1 and 7), -- ISO : 1 = lundi
  opens_at       time not null,
  closes_at      time not null,
  slot_order     smallint not null default 1 check (slot_order between 1 and 6),
  valid_from     date,  -- prévu pour la saisonnalité (non exposé au MVP, §15.2)
  valid_until    date,
  check (closes_at > opens_at),
  check (valid_until is null or valid_from is null or valid_until >= valid_from),
  unique (sales_point_id, day_of_week, slot_order, valid_from)
);

create index opening_hours_sales_point_idx on public.opening_hours (sales_point_id);

-- -----------------------------------------------------------------------------
-- favorites (privés)
-- -----------------------------------------------------------------------------
create table public.favorites (
  user_id     uuid not null references auth.users (id) on delete cascade,
  producer_id uuid not null references public.producers (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, producer_id)
);

create index favorites_producer_idx on public.favorites (producer_id);

-- -----------------------------------------------------------------------------
-- reports : signalements privés, modérés par l'admin
-- -----------------------------------------------------------------------------
create table public.reports (
  id             uuid primary key default gen_random_uuid(),
  sales_point_id uuid references public.sales_points (id) on delete set null,
  producer_id    uuid references public.producers (id) on delete set null,
  reporter_email text check (reporter_email is null or (reporter_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
                                                       and char_length(reporter_email) <= 254)),
  reason         text not null check (reason in ('wrong_hours', 'wrong_address', 'closed',
                                                 'wrong_products', 'duplicate', 'other')),
  details        text check (details is null or char_length(details) <= 1000),
  status         public.report_status not null default 'open',
  created_at     timestamptz not null default now(),
  resolved_at    timestamptz,
  check (sales_point_id is not null or producer_id is not null)
);

create index reports_status_idx on public.reports (status, created_at);

-- -----------------------------------------------------------------------------
-- producer_invites : revendication de fiche (logique de revendication au Lot 6)
-- -----------------------------------------------------------------------------
create table public.producer_invites (
  id          uuid primary key default gen_random_uuid(),
  producer_id uuid not null references public.producers (id) on delete cascade,
  email       text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  token_hash  text not null unique,  -- seul le hash est stocké, jamais le jeton
  expires_at  timestamptz not null,
  claimed_at  timestamptz,
  claimed_by  uuid references auth.users (id) on delete set null,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index producer_invites_producer_idx on public.producer_invites (producer_id);

-- -----------------------------------------------------------------------------
-- slug_aliases : anciens slugs → URL courante (§6)
-- -----------------------------------------------------------------------------
create table public.slug_aliases (
  id          uuid primary key default gen_random_uuid(),
  entity_type public.slug_entity not null,
  entity_id   uuid not null,
  old_slug    text not null,
  created_at  timestamptz not null default now(),
  unique (entity_type, old_slug)
);

create index slug_aliases_entity_idx on public.slug_aliases (entity_type, entity_id);

-- Quand un slug change, l'ancien est conservé comme alias (les QR codes déjà
-- imprimés et liens partagés continuent de fonctionner).
create or replace function public.keep_old_slug()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.slug is distinct from old.slug then
    insert into public.slug_aliases (entity_type, entity_id, old_slug)
    values (tg_argv[0]::public.slug_entity, old.id, old.slug)
    on conflict (entity_type, old_slug)
      do update set entity_id = excluded.entity_id, created_at = now();
    -- Si le nouveau slug était un ancien alias de cette même entité, on le retire.
    delete from public.slug_aliases
     where entity_type = tg_argv[0]::public.slug_entity
       and old_slug = new.slug
       and entity_id = new.id;
  end if;
  return new;
end;
$$;

create trigger producers_keep_old_slug
  after update of slug on public.producers
  for each row execute function public.keep_old_slug('producer');

create trigger sales_points_keep_old_slug
  after update of slug on public.sales_points
  for each row execute function public.keep_old_slug('sales_point');
