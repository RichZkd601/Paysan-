#!/usr/bin/env node
/**
 * Garde-fou simple (PRODUCT_SPEC §9) : échoue si un secret semble commité.
 * - fichiers .env réels suivis par git (seul .env.example est autorisé) ;
 * - JWT Supabase ou clé "service_role" en clair dans le code ;
 * - utilisation de SUPABASE_SERVICE_ROLE_KEY dans du code client ("use client").
 *
 * Ce n'est pas un scanner exhaustif : il complète la revue humaine.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execSync("git ls-files --cached --others --exclude-standard", { encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .filter((f) => !f.startsWith("node_modules/") && !f.endsWith("package-lock.json"));

const problems = [];

for (const file of files) {
  const base = file.split("/").pop() ?? "";
  if (/^\.env(\..+)?$/.test(base) && base !== ".env.example") {
    problems.push(`${file} : fichier d'environnement réel suivi par git`);
    continue;
  }
  if (!/\.(ts|tsx|js|jsx|mjs|cjs|json|md|sql|yml|yaml|toml|example)$/.test(file)) continue;
  if (file === "scripts/check-secrets.mjs") continue;

  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }

  if (/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/.test(content)) {
    problems.push(`${file} : ressemble à un JWT (clé Supabase ?) en clair`);
  }
  if (/sb_secret_[A-Za-z0-9_-]{10,}/.test(content)) {
    problems.push(`${file} : clé secrète Supabase en clair`);
  }
  if (/^\s*["']use client["']/m.test(content) && /SERVICE_ROLE/.test(content)) {
    problems.push(`${file} : référence à la service_role dans un composant client`);
  }
}

if (problems.length > 0) {
  console.error("✗ Secrets potentiels détectés :\n" + problems.map((p) => `  - ${p}`).join("\n"));
  process.exit(1);
}
console.log(`✓ Aucun secret détecté (${files.length} fichiers vérifiés).`);
