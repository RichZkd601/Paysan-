import { siteConfig } from "@/config/site";

/**
 * Page d'accueil provisoire (Lot 0).
 * La carte, la recherche et les filtres arrivent au Lot 4.
 * Aucune donnée fictive n'est affichée (PRODUCT_SPEC, contraintes).
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 px-4 py-16">
      <h1 className="text-3xl font-bold">{siteConfig.name}</h1>
      <p className="text-lg">{siteConfig.tagline}</p>
      <p className="text-sm opacity-70">
        Site en construction. La carte des producteurs et des points de vente arrive bientôt.
      </p>
    </main>
  );
}
