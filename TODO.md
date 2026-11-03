# Suivi d'avancement — PAYSAN

Référence : `PRODUCT_SPEC.md` §12 (lots) et §13 (tests d'acceptation).
Une case n'est cochée que si elle a été **testée**.

## Lot 0 — Setup ✅ terminé (03/11/2026)

- [x] Next.js (App Router) + TypeScript strict (+ `noUncheckedIndexedAccess`)
- [x] Tailwind CSS
- [x] ESLint (config Next.js + TypeScript) et Prettier
- [x] Vitest + premiers tests (env, config)
- [x] Configuration centralisée du nom et de l'URL de base (`src/config/site.ts`)
- [x] Validation des variables d'environnement publiques (zod)
- [x] `.env.example` ; `.env*` ignorés par git
- [x] Script `check:secrets`
- [x] CI GitHub Actions (lint, typecheck, format, tests, secrets, build)
- [x] README
- [x] Critères de sortie vérifiés : l'app démarre en local, build OK, aucun secret dans le dépôt

Limites connues :

- Le dépôt est local (pas encore poussé sur GitHub) : la CI n'a donc pas encore tourné sur GitHub, seulement localement (mêmes commandes).
- Page d'accueil volontairement minimale, sans carte ni données.

## Lot 1 — DB & auth ⏳ prochain

- [ ] Projet Supabase (dev) + Supabase CLI en local
- [ ] Migrations SQL versionnées (PostGIS, tables §8)
- [ ] Profils et rôles (visiteur / producteur / admin)
- [ ] Politiques RLS sur toutes les tables
- [ ] Tests d'accès visiteur / producteur / admin

## Lots suivants

- [ ] Lot 2 — Espace producteur
- [ ] Lot 3 — Pages publiques
- [ ] Lot 4 — Carte & recherche
- [ ] Lot 5 — Favoris & signalements
- [ ] Lot 6 — Admin & invitations
- [ ] Lot 7 — Durcissement
