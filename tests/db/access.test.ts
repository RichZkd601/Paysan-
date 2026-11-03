/**
 * Tests d'accès — Lot 1 (PRODUCT_SPEC §9, §12 critère « aucune fuite », §13).
 * Exécution : npm run test:db (nécessite TEST_DATABASE_URL).
 */
import { describe, expect, it } from "vitest";
import { ANON, user, withDb } from "./helpers";

const PUBLIC_TABLES = [
  "categories",
  "favorites",
  "opening_hours",
  "producer_categories",
  "producer_invites",
  "producers",
  "profiles",
  "reports",
  "sales_points",
  "slug_aliases",
];

describe("Schéma", () => {
  it("la RLS est activée sur toutes les tables du schéma public", async () => {
    await withDb(async (db) => {
      const rows = await db.sql<{ relname: string; relrowsecurity: boolean }>(
        `select relname, relrowsecurity from pg_class
          where relnamespace = 'public'::regnamespace and relkind = 'r' order by relname`,
      );
      expect(rows.map((r) => r.relname)).toEqual(PUBLIC_TABLES);
      expect(rows.every((r) => r.relrowsecurity)).toBe(true);
    });
  });

  it("aucune colonne de mise en avant n'existe sur producers ni sales_points (§2)", async () => {
    await withDb(async (db) => {
      const rows = await db.sql<{ column_name: string }>(
        `select column_name from information_schema.columns
          where table_schema = 'public' and table_name in ('producers', 'sales_points')
            and column_name ~* '(boost|priorit|sponsor|featured|premium|rank|promot|highlight|weight|paid)'`,
      );
      expect(rows).toEqual([]);
    });
  });

  it("le référentiel des 11 catégories du §4.1 est présent et lisible par un visiteur", async () => {
    await withDb(async (db) => {
      const rows = await db.as(ANON, "select slug from public.categories order by sort_order");
      expect(rows).toHaveLength(11);
    });
  });

  it("PostGIS : recherche par rayon et tri par distance côté serveur", async () => {
    await withDb(async (db) => {
      const p = await db.createProducer({ owner: null, slug: "geo" });
      await db.createSalesPoint({ producerId: p, slug: "proche", lon: 0.172, lat: 48.605 });
      await db.createSalesPoint({ producerId: p, slug: "moyen", lon: 0.09, lat: 48.43 }); // ~20 km
      await db.createSalesPoint({ producerId: p, slug: "loin", lon: 2.35, lat: 48.85 }); // ~160 km
      const rows = await db.as<{ slug: string }>(
        ANON,
        `select slug from public.sales_points
          where extensions.st_dwithin(location,
                  extensions.st_makepoint(0.1717, 48.6045)::extensions.geography, $1)
          order by location operator(extensions.<->) extensions.st_makepoint(0.1717, 48.6045)::extensions.geography`,
        [25_000],
      );
      expect(rows.map((r) => r.slug)).toEqual(["proche", "moyen"]);
    });
  });
});

describe("Profils et rôles", () => {
  it("un profil « consumer » est créé automatiquement à l'inscription", async () => {
    await withDb(async (db) => {
      const id = await db.createUser("a@test.local");
      const rows = await db.as(user(id), "select role from public.profiles where id = $1", [id]);
      expect(rows).toEqual([{ role: "consumer" }]);
    });
  });

  it("un utilisateur peut changer son nom mais pas son rôle", async () => {
    await withDb(async (db) => {
      const id = await db.createUser("a@test.local");
      await db.as(user(id), "update public.profiles set display_name = 'Jeanne' where id = $1", [
        id,
      ]);
      const err = await db.rejects(
        user(id),
        "update public.profiles set role = 'admin' where id = $1",
        [id],
      );
      expect(err).toMatch(/permission denied/);
      const [row] = await db.sql("select role, display_name from public.profiles where id = $1", [
        id,
      ]);
      expect(row).toEqual({ role: "consumer", display_name: "Jeanne" });
    });
  });

  it("un utilisateur ne voit pas le profil des autres ; l'admin voit tout", async () => {
    await withDb(async (db) => {
      const a = await db.createUser("a@test.local");
      const b = await db.createUser("b@test.local");
      const admin = await db.createUser("admin@test.local", "admin");
      expect(await db.as(user(a), "select id from public.profiles where id = $1", [b])).toEqual([]);
      expect(await db.as(user(admin), "select id from public.profiles")).toHaveLength(3);
    });
  });

  it("seul un admin peut changer un rôle via set_user_role", async () => {
    await withDb(async (db) => {
      const a = await db.createUser("a@test.local");
      const admin = await db.createUser("admin@test.local", "admin");
      const err = await db.rejects(user(a), "select public.set_user_role($1, 'admin')", [a]);
      expect(err).toMatch(/administrateur/);
      expect(await db.rejects(ANON, "select public.set_user_role($1, 'admin')", [a])).toMatch(
        /permission denied/,
      );
      await db.as(user(admin), "select public.set_user_role($1, 'producer')", [a]);
      const [row] = await db.sql("select role from public.profiles where id = $1", [a]);
      expect(row).toEqual({ role: "producer" });
    });
  });
});

