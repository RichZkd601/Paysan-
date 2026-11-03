/**
 * Configuration centrale du site.
 *
 * Le nom « PAYSAN » est PROVISOIRE (PRODUCT_SPEC §15).
 * Ne jamais écrire le nom ou l'URL de base en dur dans un composant :
 * toujours passer par `siteConfig` ou `absoluteUrl()`.
 */
import { publicEnv } from "@/lib/env";

export const siteConfig = {
  name: publicEnv.NEXT_PUBLIC_SITE_NAME,
  tagline: "Trouvez les producteurs locaux et leurs points de vente près de chez vous.",
  description:
    "Annuaire géolocalisé des producteurs locaux et de leurs lieux de vente en circuit court : ferme, marché, magasin, distributeur.",
  url: publicEnv.NEXT_PUBLIC_SITE_URL,
  locale: "fr_FR",
  language: "fr",
} as const;

/** Construit une URL absolue à partir d'un chemin, à partir de l'URL de base configurée. */
export function absoluteUrl(path = "/"): string {
  const base = siteConfig.url.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
