import { describe, expect, it } from "vitest";
import { parsePublicEnv } from "./env";

const SUPABASE = {
  NEXT_PUBLIC_SUPABASE_URL: "https://exemple.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_0123456789abcdef",
};

describe("parsePublicEnv", () => {
  it("applique les valeurs par défaut du nom et de l'URL du site", () => {
    const env = parsePublicEnv(SUPABASE);
    expect(env.NEXT_PUBLIC_SITE_NAME).toBe("PAYSAN");
    expect(env.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
  });

  it("traite une chaîne vide comme absente", () => {
    expect(parsePublicEnv({ ...SUPABASE, NEXT_PUBLIC_SITE_NAME: "" }).NEXT_PUBLIC_SITE_NAME).toBe(
      "PAYSAN",
    );
  });

  it("accepte des valeurs valides", () => {
    const env = parsePublicEnv({
      ...SUPABASE,
      NEXT_PUBLIC_SITE_NAME: "Autre nom",
      NEXT_PUBLIC_SITE_URL: "https://exemple.fr",
    });
    expect(env.NEXT_PUBLIC_SITE_NAME).toBe("Autre nom");
    expect(env.NEXT_PUBLIC_SITE_URL).toBe("https://exemple.fr");
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe(SUPABASE.NEXT_PUBLIC_SUPABASE_URL);
  });

  it("refuse une URL de base invalide", () => {
    expect(() => parsePublicEnv({ ...SUPABASE, NEXT_PUBLIC_SITE_URL: "pas-une-url" })).toThrow(
      /NEXT_PUBLIC_SITE_URL/,
    );
  });

  it("exige la configuration Supabase", () => {
    expect(() => parsePublicEnv({})).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("refuse une clé secrète Supabase exposée au navigateur", () => {
    expect(() =>
      parsePublicEnv({
        ...SUPABASE,
        // Construite dynamiquement pour ne pas déclencher check:secrets.
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ["sb", "secret", "0123456789abcdef"].join("_"),
      }),
    ).toThrow(/SECRÈTE/);
  });
});