describe("Visiteur (non connecté)", () => {
  it("ne voit que les fiches publiées (jamais brouillon, en attente, suspendue, archivée)", async () => {
    await withDb(async (db) => {
      for (const status of [
        "draft",
        "pending_review",
        "published",
        "suspended",
        "archived",
      ] as const) {
        await db.createProducer({ owner: null, slug: `p-${status.replace("_", "-")}`, status });
      }
      const rows = await db.as<{ slug: string }>(ANON, "select slug from public.producers");
      expect(rows.map((r) => r.slug)).toEqual(["p-published"]);
    });
  });

  it("ne voit que les points de vente actifs de producteurs publiés, et leurs horaires", async () => {
    await withDb(async (db) => {
      const pub = await db.createProducer({ owner: null, slug: "pub" });
      const draft = await db.createProducer({ owner: null, slug: "brouillon", status: "draft" });
      const visible = await db.createSalesPoint({ producerId: pub, slug: "visible" });
      const inactive = await db.createSalesPoint({
        producerId: pub,
        slug: "inactif",
        status: "inactive",
      });
      const hidden = await db.createSalesPoint({ producerId: draft, slug: "cache" });
      for (const sp of [visible, inactive, hidden]) {
        await db.sql(
          `insert into public.opening_hours (sales_point_id, day_of_week, opens_at, closes_at)
           values ($1, 6, '08:00', '12:30')`,
          [sp],
        );
      }
      const points = await db.as<{ slug: string }>(ANON, "select slug from public.sales_points");
      expect(points.map((r) => r.slug)).toEqual(["visible"]);
      const hours = await db.as<{ sales_point_id: string }>(
        ANON,
        "select sales_point_id from public.opening_hours",
      );
      expect(hours.map((r) => r.sales_point_id)).toEqual([visible]);
    });
  });

  it("ne peut rien écrire, sauf un signalement", async () => {
    await withDb(async (db) => {
      const pub = await db.createProducer({ owner: null, slug: "pub" });
      expect(
        await db.rejects(ANON, "insert into public.producers (name, slug) values ('X', 'x')"),
      ).toMatch(/permission denied/);
      expect(
        await db.rejects(ANON, "update public.producers set name = 'Pirate' where id = $1", [pub]),
      ).toMatch(/permission denied/);
      await db.as(
        ANON,
        "insert into public.reports (producer_id, reason, details) values ($1, 'wrong_hours', 'Fermé le lundi')",
        [pub],
      );
      expect(await db.sql("select count(*)::int as n from public.reports")).toEqual([{ n: 1 }]);
    });
  });

  it("ne peut ni lire les signalements, ni en créer un déjà « traité »", async () => {
    await withDb(async (db) => {
      const pub = await db.createProducer({ owner: null, slug: "pub" });
      await db.sql("insert into public.reports (producer_id, reason) values ($1, 'other')", [pub]);
      expect(await db.rejects(ANON, "select * from public.reports")).toMatch(/permission denied/);
      expect(
        await db.rejects(
          ANON,
          "insert into public.reports (producer_id, reason, status) values ($1, 'other', 'resolved')",
          [pub],
        ),
      ).toMatch(/row-level security/);
    });
  });

  it("n'a aucun accès aux profils, favoris et invitations", async () => {
    await withDb(async (db) => {
      for (const table of ["profiles", "favorites", "producer_invites"]) {
        expect(await db.rejects(ANON, `select * from public.${table}`)).toMatch(
          /permission denied/,
        );
      }
    });
  });
});

