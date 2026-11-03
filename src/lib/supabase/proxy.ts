import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";

/**
 * Rafraîchit la session Supabase à chaque requête et réécrit les cookies.
 * Ne prend AUCUNE décision d'autorisation : celles-ci sont faites dans les
 * pages / actions serveur (src/lib/auth.ts) et, en dernier ressort, par la RLS.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          for (const [key, value] of Object.entries(headers ?? {})) {
            response.headers.set(key, value);
          }
        },
      },
    },
  );

  // Ne rien exécuter entre la création du client et cet appel : il déclenche
  // le rafraîchissement du jeton si nécessaire.
  const { data } = await supabase.auth.getClaims();

  // Zones privées : un visiteur sans session reçoit une vraie redirection HTTP
  // vers la connexion. Le contrôle des RÔLES reste fait dans les pages
  // (src/lib/auth.ts) et par la RLS.
  if (!data?.claims && isPrivatePath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
    const redirect = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  return response;
}

const PRIVATE_PREFIXES = ["/compte", "/admin", "/espace-producteur"];

export function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
