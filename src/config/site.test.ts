import { describe, expect, it } from "vitest";
import { absoluteUrl, siteConfig } from "./site";

describe("siteConfig", () => {
  it("expose un nom et une URL de base", () => {
    expect(siteConfig.name.length).toBeGreaterThan(0);
    expect(() => new URL(siteConfig.url)).not.toThrow();
  });
});

describe("absoluteUrl", () => {
  it("construit une URL absolue sans double slash", () => {
    const url = absoluteUrl("/producteurs/ferme-des-pres");
    expect(url).toBe(`${siteConfig.url.replace(/\/+$/, "")}/producteurs/ferme-des-pres`);
    expect(url.replace("://", "")).not.toContain("//");
  });

  it("ajoute le slash initial manquant", () => {
    expect(absoluteUrl("points-de-vente/marche-de-sees")).toMatch(
      /\/points-de-vente\/marche-de-sees$/,
    );
  });
});
