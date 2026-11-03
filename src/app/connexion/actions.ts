"use server";

import { z } from "zod";
import { absoluteUrl } from "@/config/site";
import { safeNextPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

export interface MagicLinkState {
  status: "idle" | "sent" | "error";
  message?: string;
  email?: string;
}

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Adresse e-mail invalide.")
  .max(254, "Adresse e-mail trop longue.");

/** Envoie un lien de connexion par e-mail (inscription automatique au premier envoi). */
export async function sendMagicLink(
  _previous: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "E-mail invalide." };
  }
  const next = safeNextPath(String(formData.get("next") ?? ""));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: absoluteUrl(`/auth/confirmer?next=${encodeURIComponent(next)}`),
    },
  });

  if (error) {
    // Supabase limite le nombre d'e-mails envoyés (anti-abus) : message explicite.
    const rateLimited = error.status === 429 || /rate limit/i.test(error.message);
    return {
      status: "error",
      email: parsed.data,
      message: rateLimited
        ? "Trop de demandes en peu de temps. Patientez une minute avant de réessayer."
        : "L'envoi du lien a échoué. Réessayez dans un instant.",
    };
  }
  return { status: "sent", email: parsed.data };
}
