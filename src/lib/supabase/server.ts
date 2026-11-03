import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";

/**
 * Client Supabase côté serveur (Server Components, Server Actions, Route Handlers),
 * agissant au nom de l'utilisateur connecté via ses cookies de session.
 * Il utilise la clé publishable : toutes les requêtes passent par la RLS.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Appelé depuis un Server Component : les cookies sont en lecture seule.
            // Le rafraîchissement de session est assuré par src/proxy.ts.
          }
        },
      },
    },
  );
}
