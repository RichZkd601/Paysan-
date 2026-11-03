# PAYSAN (nom provisoire)

Annuaire géolocalisé des producteurs locaux et de leurs points de vente en circuit court.
La source de vérité produit et technique est **[`PRODUCT_SPEC.md`](./PRODUCT_SPEC.md)** — à lire avant toute modification importante.
L'avancement lot par lot est suivi dans **[`TODO.md`](./TODO.md)**.

## Prérequis

- Node.js ≥ 22 (voir `.nvmrc`)
- npm 10+

## Démarrer en local

```bash
npm install
cp .env.example .env.local   # puis ajuster si besoin
npm run dev                  # http://localhost:3000
```

## Scripts

| Commande                | Rôle                                                          |
| ----------------------- | ------------------------------------------------------------- |
| `npm run dev`           | Serveur de développement                                      |
| `npm run build`         | Build de production                                           |
| `npm run lint`          | ESLint (règles Next.js + TypeScript)                          |
| `npm run typecheck`     | Vérification TypeScript stricte                               |
| `npm run test`          | Tests unitaires (Vitest)                                      |
| `npm run format`        | Formatage Prettier                                            |
| `npm run check:secrets` | Vérifie qu'aucun secret / fichier `.env` réel n'est commité   |
| `npm run check`         | lint + typecheck + tests + secrets (à lancer avant un commit) |

La CI GitHub Actions (`.github/workflows/ci.yml`) exécute lint, typecheck, format, tests, contrôle des secrets et build à chaque push sur `main` et à chaque pull request.

## Configuration

| Variable                | Portée   | Rôle                                                          |
| ----------------------- | -------- | ------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_NAME` | publique | Nom affiché (provisoire : `PAYSAN`)                           |
| `NEXT_PUBLIC_SITE_URL`  | publique | URL de base pour liens partagés, QR codes, canonical, sitemap |

- Le nom et l'URL ne sont **jamais écrits en dur** dans les composants : utiliser `siteConfig` et `absoluteUrl()` de `src/config/site.ts`.
- Les variables publiques sont validées au démarrage (`src/lib/env.ts`, zod) ; une URL invalide fait échouer le build.
- Les secrets serveur (ex. `SUPABASE_SERVICE_ROLE_KEY`, Lot 1) ne doivent jamais être préfixés par `NEXT_PUBLIC_` ni importés dans un composant client.

## Structure

```
src/
  app/            routes Next.js (App Router)
  config/site.ts  nom, description, URL de base (configuration unique)
  lib/env.ts      validation des variables d'environnement publiques
scripts/
  check-secrets.mjs  garde-fou anti-secrets
```

## Stack

Next.js (App Router) · TypeScript strict · Tailwind CSS · ESLint · Prettier · Vitest.
À venir : Supabase + PostGIS (Lot 1), MapLibre GL JS (Lot 4), géocodage Géoplateforme IGN / BAN (Lot 2).
