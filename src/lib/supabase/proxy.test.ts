import { describe, expect, it } from "vitest";
import { isPrivatePath } from "./proxy";

describe("isPrivatePath", () => {
  it("reconnaît les zones privées", () => {
    for (const p of ["/compte", "/admin", "/admin/fiches", "/espace-producteur/lieux"]) {
      expect(isPrivatePath(p)).toBe(true);
    }
  });

  it("laisse publiques les pages publiques", () => {
    for (const p of [
      "/",
      "/connexion",
      "/producteurs/ferme-des-pres",
      "/comptes-rendus",
      "/administratif",
    ]) {
      expect(isPrivatePath(p)).toBe(false);
    }
  });
});
