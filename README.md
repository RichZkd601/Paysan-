# PAYSAN (nom provisoire)

Annuaire géolocalisé des producteurs locaux et de leurs points de vente en circuit court.
La source de vérité produit et technique est **[`PRODUCT_SPEC.md`](./PRODUCT_SPEC.md)** — à lire avant toute modification importante.
L'avancement lot par lot est suivi dans **[`TODO.md`](./TODO.md)**.

## Prérequis

- Node.js ≥ 22 (voir `.nvmrc`)
- npm 10+
- Pour les tests base de données : PostgreSQL 15+ avec PostGIS (ou Docker)

## Démarrer en local

```bash
npm install
cp .env.example .env.local   # contient déjà l'URL et la clé publishable du projet Supabase
npm run dev                  # http://localhost:3000
```

## Scripts

| Commande                | Rôle                                                               |
| ----------------------- | ------------------------------------------------------------------ |
| `npm run dev`           | Serveur de développement                                           |
| `npm run build`         | Build de production                                                |
| `npm run lint`          | ESLint (règles Next.js + TypeScript)                               |
| `npm run typecheck`     | Génère les types de routes Next puis vérifie TypeScript (strict)   |
| `npm run test`          | Tests unitaires (Vitest)                                           |
| `npm run test:db`       | Tests d'accès à la base : migrations + RLS (voir ci-dessous)       |
| `npm run format`        | Formatage Prettier                                                 |
| `npm run check:secrets` | Vérifie qu'aucun secret / fichier `.env` réel n'est commité        |
| `npm run check`         | lint + typecheck + tests unitaires + secrets (avant chaque commit) |

La CI GitHub Actions (`.github/workflows/ci.yml`) a deux jobs :

- **check** : lint, typecheck, format, tests unitaires, secrets, build ;
- **database** : applique toutes les migrations sur PostgreSQL + PostGIS et exécute les tests d'accès visiteur / producteur / admin.

## Configuration

| Variable                               | Portée   | Rôle                                                       |
| -------------------------------------- | -------- | ---------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_NAME`                | publique | Nom affiché (provisoire : `PAYSAN`)                        |
| `NEXT_PUBLIC_SITE_URL`                 | publique | URL de base : liens partagés, QR codes, liens magiques     |
| `NEXT_PUBLIC_SUPABASE_URL`             | publique | URL du projet Supabase                                     |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publique | Clé publishable (publique par conception ; la RLS protège) |
| `TEST_DATABASE_URL`                    | locale   | Connexion superutilisateur Postgres+PostGIS pour `test:db` |

- Le nom et l'URL ne sont **jamais écrits en dur** : utiliser `siteConfig` et `absoluteUrl()` de `src/config/site.ts`.
- Les variables publiques sont validées au démarrage (`src/lib/env.ts`, zod). Une clé `sb_secret_…` placée dans une variable publique fait **échouer** le démarrage.
- La clé **secrète** Supabase n'est pas utilisée au Lot 1. Elle ne doit jamais être préfixée par `NEXT_PUBLIC_` ni importée dans un composant client.

## Base de données (Supabase)

Les migrations versionnées sont dans `supabase/migrations/` :

| Fichier                                   | Contenu                                                            |
| ----------------------------------------- | ------------------------------------------------------------------ |
| `20261103150000_schema.sql`               | PostGIS, types, tables du §8, index spatial, alias de slugs        |
| `20261103150100_auth_roles_rls.sql`       | Profils auto, rôles, garde-fous métier, privilèges, politiques RLS |
| `20261103150200_reference_categories.sql` | Référentiel des 11 catégories du §4.1                              |

### Appliquer les migrations sur le projet Supabase

```bash
npx supabase login                                   # ouvre le navigateur
npx supabase link --project-ref ivsaiyualnpjvhjgvkcs # demande le mot de passe de la base
npx supabase db push                                 # applique les migrations non encore passées
```

Le mot de passe de la base se trouve (ou se réinitialise) dans Supabase > Project Settings > Database. Ne jamais le commiter.

### Réglages Auth à faire dans le tableau de bord Supabase

1. **Authentication > URL Configuration**
   - Site URL : `http://localhost:3000` (puis l'URL de production quand le domaine sera choisi)
   - Redirect URLs : `http://localhost:3000/auth/confirmer` (+ l'équivalent en production et, si besoin, `https://*-<équipe>.vercel.app/auth/confirmer` pour les previews)
2. **Authentication > Email Templates > Magic Link** (et **Confirm signup**) : remplacer le contenu par `supabase/templates/magic_link.html`.
   Ce modèle utilise `token_hash` : le lien fonctionne même si le producteur le demande sur son ordinateur et l'ouvre sur son téléphone.
3. **Authentication > Providers > Email** : laisser l'inscription activée.
4. Avant l'ouverture publique : configurer un **SMTP** dédié (l'envoi intégré de Supabase est très limité en volume).

### Créer le premier administrateur

1. Se connecter une fois sur l'app via `/connexion` avec l'adresse admin (le profil est créé automatiquement).
2. Dans Supabase > SQL Editor :

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'votre-adresse@exemple.fr');
```

Ensuite, un admin peut changer les rôles via `select public.set_user_role('<uuid>', 'admin');`.

### Tests d'accès (RLS) en local

Ils tournent sur un PostgreSQL + PostGIS classique, grâce à une reproduction minimale de l'environnement Supabase (`tests/db/supabase-shim.sql` : rôles `anon` / `authenticated` / `service_role`, `auth.users`, `auth.uid()`).

```bash
# Option Docker
docker run -d --name paysan-pg -e POSTGRES_USER=tester -e POSTGRES_PASSWORD=tester -p 5432:5432 postgis/postgis:16-3.4
TEST_DATABASE_URL=postgres://tester:tester@localhost:5432/postgres npm run test:db
```

La base `paysan_test` est recréée à chaque exécution ; chaque test tourne dans une transaction annulée.

## Authentification

- Connexion par **lien magique** (`/connexion`), sans mot de passe ; le compte est créé au premier lien.
- `/auth/confirmer` valide le lien (`token_hash` ou `code`) puis redirige vers une page interne uniquement (`safeNextPath`).
- `/auth/deconnexion` : POST uniquement.
- `src/proxy.ts` rafraîchit la session et redirige (HTTP 307) un visiteur sans session hors de `/compte`, `/admin`, `/espace-producteur`.
- Rôles vérifiés côté serveur (`src/lib/auth.ts` : `requireUser`, `requireAdmin`) puis, en dernier ressort, par la RLS.

## Structure

```
src/
  app/                 routes (accueil, connexion, compte, admin, auth/*)
  config/site.ts       nom, description, URL de base (configuration unique)
  lib/env.ts           validation des variables d'environnement publiques
  lib/auth.ts          utilisateur courant, requireUser / requireAdmin
  lib/supabase/        clients navigateur / serveur / proxy
  proxy.ts             rafraîchissement de session + garde des zones privées
supabase/
  migrations/          migrations SQL versionnées
  templates/           modèle d'e-mail du lien magique
  config.toml          configuration Supabase CLI
tests/db/              tests d'accès RLS (Postgres + PostGIS)
scripts/
  check-secrets.mjs    garde-fou anti-secrets
```

## Stack

Next.js 16 (App Router) · TypeScript strict · Tailwind CSS 4 · Supabase (Postgres, PostGIS, Auth) · ESLint · Prettier · Vitest.
À venir : géocodage Géoplateforme IGN / BAN (Lot 2), MapLibre GL JS (Lot 4).
