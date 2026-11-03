/**
 * Validation des variables d'environnement PUBLIQUES (exposées au navigateur).
 *
 * Règles (PRODUCT_SPEC §9) :
 * - aucune clé secrète ici : seules les variables NEXT_PUBLIC_* sont autorisées ;
 * - la clé Supabase « publishable » est conçue pour être publique : la sécurité
 *   repose sur la RLS, pas sur le secret de cette clé ;
 * - les secrets serveur (clé secrète / service_role) ne doivent JAMAIS être
 *   préfixés par NEXT_PUBLIC_ ; ils seront validés dans un module serveur dédié
 *   le jour où ils seront nécessaires (Lot 6, invitations).
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
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .trim()
    .url("NEXT_PUBLIC_SUPABASE_URL doit être l'URL du projet (https://xxxx.supabase.co)"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .trim()
    .min(20, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY manquante")
    .refine((v) => !v.startsWith("sb_secret_"), {
      message: "Clé SECRÈTE détectée : seule la clé publishable peut être exposée au navigateur",
    }),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function parsePublicEnv(source: Record<string, string | undefined>): PublicEnv {
  const result = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SITE_NAME: source.NEXT_PUBLIC_SITE_NAME || undefined,
    NEXT_PUBLIC_SITE_URL: source.NEXT_PUBLIC_SITE_URL || undefined,
    NEXT_PUBLIC_SUPABASE_URL: source.NEXT_PUBLIC_SUPABASE_URL || undefined,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || undefined,
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
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});
