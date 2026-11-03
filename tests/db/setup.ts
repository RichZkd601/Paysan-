/**
 * Préparation de la base de test : recrée la base, applique le shim Supabase
 * puis TOUTES les migrations de supabase/migrations dans l'ordre.
 *
 * Variable requise : TEST_DATABASE_URL — une connexion superutilisateur vers un
 * PostgreSQL 15+ avec PostGIS, ex. postgres://tester:tester@localhost:5432/postgres
 * La base `paysan_test` y est (re)créée à chaque exécution.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

const TEST_DB = "paysan_test";
const ROOT = join(__dirname, "..", "..");

export function testDatabaseUrl(): string {
  const base = process.env.TEST_DATABASE_URL;
  if (!base) {
    throw new Error(
      "TEST_DATABASE_URL manquant (ex. postgres://tester:tester@localhost:5432/postgres). Voir README § Tests base de données.",
    );
  }
  const url = new URL(base);
  url.pathname = `/${TEST_DB}`;
  return url.toString();
}

export default async function setup(): Promise<void> {
  const admin = new Client({ connectionString: process.env.TEST_DATABASE_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB} with (force)`);
  await admin.query(`create database ${TEST_DB}`);
  await admin.end();

  const db = new Client({ connectionString: testDatabaseUrl() });
  await db.connect();
  try {
    await db.query(readFileSync(join(ROOT, "tests/db/supabase-shim.sql"), "utf8"));
    const dir = join(ROOT, "supabase/migrations");
    for (const file of readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      try {
        await db.query(readFileSync(join(dir, file), "utf8"));
      } catch (error) {
        throw new Error(`Échec de la migration ${file} : ${(error as Error).message}`);
      }
    }
  } finally {
    await db.end();
  }
}
