<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Règles projet PAYSAN

- Lire intégralement `PRODUCT_SPEC.md` (source de vérité) avant toute modification importante.
- Suivre l'avancement dans `TODO.md` ; ne cocher une case que si elle est testée.
- Avancer lot par lot (§12) ; attendre la validation explicite avant de passer au lot suivant.
- Nom et URL de base : uniquement via `src/config/site.ts` (jamais en dur).
- Aucune colonne ni logique de mise en avant / classement payant (§2).
- Avant de déclarer une tâche terminée : `npm run check` puis `npm run build`.