describe("Producteur", () => {
  it("crée sa fiche : forcée en brouillon, à son nom, et son profil devient « producer »", async () => {
    await withDb(async (db) => {
      const a = await db.createUser("a@test.local");
      const [row] = await db.as(
        user(a),
        `insert into public.producers (owner_user_id, name, slug, status, verified_at)
         values ($1, 'Ferme A', 'ferme-a', 'published', now())
         returning status, verified_at, owner_user_id`,
        [a],
      );
      expect(row).toEqual({ status: "draft", verified_at: null, owner_user_id: a });
      expect(await db.sql("select role from public.profiles where id = $1", [a])).toEqual([
        { role: "producer" },
      ]);
    });
  });

  it("ne peut pas créer une fiche au nom de quelqu'un d'autre", async () => {
    await withDb(async (db) => {
      const a = await db.createUser("a@test.local");
      const b = await db.createUser("b@test.local");
      expect(
        await db.rejects(
          user(a),
          "insert into public.producers (owner_user_id, name, slug) values ($1, 'Usurpée', 'usurpee')",
          [b],
        ),
      ).toMatch(/row-level security/);
    });
  });

  it("A ne peut ni lire le brouillon de B, ni modifier la fiche de B, même par appel direct", async () => {
    await withDb(async (db) => {
      const a = await db.createUser("a@test.local");
      const b = await db.createUser("b@test.local");
      const bDraft = await db.createProducer({ owner: b, slug: "b-brouillon", status: "draft" });
      const bPub = await db.createProducer({ owner: b, slug: "b-publie" });
      expect(
        await db.as(user(a), "select id from public.producers where id = $1", [bDraft]),
      ).toEqual([]);
      const updated = await db.as(
        user(a),
        "update public.producers set name = 'Piratée' where id = any($1) returning id",
        [[bDraft, bPub]],
      );
      expect(updated).toEqual([]);
      expect(await db.sql("select name from public.producers where id = $1", [bPub])).toEqual([
        { name: "Test b-publie" },
      ]);
    });
  });

  it("A ne peut pas ajouter, modifier ou supprimer des lieux ou horaires de B", async () => {
    await withDb(async (db) => {
      const a = await db.createUser("a@test.local");
      const b = await db.createUser("b@test.local");
      const bProd = await db.createProducer({ owner: b, slug: "b" });
      const bSp = await db.createSalesPoint({ producerId: bProd, slug: "b-lieu" });
      await db.sql(
        "insert into public.opening_hours (sales_point_id, day_of_week, opens_at, closes_at) values ($1, 1, '09:00', '12:00')",
        [bSp],
      );
      expect(
        await db.rejects(
          user(a),
          `insert into public.sales_points (producer_id, name, type, slug, city, location)
           values ($1, 'Intrus', 'farm', 'intrus', 'X', 'SRID=4326;POINT(0 48)')`,
          [bProd],
        ),
      ).toMatch(/row-level security/);
      expect(
        await db.as(
          user(a),
          "update public.sales_points set name = 'X' where id = $1 returning id",
          [bSp],
        ),
      ).toEqual([]);
      expect(
        await db.as(
          user(a),
          "delete from public.opening_hours where sales_point_id = $1 returning id",
          [bSp],
        ),
      ).toEqual([]);
      expect(
        await db.rejects(
          user(a),
          "insert into public.opening_hours (sales_point_id, day_of_week, opens_at, closes_at) values ($1, 2, '09:00', '12:00')",
          [bSp],
        ),
      ).toMatch(/row-level security/);
    });
  });

  it("ne peut pas déplacer son lieu de vente vers la fiche d'un autre producteur", async () => {
    await withDb(async (db) => {
      const a = await db.createUser("a@test.local");
      const b = await db.createUser("b@test.local");
      const aProd = await db.createProducer({ owner: a, slug: "a" });
      const bProd = await db.createProducer({ owner: b, slug: "b" });
      const aSp = await db.createSalesPoint({ producerId: aProd, slug: "a-lieu" });
      expect(
        await db.rejects(user(a), "update public.sales_points set producer_id = $1 where id = $2", [
          bProd,
          aSp,
        ]),
      ).toMatch(/row-level security/);
    });
  });

  it("gère au moins trois points de vente avec des horaires différents (§13)", async () => {
    await withDb(async (db) => {
      const a = await db.createUser("a@test.local");
      const [prod] = await db.as<{ id: string }>(
        user(a),
        "insert into public.producers (owner_user_id, name, slug) values ($1, 'Ferme A', 'ferme-a') returning id",
        [a],
      );
      const points = [
        { slug: "a-ferme", type: "farm", day: 3, opens: "16:00", closes: "19:00" },
        { slug: "a-marche", type: "market", day: 6, opens: "08:00", closes: "12:30" },
        { slug: "a-distrib", type: "vending_machine", day: 7, opens: "00:00", closes: "23:59" },
      ];
      for (const p of points) {
        const [sp] = await db.as<{ id: string }>(
          user(a),
          `insert into public.sales_points (producer_id, name, type, slug, city, location)
           values ($1, $2, $3, $2, 'Sées', 'SRID=4326;POINT(0.17 48.6)') returning id`,
          [prod?.id, p.slug, p.type],
        );
        await db.as(
          user(a),
          `insert into public.opening_hours (sales_point_id, day_of_week, opens_at, closes_at)
           values ($1, $2, $3, $4)`,
          [sp?.id, p.day, p.opens, p.closes],
        );
      }
      const rows = await db.as<{ slug: string; day_of_week: number }>(
        user(a),
        `select sp.slug, oh.day_of_week from public.sales_points sp
           join public.opening_hours oh on oh.sales_point_id = sp.id order by sp.slug`,
      );
      expect(rows).toEqual([
        { slug: "a-distrib", day_of_week: 7 },
        { slug: "a-ferme", day_of_week: 3 },
        { slug: "a-marche", day_of_week: 6 },
      ]);
    });
  });

  it("peut soumettre sa fiche mais ni la publier, ni la suspendre, ni se l'auto-vérifier", async () => {
    await withDb(async (db) => {
      const a = await db.createUser("a@test.local");
      const prod = await db.createProducer({ owner: a, slug: "a", status: "draft" });
      await db.as(user(a), "update public.producers set status = 'pending_review' where id = $1", [
        prod,
      ]);
      for (const status of ["published", "suspended", "archived"]) {
        expect(
          await db.rejects(user(a), "update public.producers set status = $1 where id = $2", [
            status,
            prod,
          ]),
        ).toMatch(/statut non autorisé/);
      }
      expect(
        await db.rejects(user(a), "update public.producers set verified_at = now() where id = $1", [
          prod,
        ]),
      ).toMatch(/réservé/);
    });
  });

  it("ne peut pas céder sa fiche ni modifier une fiche suspendue en la republiant", async () => {
    await withDb(async (db) => {
      const a = await db.createUser("a@test.local");
      const b = await db.createUser("b@test.local");
      const prod = await db.createProducer({ owner: a, slug: "a", status: "suspended" });
      expect(
        await db.rejects(user(a), "update public.producers set owner_user_id = $1 where id = $2", [
          b,
          prod,
        ]),
      ).toMatch(/propriétaire/);
      expect(
        await db.rejects(user(a), "update public.producers set status = 'draft' where id = $1", [
          prod,
        ]),
      ).toMatch(/statut non autorisé/);
    });
  });

  it("n'a accès ni aux signalements ni aux invitations", async () => {
    await withDb(async (db) => {
      const a = await db.createUser("a@test.local", "producer");
      const prod = await db.createProducer({ owner: a, slug: "a" });
      await db.sql("insert into public.reports (producer_id, reason) values ($1, 'other')", [prod]);
      expect(await db.as(user(a), "select id from public.reports")).toEqual([]);
      expect(
        await db.rejects(
          user(a),
          "insert into public.producer_invites (producer_id, email, token_hash, expires_at) values ($1, 'x@y.fr', 'h', now())",
          [prod],
        ),
      ).toMatch(/row-level security/);
    });
  });

  it("un changement de slug conserve l'ancien comme alias, visible seulement si la fiche est publique", async () => {
    await withDb(async (db) => {
      const a = await db.createUser("a@test.local");
      const pub = await db.createProducer({ owner: a, slug: "ferme-des-pres" });
      const draft = await db.createProducer({
        owner: a,
        slug: "ancien-brouillon",
        status: "draft",
      });
      await db.as(
        user(a),
        "update public.producers set slug = 'ferme-des-pres-de-sees' where id = $1",
        [pub],
      );
      await db.as(user(a), "update public.producers set slug = 'nouveau-brouillon' where id = $1", [
        draft,
      ]);
      const aliases = await db.as<{ old_slug: string; entity_id: string }>(
        ANON,
        "select old_slug, entity_id from public.slug_aliases",
      );
      expect(aliases).toEqual([{ old_slug: "ferme-des-pres", entity_id: pub }]);
    });
  });
});

