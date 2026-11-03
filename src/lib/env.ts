/**
 * Validation des variables d'environnement PUBLIQUES (exposées au navigateur).
 *
 * Règles (PRODUCT_SPEC §9) :
 * - aucune clé secrète ici : seules les variables NEXT_PUBLIC_* sont autorisées ;
 * - les secrets serveur (ex. SUPABASE_SERVICE_ROLE_KEY) seront validés dans un
 *   module séparé `lib/env.server.ts`, importé uniquement côté serveur (Lot 1).
 *
 * Les valeurs sont lues explicitement (et non via `process.env` entier) pour que
 * Next.js puisse les injecter au build.
 */
import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SITE_NAME: z.string().trim().min(1).default("PAYSAN"),
  NEXT_PUBLIC_SITE_URL: z
    .string()
    .trim()
    .url("NEXT_PUBLIC_SITE_URL doit être une URL complète (ex. http://localhost:3000)")
    .default("http://localhost:3000"),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function parsePublicEnv(source: Record<string, string | undefined>): PublicEnv {
  const result = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SITE_NAME: source.NEXT_PUBLIC_SITE_NAME || undefined,
    NEXT_PUBLIC_SITE_URL: source.NEXT_PUBLIC_SITE_URL || undefined,
  });
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `- ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Variables d'environnement publiques invalides :\n${details}`);
  }
  return result.data;
}

export const publicEnv: PublicEnv = parsePublicEnv({
  NEXT_PUBLIC_SITE_NAME: process.env.NEXT_PUBLIC_SITE_NAME,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});
