import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-redirect";

describe("safeNextPath", () => {
  it("accepte un chemin interne", () => {
    expect(safeNextPath("/espace-producteur")).toBe("/espace-producteur");
    expect(safeNextPath("/compte?x=1")).toBe("/compte?x=1");
  });

  it("refuse les redirections vers l'extérieur", () => {
    for (const bad of ["https://pirate.fr", "//pirate.fr", "/\\pirate.fr", "javascript:alert(1)"]) {
      expect(safeNextPath(bad)).toBe("/compte");
    }
  });

  it("utilise la valeur par défaut si absente", () => {
    expect(safeNextPath(null)).toBe("/compte");
    expect(safeNextPath(undefined, "/")).toBe("/");
  });
});
