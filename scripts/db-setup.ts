/**
 * Applies migrations and seeds demo data. Idempotent: safe to run on every deploy.
 *   npm run db:setup
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ quiet: true });

import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as schema from "../src/db/schema";
import { SEED_USERS } from "../src/lib/seed-users";

const { users, documents, shares } = schema;

const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
const h = (level: number, text: string) => ({
  type: "heading",
  attrs: { level },
  content: [{ type: "text", text }],
});
const bullets = (items: string[]) => ({
  type: "bulletList",
  content: items.map((t) => ({ type: "listItem", content: [p(t)] })),
});

const SEED_DOCS = [
  {
    owner: "alice@ajaia.test",
    title: "Q4 planning",
    shareWith: [{ email: "bob@ajaia.test", role: "editor" as const }],
    content: {
      type: "doc",
      content: [
        h(1, "Q4 Planning"),
        {
          type: "paragraph",
          content: [
            { type: "text", text: "This doc is owned by " },
            { type: "text", marks: [{ type: "bold" }], text: "Alice" },
            { type: "text", text: " and shared with Bob as an " },
            { type: "text", marks: [{ type: "italic" }], text: "editor" },
            { type: "text", text: "." },
          ],
        },
        h(2, "Goals"),
        bullets(["Ship the editor pilot", "Collect feedback from two teams"]),
      ],
    },
  },
  {
    owner: "bob@ajaia.test",
    title: "Team handbook",
    shareWith: [{ email: "alice@ajaia.test", role: "viewer" as const }],
    content: {
      type: "doc",
      content: [
        h(1, "Team handbook"),
        p("Alice can read this document but cannot edit it — the toolbar is disabled for viewers."),
      ],
    },
  },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = new Pool({
    connectionString: url,
    ssl: /sslmode=require/.test(url) ? { rejectUnauthorized: false } : undefined,
  });
  const db = drizzle(pool, { schema });

  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("✓ migrations applied");

  await db.insert(users).values(SEED_USERS).onConflictDoNothing({ target: users.email });
  const all = await db.select().from(users);
  const byEmail = new Map(all.map((u) => [u.email, u]));
  console.log(`✓ ${SEED_USERS.length} seed users present`);

  for (const d of SEED_DOCS) {
    const owner = byEmail.get(d.owner)!;
    const existing = await db
      .select({ id: documents.id })
      .from(documents)
      .where(and(eq(documents.ownerId, owner.id), eq(documents.title, d.title)));
    if (existing.length) continue;
    const [doc] = await db
      .insert(documents)
      .values({ title: d.title, content: d.content, ownerId: owner.id, lastEditedById: owner.id })
      .returning();
    for (const s of d.shareWith) {
      await db
        .insert(shares)
        .values({ documentId: doc.id, userId: byEmail.get(s.email)!.id, role: s.role });
    }
    console.log(`✓ seeded "${d.title}"`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
