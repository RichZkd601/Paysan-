-- =============================================================================
-- PAYSAN — Lot 1 — Profils, rôles et sécurité (PRODUCT_SPEC §3, §9)
-- =============================================================================
-- Principes :
--  * RLS activée sur TOUTES les tables exposées.
--  * Privilèges explicites (défense en profondeur) : on révoque tout puis on
--    accorde le strict nécessaire à anon / authenticated.
--  * Le rôle admin est lu en base (profiles.role), jamais fourni par le client.
--  * Le rôle service_role (clé secrète, serveur uniquement) contourne la RLS.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Fonctions d'aide aux politiques
-- SECURITY DEFINER + search_path vide : évitent la récursion RLS et le
-- détournement de search_path. Elles ne renvoient que des booléens.
-- -----------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
     where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function public.owns_producer(p_producer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.producers
     where id = p_producer_id and owner_user_id = (select auth.uid())
  );
$$;

create or replace function public.producer_is_public(p_producer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.producers
     where id = p_producer_id and status = 'published'
  );
$$;

create or replace function public.owns_sales_point(p_sales_point_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.sales_points sp
      join public.producers p on p.id = sp.producer_id
     where sp.id = p_sales_point_id and p.owner_user_id = (select auth.uid())
  );
$$;

create or replace function public.sales_point_is_public(p_sales_point_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.sales_points sp
      join public.producers p on p.id = sp.producer_id
     where sp.id = p_sales_point_id and sp.status = 'active' and p.status = 'published'
  );
$$;

