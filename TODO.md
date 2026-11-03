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
- [x] Dépôt poussé sur GitHub (`RichZkd601/Paysan-`, branche `main`)

## Lot 1 — DB & auth ✅ terminé côté code (03/11/2026) — application sur Supabase à faire

- [x] Migrations SQL versionnées : PostGIS, 10 tables du §8, index spatial GiST, contraintes
- [x] Référentiel des 11 catégories du §4.1
- [x] Profil créé automatiquement à l'inscription (rôle `consumer`)
- [x] Rôles consumer / producer / admin ; changement de rôle réservé à l'admin
- [x] RLS sur les 10 tables + privilèges explicites (défense en profondeur)
- [x] Garde-fous métier en base : un producteur ne peut ni publier, ni suspendre, ni s'auto-vérifier, ni céder sa fiche
- [x] Alias automatique de l'ancien slug (liens et QR codes déjà distribués)
- [x] 27 tests d'accès visiteur / producteur / admin (`npm run test:db`), vérifiés par test de mutation
- [x] Client Supabase (navigateur, serveur, proxy) ; variables validées, clé secrète refusée côté public
- [x] Connexion par lien magique, confirmation (`token_hash` + `code`), déconnexion POST
- [x] Redirections sûres (pas de redirection ouverte)
- [x] Zones privées : 307 vers `/connexion` sans session ; `requireAdmin` côté serveur
- [x] Job CI `database` (Postgres + PostGIS)
- [ ] **À faire par Toméo** : `supabase db push` sur le projet + réglages Auth (URL, modèle d'e-mail) — voir README
- [ ] **À faire par Toméo** : créer le premier compte admin (SQL dans le README)
- [ ] Test de bout en bout du lien magique sur le vrai projet (après les deux points ci-dessus)

Limites connues :

- Le projet Supabase n'est pas joignable depuis l'environnement de développement de Claude : migrations et RLS sont testées sur PostgreSQL 16 + PostGIS avec une reproduction de l'environnement Supabase, pas sur le projet lui-même.
- L'envoi réel d'e-mails n'a pas pu être testé ici.
- Un producteur peut modifier une fiche déjà publiée sans nouvelle validation (choix MVP, à confirmer).
- Pas encore de limitation de débit applicative sur les signalements (prévue au Lot 5) ; celle des e-mails de connexion est assurée par Supabase.

## Lot 2 — Espace producteur ⏳ prochain

- [ ] Création / édition de la fiche (nom, description, catégories, contacts facultatifs)
- [ ] Génération des slugs (unicité, collisions)
- [ ] Photos (Supabase Storage, taille / type limités)
- [ ] Points de vente : ajout, modification, désactivation, archivage
- [ ] Module de géocodage Géoplateforme (`lib/geocoding/`) + autocomplétion + cache + gestion du 429
- [ ] Carte de placement et correction manuelle du marqueur
- [ ] Horaires par jour, plusieurs créneaux, « horaires variables »
- [ ] « Confirmer mes informations », soumission pour validation, aperçu

## Lots suivants

- [ ] Lot 3 — Pages publiques
- [ ] Lot 4 — Carte & recherche
- [ ] Lot 5 — Favoris & signalements
- [ ] Lot 6 — Admin & invitations
- [ ] Lot 7 — Durcissement
