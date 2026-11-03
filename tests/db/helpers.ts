/**
 * Outils des tests d'accès. Chaque test s'exécute dans une transaction annulée
 * à la fin (aucune donnée ne persiste). Les fixtures sont créées en
 * superutilisateur, puis on « devient » un visiteur, un producteur ou un admin
 * exactement comme le fait l'API Supabase : SET ROLE + claims JWT.
 */
import { Client, type QueryResultRow } from "pg";
import { testDatabaseUrl } from "./setup";

export type Actor = { kind: "anon" } | { kind: "user"; id: string } | { kind: "service" };

export const ANON: Actor = { kind: "anon" };
export const user = (id: string): Actor => ({ kind: "user", id });

export class Db {
  constructor(private readonly client: Client) {}

  /** Requête en superutilisateur (fixtures). */
  async sql<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
    await this.client.query("reset role");
    await this.client.query("select set_config('request.jwt.claims', '', true)");
    return (await this.client.query<T>(text, params)).rows;
  }

  /** Requête exécutée « en tant que » l'acteur donné, à travers la RLS. */
  async as<T extends QueryResultRow = QueryResultRow>(
    actor: Actor,
    text: string,
    params: unknown[] = [],
  ) {
    const role =
      actor.kind === "anon" ? "anon" : actor.kind === "user" ? "authenticated" : "service_role";
    const claims =
      actor.kind === "user" ? JSON.stringify({ sub: actor.id, role: "authenticated" }) : "";
    await this.client.query("select set_config('request.jwt.claims', $1, true)", [claims]);
    await this.client.query(`set local role ${role}`);
    // En cas d'erreur, la transaction est avortée : c'est `rejects` qui revient
    // au savepoint (ce qui annule aussi le changement de rôle).
    const rows = (await this.client.query<T>(text, params)).rows;
    await this.client.query("reset role");
    return rows;
  }

  /** Comme `as`, mais attend une erreur et renvoie son message. */
  async rejects(actor: Actor, text: string, params: unknown[] = []): Promise<string> {
    await this.client.query("savepoint expect_error");
    try {
      await this.as(actor, text, params);
    } catch (error) {
      await this.client.query("rollback to savepoint expect_error");
      return (error as Error).message;
    }
    await this.client.query("release savepoint expect_error");
    throw new Error(`La requête aurait dû échouer : ${text}`);
  }

  // ---- Fixtures ------------------------------------------------------------

  async createUser(email: string, role: "consumer" | "producer" | "admin" = "consumer") {
    const [row] = await this.sql<{ id: string }>(
      "insert into auth.users (email) values ($1) returning id",
      [email],
    );
    if (!row) throw new Error("création utilisateur impossible");
    if (role !== "consumer") {
      await this.sql("update public.profiles set role = $2 where id = $1", [row.id, role]);
    }
    return row.id;
  }

  async createProducer(opts: {
    owner: string | null;
    slug: string;
    status?: "draft" | "pending_review" | "published" | "suspended" | "archived";
    name?: string;
  }) {
    const [row] = await this.sql<{ id: string }>(
      `insert into public.producers (owner_user_id, name, slug, status)
       values ($1, $2, $3, $4) returning id`,
      [opts.owner, opts.name ?? `Test ${opts.slug}`, opts.slug, opts.status ?? "published"],
    );
    if (!row) throw new Error("création producteur impossible");
    return row.id;
  }

  async createSalesPoint(opts: {
    producerId: string;
    slug: string;
    lon?: number;
    lat?: number;
    status?: "active" | "inactive" | "archived";
  }) {
    const [row] = await this.sql<{ id: string }>(
      `insert into public.sales_points (producer_id, name, type, slug, city, location, status)
       values ($1, $2, 'farm', $3, 'Commune test',
               extensions.st_setsrid(extensions.st_makepoint($4, $5), 4326)::extensions.geography, $6)
       returning id`,
      [
        opts.producerId,
        `Lieu ${opts.slug}`,
        opts.slug,
        opts.lon ?? 0.17,
        opts.lat ?? 48.6,
        opts.status ?? "active",
      ],
    );
    if (!row) throw new Error("création point de vente impossible");
    return row.id;
  }
}

/** Ouvre une connexion, exécute le test dans une transaction, puis annule tout. */
export async function withDb(fn: (db: Db) => Promise<void>): Promise<void> {
  const client = new Client({ connectionString: testDatabaseUrl() });
  await client.connect();
  try {
    await client.query("begin");
    await fn(new Db(client));
  } finally {
    await client.query("rollback").catch(() => undefined);
    await client.end();
  }
}
