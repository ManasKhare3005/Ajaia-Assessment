/**
 * Runs the real data layer against Postgres. Skipped unless TEST_DATABASE_URL is
 * set, so `npm test` works without a database:
 *   TEST_DATABASE_URL=postgres://postgres@localhost:5432/docs_test npm test
 */
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { User } from "@/db/schema";

const url = process.env.TEST_DATABASE_URL;
const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

describe.skipIf(!url)("sharing and saving against Postgres", () => {
  let lib: typeof import("@/lib/documents");
  let db: typeof import("@/db").db;
  let users: typeof import("@/db/schema").users;
  let alice: User, bob: User, carol: User;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ db } = await import("@/db"));
    ({ users } = await import("@/db/schema"));
    lib = await import("@/lib/documents");
    await migrate(db, { migrationsFolder: "./drizzle" });
  });

  beforeEach(async () => {
    await db.execute(sql`truncate users, documents, shares cascade`);
    [alice, bob, carol] = await db
      .insert(users)
      .values([
        { email: "alice@t.test", name: "Alice" },
        { email: "bob@t.test", name: "Bob" },
        { email: "carol@t.test", name: "Carol" },
      ])
      .returning();
  });

  it("shows a shared doc under 'shared' for the recipient only", async () => {
    const { id } = await lib.createDocument(alice, "Plan", doc("hi"));
    await lib.shareDocument(id, alice, "BOB@t.test ", "viewer");

    const forAlice = await lib.listDocuments(alice);
    const forBob = await lib.listDocuments(bob);
    const forCarol = await lib.listDocuments(carol);

    expect(forAlice.owned.map((d) => d.id)).toEqual([id]);
    expect(forAlice.owned[0].sharedWithCount).toBe(1);
    expect(forBob.owned).toHaveLength(0);
    expect(forBob.shared).toMatchObject([{ id, access: "viewer", ownerName: "Alice" }]);
    expect(forCarol.shared).toHaveLength(0);
    await expect(lib.getDocumentForUser(id, carol)).rejects.toMatchObject({ status: 404 });
  });

  it("enforces roles: viewers can't edit, editors can't share or delete", async () => {
    const { id } = await lib.createDocument(alice, "Plan", doc("v1"));
    await lib.shareDocument(id, alice, "bob@t.test", "viewer");
    await expect(lib.updateDocument(id, bob, { content: doc("x"), baseVersion: 1 })).rejects.toMatchObject({ status: 403 });

    await lib.shareDocument(id, alice, "bob@t.test", "editor"); // upgrade, not a duplicate
    expect(await lib.listShares(id, alice)).toHaveLength(1);
    await expect(lib.updateDocument(id, bob, { content: doc("by bob"), baseVersion: 1 })).resolves.toMatchObject({ version: 2 });
    await expect(lib.shareDocument(id, bob, "carol@t.test", "viewer")).rejects.toMatchObject({ status: 403 });
    await expect(lib.deleteDocument(id, bob)).rejects.toMatchObject({ status: 403 });
  });

  it("rejects a save based on a stale version instead of overwriting", async () => {
    const { id } = await lib.createDocument(alice, "Plan", doc("v1"));
    await lib.shareDocument(id, alice, "bob@t.test", "editor");

    await lib.updateDocument(id, bob, { content: doc("bob's edit"), baseVersion: 1 });
    await expect(lib.updateDocument(id, alice, { content: doc("alice's stale edit"), baseVersion: 1 }))
      .rejects.toMatchObject({ status: 409, code: "version_conflict" });

    const { doc: saved } = await lib.getDocumentForUser(id, alice);
    expect(JSON.stringify(saved.content)).toContain("bob's edit");
    // A rename doesn't bump the content version, so it can't cause conflicts.
    await lib.updateDocument(id, alice, { title: "Renamed" });
    await expect(lib.updateDocument(id, alice, { content: doc("v3"), baseVersion: 2 })).resolves.toMatchObject({ version: 3 });
  });

  it("removes access when a share is revoked or the doc is deleted", async () => {
    const { id } = await lib.createDocument(alice, "Plan", doc("v1"));
    await lib.shareDocument(id, alice, "bob@t.test", "editor");
    await lib.unshareDocument(id, alice, bob.id);
    await expect(lib.getDocumentForUser(id, bob)).rejects.toMatchObject({ status: 404 });

    await lib.deleteDocument(id, alice);
    await expect(lib.getDocumentForUser(id, alice)).rejects.toMatchObject({ status: 404 });
  });
});
