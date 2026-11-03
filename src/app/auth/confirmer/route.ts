import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES: readonly EmailOtpType[] = ["email", "magiclink", "signup", "invite", "recovery"];

/**
 * Point d'arrivée du lien magique. Deux formats acceptés :
 *  - `token_hash` + `type` (recommandé : fonctionne même si le lien est ouvert
 *    sur un autre appareil que celui de la demande — voir README) ;
 *  - `code` (flux PKCE par défaut de Supabase : même navigateur obligatoire).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");

  const supabase = await createClient();
  let ok = false;

  if (tokenHash && type && (OTP_TYPES as readonly string[]).includes(type)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  const target = ok ? next : `/connexion?erreur=lien-invalide&next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(new URL(target, origin));
}