-- -----------------------------------------------------------------------------
-- Création automatique du profil à l'inscription (rôle « consumer » par défaut)
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 80), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Changement de rôle : réservé aux admins (ou au service_role côté serveur)
-- -----------------------------------------------------------------------------
create or replace function public.set_user_role(p_user_id uuid, p_role public.user_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Seul un administrateur peut changer un rôle'
      using errcode = '42501';
  end if;
  update public.profiles set role = p_role where id = p_user_id;
  if not found then
    raise exception 'Profil introuvable' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.set_user_role(uuid, public.user_role) from public, anon;
grant execute on function public.set_user_role(uuid, public.user_role) to authenticated;

-- Un compte qui crée sa première fiche devient « producer » (informatif :
-- les droits réels reposent sur owner_user_id + RLS).
create or replace function public.promote_owner_to_producer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.owner_user_id is not null then
    update public.profiles
       set role = 'producer'
     where id = new.owner_user_id and role = 'consumer';
  end if;
  return new;
end;
$$;

revoke execute on function public.promote_owner_to_producer() from public;

create trigger producers_promote_owner
  after insert or update of owner_user_id on public.producers
  for each row execute function public.promote_owner_to_producer();

-- -----------------------------------------------------------------------------
-- Garde-fou sur les fiches producteur (règles métier non contournables par API)
--  * un non-admin ne peut ni publier, ni suspendre, ni archiver ;
--  * transitions autorisées au propriétaire : draft ↔ pending_review,
--    published → draft (dépublier) ;
--  * owner_user_id, verified_at, created_at : non modifiables par un non-admin ;
--  * last_confirmed_at : uniquement « maintenant » (action « confirmer »).
-- Fonction SECURITY INVOKER : current_user = rôle de l'appelant.
-- -----------------------------------------------------------------------------
create or replace function public.producers_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- service_role, postgres, migrations : pas de restriction.
  if current_user not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'draft';
    new.verified_at := null;
    new.created_at := now();
    if new.last_confirmed_at is not null then
      new.last_confirmed_at := now();
    end if;
    return new;
  end if;

  -- UPDATE
  if new.owner_user_id is distinct from old.owner_user_id then
    raise exception 'Le propriétaire d''une fiche ne peut pas être modifié'
      using errcode = '42501';
  end if;
  if new.verified_at is distinct from old.verified_at
     or new.created_at is distinct from old.created_at then
    raise exception 'Champ réservé à l''administration' using errcode = '42501';
  end if;
  if new.status is distinct from old.status and not (
       (old.status = 'draft' and new.status = 'pending_review')
    or (old.status = 'pending_review' and new.status = 'draft')
    or (old.status = 'published' and new.status = 'draft')
  ) then
    raise exception 'Changement de statut non autorisé (% → %)', old.status, new.status
      using errcode = '42501';
  end if;
  if new.last_confirmed_at is distinct from old.last_confirmed_at
     and new.last_confirmed_at is not null then
    new.last_confirmed_at := now();
  end if;
  return new;
end;
$$;

create trigger producers_guard
  before insert or update on public.producers
  for each row execute function public.producers_guard();

-- -----------------------------------------------------------------------------
-- Activation de la RLS
-- -----------------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.producers           enable row level security;
alter table public.categories          enable row level security;
alter table public.producer_categories enable row level security;
alter table public.sales_points        enable row level security;
alter table public.opening_hours       enable row level security;
alter table public.favorites           enable row level security;
alter table public.reports             enable row level security;
alter table public.producer_invites    enable row level security;
alter table public.slug_aliases        enable row level security;

-- -----------------------------------------------------------------------------
-- Privilèges de table explicites
-- -----------------------------------------------------------------------------
revoke all on
  public.profiles, public.producers, public.categories, public.producer_categories,
  public.sales_points, public.opening_hours, public.favorites, public.reports,
  public.producer_invites, public.slug_aliases
from anon, authenticated;

-- Visiteur (anon) : lecture des données publiques + envoi de signalements.
grant select on
  public.producers, public.categories, public.producer_categories,
  public.sales_points, public.opening_hours, public.slug_aliases
to anon;
grant insert on public.reports to anon;

-- Utilisateur connecté (la RLS restreint ensuite ligne par ligne).
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select, insert, update on public.producers to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, delete on public.producer_categories to authenticated;
grant select, insert, update, delete on public.sales_points to authenticated;
grant select, insert, update, delete on public.opening_hours to authenticated;
grant select, insert, delete on public.favorites to authenticated;
grant select, insert, update, delete on public.reports to authenticated;
grant select, insert, update, delete on public.producer_invites to authenticated;
grant select on public.slug_aliases to authenticated;

-- -----------------------------------------------------------------------------
-- Politiques
-- -----------------------------------------------------------------------------

-- profiles : chacun voit et renomme son profil ; l'admin voit tout.
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- producers
create policy producers_select on public.producers
  for select to anon, authenticated
  using (
    status = 'published'
    or owner_user_id = (select auth.uid())
    or public.is_admin()
  );

create policy producers_insert on public.producers
  for insert to authenticated
  with check (owner_user_id = (select auth.uid()) or public.is_admin());

create policy producers_update on public.producers
  for update to authenticated
  using (owner_user_id = (select auth.uid()) or public.is_admin())
  with check (owner_user_id = (select auth.uid()) or public.is_admin());
-- Pas de DELETE pour les producteurs : suppression logique via status = 'archived'.

-- categories : référentiel public, écrit par l'admin.
create policy categories_select on public.categories
  for select to anon, authenticated
  using (active or public.is_admin());

create policy categories_admin_insert on public.categories
  for insert to authenticated with check (public.is_admin());
create policy categories_admin_update on public.categories
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy categories_admin_delete on public.categories
  for delete to authenticated using (public.is_admin());

-- producer_categories
create policy producer_categories_select on public.producer_categories
  for select to anon, authenticated
  using (
    public.producer_is_public(producer_id)
    or public.owns_producer(producer_id)
    or public.is_admin()
  );

create policy producer_categories_insert on public.producer_categories
  for insert to authenticated
  with check (public.owns_producer(producer_id) or public.is_admin());

create policy producer_categories_delete on public.producer_categories
  for delete to authenticated
  using (public.owns_producer(producer_id) or public.is_admin());

-- sales_points : publics si actifs ET producteur publié.
create policy sales_points_select on public.sales_points
  for select to anon, authenticated
  using (
    (status = 'active' and public.producer_is_public(producer_id))
    or public.owns_producer(producer_id)
    or public.is_admin()
  );

create policy sales_points_insert on public.sales_points
  for insert to authenticated
  with check (public.owns_producer(producer_id) or public.is_admin());

create policy sales_points_update on public.sales_points
  for update to authenticated
  using (public.owns_producer(producer_id) or public.is_admin())
  with check (public.owns_producer(producer_id) or public.is_admin());

-- Suppression physique : admin uniquement (le producteur archive).
create policy sales_points_delete on public.sales_points
  for delete to authenticated
  using (public.is_admin());

-- opening_hours
create policy opening_hours_select on public.opening_hours
  for select to anon, authenticated
  using (
    public.sales_point_is_public(sales_point_id)
    or public.owns_sales_point(sales_point_id)
    or public.is_admin()
  );

create policy opening_hours_insert on public.opening_hours
  for insert to authenticated
  with check (public.owns_sales_point(sales_point_id) or public.is_admin());

create policy opening_hours_update on public.opening_hours
  for update to authenticated
  using (public.owns_sales_point(sales_point_id) or public.is_admin())
  with check (public.owns_sales_point(sales_point_id) or public.is_admin());

create policy opening_hours_delete on public.opening_hours
  for delete to authenticated
  using (public.owns_sales_point(sales_point_id) or public.is_admin());

-- favorites : strictement privés ; uniquement des producteurs publiés.
create policy favorites_select_own on public.favorites
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy favorites_insert_own on public.favorites
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.producer_is_public(producer_id));

create policy favorites_delete_own on public.favorites
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- reports : tout le monde peut signaler, seul l'admin lit et traite.
create policy reports_insert on public.reports
  for insert to anon, authenticated
  with check (status = 'open' and resolved_at is null);

create policy reports_admin_select on public.reports
  for select to authenticated using (public.is_admin());
create policy reports_admin_update on public.reports
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy reports_admin_delete on public.reports
  for delete to authenticated using (public.is_admin());

-- producer_invites : admin uniquement (la revendication passera par une
-- fonction dédiée au Lot 6).
create policy producer_invites_admin_all on public.producer_invites
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- slug_aliases : lisibles seulement si l'entité est publique (pas de fuite
-- des anciens noms de fiches brouillons).
create policy slug_aliases_select on public.slug_aliases
  for select to anon, authenticated
  using (
    public.is_admin()
    or (entity_type = 'producer' and public.producer_is_public(entity_id))
    or (entity_type = 'sales_point' and public.sales_point_is_public(entity_id))
  );
