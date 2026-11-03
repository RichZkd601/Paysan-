import { defineConfig } from "vitest/config";

// Tests d'accès à la base (RLS). Nécessite TEST_DATABASE_URL. Voir README.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/db/**/*.test.ts"],
    globalSetup: ["tests/db/setup.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
