import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type UserRole = "consumer" | "producer" | "admin";

export interface CurrentUser {
  id: string;
  email: string | null;
  role: UserRole;
  displayName: string | null;
}

/**
 * Utilisateur courant, identité VÉRIFIÉE côté serveur (getClaims valide le JWT),
 * rôle lu en base (profiles.role). Jamais à partir d'une valeur fournie par le client.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || typeof sub !== "string") return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name")
    .eq("id", sub)
    .maybeSingle<{ role: UserRole; display_name: string | null }>();

  const email = data?.claims?.email;
  return {
    id: sub,
    email: typeof email === "string" ? email : null,
    role: profile?.role ?? "consumer",
    displayName: profile?.display_name ?? null,
  };
}

/** Exige une session ; sinon redirige vers la connexion puis revient sur `nextPath`. */
export async function requireUser(nextPath: string): Promise<CurrentUser> {
  const current = await getCurrentUser();
  if (!current) redirect(`/connexion?next=${encodeURIComponent(nextPath)}`);
  return current;
}

/**
 * Exige le rôle admin, vérifié côté serveur. Ce n'est qu'une première barrière
 * d'interface : la RLS refuse de toute façon les écritures d'un non-admin.
 */
export async function requireAdmin(nextPath = "/admin"): Promise<CurrentUser> {
  const current = await requireUser(nextPath);
  if (current.role !== "admin") redirect("/compte?erreur=acces-refuse");
  return current;
}
