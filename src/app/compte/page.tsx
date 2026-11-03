import type { Metadata } from "next";
import Link from "next/link";
import { requireUser, type UserRole } from "@/lib/auth";

// Page privée dépendant de la session : rendu bloquant à chaque requête
// (redirections HTTP réelles si non autorisé). Voir docs Next 16 « instant ».
export const instant = false;

export const metadata: Metadata = {
  title: "Mon compte",
  robots: { index: false },
};

const ROLE_LABELS: Record<UserRole, string> = {
  consumer: "Consommateur",
  producer: "Producteur",
  admin: "Administrateur",
};

export default async function ComptePage({ searchParams }: PageProps<"/compte">) {
  const user = await requireUser("/compte");
  const params = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-bold">Mon compte</h1>
      {params.erreur === "acces-refuse" && (
        <p role="alert" className="rounded-lg border border-red-700 p-3">
          Vous n&apos;avez pas accès à cette page.
        </p>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        <dt className="font-medium">E-mail</dt>
        <dd>{user.email ?? "—"}</dd>
        <dt className="font-medium">Profil</dt>
        <dd>{ROLE_LABELS[user.role]}</dd>
      </dl>
      {user.role === "admin" && (
        <Link href="/admin" className="underline">
          Accéder à l&apos;administration
        </Link>
      )}
      <form action="/auth/deconnexion" method="post">
        <button type="submit" className="rounded-lg border px-4 py-3 text-base font-semibold">
          Se déconnecter
        </button>
      </form>
    </main>
  );
}
