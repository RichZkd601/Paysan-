import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-redirect";
import { MagicLinkForm } from "./magic-link-form";

// Page privée dépendant de la session : rendu bloquant à chaque requête
// (redirections HTTP réelles si non autorisé). Voir docs Next 16 « instant ».
export const instant = false;

export const metadata: Metadata = {
  title: "Connexion",
  robots: { index: false },
};

const ERRORS: Record<string, string> = {
  "lien-invalide": "Ce lien de connexion est invalide ou a expiré. Demandez-en un nouveau.",
};

export default async function ConnexionPage({ searchParams }: PageProps<"/connexion">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  const errorKey = typeof params.erreur === "string" ? params.erreur : null;

  if (await getCurrentUser()) redirect(next);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-bold">Se connecter</h1>
      {errorKey && ERRORS[errorKey] && (
        <p role="alert" className="rounded-lg border border-red-700 p-3">
          {ERRORS[errorKey]}
        </p>
      )}
      <MagicLinkForm next={next} />
    </main>
  );
}
