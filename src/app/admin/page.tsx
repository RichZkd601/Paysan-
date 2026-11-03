import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";

// Page privée dépendant de la session : rendu bloquant à chaque requête
// (redirections HTTP réelles si non autorisé). Voir docs Next 16 « instant ».
export const instant = false;

export const metadata: Metadata = {
  title: "Administration",
  robots: { index: false },
};

/** Squelette protégé : le back-office est construit au Lot 6. */
export default async function AdminPage() {
  const admin = await requireAdmin();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-12">
      <h1 className="text-2xl font-bold">Administration</h1>
      <p>Connecté en tant qu&apos;administrateur ({admin.email}).</p>
      <p className="opacity-70">
        Le back-office (validation des fiches, signalements, invitations) arrive au Lot 6.
      </p>
    </main>
  );
}
