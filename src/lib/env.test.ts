import { describe, expect, it } from "vitest";
import { parsePublicEnv } from "./env";

describe("parsePublicEnv", () => {
  it("applique les valeurs par défaut quand rien n'est défini", () => {
    expect(parsePublicEnv({})).toEqual({
      NEXT_PUBLIC_SITE_NAME: "PAYSAN",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    });
  });

  it("traite une chaîne vide comme absente", () => {
    expect(parsePublicEnv({ NEXT_PUBLIC_SITE_NAME: "" }).NEXT_PUBLIC_SITE_NAME).toBe("PAYSAN");
  });

  it("accepte des valeurs valides", () => {
    const env = parsePublicEnv({
      NEXT_PUBLIC_SITE_NAME: "Autre nom",
      NEXT_PUBLIC_SITE_URL: "https://exemple.fr",
    });
    expect(env.NEXT_PUBLIC_SITE_NAME).toBe("Autre nom");
    expect(env.NEXT_PUBLIC_SITE_URL).toBe("https://exemple.fr");
  });

  it("refuse une URL de base invalide", () => {
    expect(() => parsePublicEnv({ NEXT_PUBLIC_SITE_URL: "pas-une-url" })).toThrow(
      /NEXT_PUBLIC_SITE_URL/,
    );
  });
});