describe("Favoris", () => {
  it("sont strictement privés et limités aux fiches publiées", async () => {
    await withDb(async (db) => {
      const a = await db.createUser("a@test.local");
      const b = await db.createUser("b@test.local");
      const pub = await db.createProducer({ owner: null, slug: "pub" });
      const draft = await db.createProducer({ owner: null, slug: "brouillon", status: "draft" });
      await db.as(user(a), "insert into public.favorites (user_id, producer_id) values ($1, $2)", [
        a,
        pub,
      ]);
      expect(await db.as(user(a), "select producer_id from public.favorites")).toEqual([
        { producer_id: pub },
      ]);
      expect(await db.as(user(b), "select * from public.favorites")).toEqual([]);
      expect(
        await db.rejects(
          user(b),
          "insert into public.favorites (user_id, producer_id) values ($1, $2)",
          [a, pub],
        ),
      ).toMatch(/row-level security/);
      expect(
        await db.rejects(
          user(a),
          "insert into public.favorites (user_id, producer_id) values ($1, $2)",
          [a, draft],
        ),
      ).toMatch(/row-level security/);
      expect(
        await db.as(user(b), "delete from public.favorites where user_id = $1 returning user_id", [
          a,
        ]),
      ).toEqual([]);
    });
  });
});

describe("Administrateur", () => {
  it("voit toutes les fiches, publie, suspend et vérifie", async () => {
    await withDb(async (db) => {
      const a = await db.createUser("a@test.local");
      const admin = await db.createUser("admin@test.local", "admin");
      const prod = await db.createProducer({ owner: a, slug: "a", status: "pending_review" });
      expect(await db.as(user(admin), "select id from public.producers")).toHaveLength(1);
      await db.as(
        user(admin),
        "update public.producers set status = 'published', verified_at = now() where id = $1",
        [prod],
      );
      expect(await db.as(ANON, "select id from public.producers")).toEqual([{ id: prod }]);
      await db.as(user(admin), "update public.producers set status = 'suspended' where id = $1", [
        prod,
      ]);
      expect(await db.as(ANON, "select id from public.producers")).toEqual([]);
    });
  });

  it("crée une fiche préremplie sans propriétaire, lit et traite les signalements, gère les invitations", async () => {
    await withDb(async (db) => {
      const admin = await db.createUser("admin@test.local", "admin");
      const [prod] = await db.as<{ id: string }>(
        user(admin),
        "insert into public.producers (owner_user_id, name, slug) values (null, 'Préremplie', 'preremplie') returning id",
      );
      await db.as(ANON, "insert into public.reports (producer_id, reason) values ($1, 'closed')", [
        prod?.id,
      ]);
      const [report] = await db.as<{ id: string }>(user(admin), "select id from public.reports");
      await db.as(
        user(admin),
        "update public.reports set status = 'resolved', resolved_at = now() where id = $1",
        [report?.id],
      );
      await db.as(
        user(admin),
        "insert into public.producer_invites (producer_id, email, token_hash, expires_at, created_by) values ($1, 'ferme@exemple.fr', 'sha256-hash', now() + interval '7 days', $2)",
        [prod?.id, admin],
      );
      expect(await db.as(user(admin), "select email from public.producer_invites")).toEqual([
        { email: "ferme@exemple.fr" },
      ]);
    });
  });

  it("gère le référentiel des catégories ; un producteur ne le peut pas", async () => {
    await withDb(async (db) => {
      const a = await db.createUser("a@test.local", "producer");
      const admin = await db.createUser("admin@test.local", "admin");
      expect(
        await db.rejects(
          user(a),
          "insert into public.categories (name, slug) values ('Escargots', 'escargots')",
        ),
      ).toMatch(/row-level security/);
      await db.as(
        user(admin),
        "insert into public.categories (name, slug) values ('Escargots', 'escargots')",
      );
      await db.as(
        user(admin),
        "update public.categories set active = false where slug = 'escargots'",
      );
      expect(
        await db.as(ANON, "select slug from public.categories where slug = 'escargots'"),
      ).toEqual([]);
    });
  });
});
