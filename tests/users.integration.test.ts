/**
 * Demo-account creation against Postgres. Skipped unless TEST_DATABASE_URL is set.
 */
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SEED_USERS } from "@/lib/seed-users";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("demo accounts against Postgres", () => {
  let users: typeof import("@/lib/users");
  let docs: typeof import("@/lib/documents");
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ db } = await import("@/db"));
    schema = await import("@/db/schema");
    users = await import("@/lib/users");
    docs = await import("@/lib/documents");
    await migrate(db, { migrationsFolder: "./drizzle" });
  });

  beforeEach(async () => {
    await db.execute(sql`truncate users, documents, shares cascade`);
    await db.insert(schema.users).values(SEED_USERS);
  });

  it("creates an account with a normalized name and lowercase email", async () => {
    const u = await users.createUser({ name: "  Dana   Lee ", email: " Dana@Example.COM " });
    expect(u).toMatchObject({ name: "Dana Lee", email: "dana@example.com" });
  });

  it("rejects an email that's already taken, ignoring case", async () => {
    await users.createUser({ name: "Dana", email: "dana@example.com" });
    await expect(users.createUser({ name: "Other", email: "DANA@example.com" })).rejects.toMatchObject({ status: 409, code: "email_taken" });
    await expect(users.createUser({ name: "Fake Alice", email: "alice@ajaia.test" })).rejects.toMatchObject({ status: 409 });
  });

  it("rejects a blank name", async () => {
    await expect(users.createUser({ name: "   ", email: "x@example.com" })).rejects.toMatchObject({ status: 400 });
  });

  it("always lists the three demo accounts first, then created accounts newest first", async () => {
    await users.createUser({ name: "First", email: "first@example.com" });
    await new Promise((r) => setTimeout(r, 15));
    await users.createUser({ name: "Second", email: "second@example.com" });
    const list = await users.listUsers();
    expect(list.map((u) => u.email)).toEqual([
      ...SEED_USERS.map((u) => u.email),
      "second@example.com",
      "first@example.com",
    ]);
    expect(list.map((u) => u.seeded)).toEqual([true, true, true, false, false]);
  });

  it("lets a new account share with the demo accounts and receive shares", async () => {
    const dana = await users.createUser({ name: "Dana", email: "dana@example.com" });
    const [alice] = await db.select().from(schema.users).where(sql`email = 'alice@ajaia.test'`);
    const { id } = await docs.createDocument(dana, "Dana's notes", { type: "doc", content: [{ type: "paragraph" }] });
    await docs.shareDocument(id, dana, "alice@ajaia.test", "viewer");
    expect((await docs.listDocuments(alice)).shared).toMatchObject([{ id, ownerName: "Dana", access: "viewer" }]);

    const { id: aliceDoc } = await docs.createDocument(alice, "For Dana", { type: "doc", content: [{ type: "paragraph" }] });
    await docs.shareDocument(aliceDoc, alice, "dana@example.com", "editor");
    expect((await docs.listDocuments(dana)).shared).toMatchObject([{ id: aliceDoc, access: "editor" }]);
  });
});
