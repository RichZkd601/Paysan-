/**
 * N'accepte comme destination de redirection qu'un chemin interne
 * (évite les redirections ouvertes vers un site tiers après connexion).
 */
export function safeNextPath(value: string | null | undefined, fallback = "/compte"): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  if (/[\u0000-\u001f]/.test(value)) return fallback;
  return value;
}
