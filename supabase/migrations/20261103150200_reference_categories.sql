-- =============================================================================
-- PAYSAN — Lot 1 — Référentiel des catégories de produits (PRODUCT_SPEC §4.1)
-- Données de référence (pas des données de démonstration). La liste reste à
-- confirmer (§15.2) : l'admin peut la modifier sans migration.
-- =============================================================================
insert into public.categories (name, slug, sort_order) values
  ('Fruits et légumes', 'fruits-legumes',   10),
  ('Viande',            'viande',           20),
  ('Volailles',         'volailles',        30),
  ('Produits laitiers', 'produits-laitiers',40),
  ('Fromage',           'fromage',          50),
  ('Lait',              'lait',             60),
  ('Œufs',              'oeufs',            70),
  ('Miel',              'miel',             80),
  ('Pain et céréales',  'pain-cereales',    90),
  ('Boissons',          'boissons',        100),
  ('Autres',            'autres',          110)
on conflict (slug) do nothing;
