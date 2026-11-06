/**
 * Demo accounts. The three seeded users are always offered first; testers can also
 * create their own (name + email, no password, matching the mocked sign-in).
 */
import { count, desc, eq, inArray, notInArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { HttpError } from "./http";
import { SEED_USERS } from "./seed-users";

const { users } = schema;
const SEED_EMAILS = SEED_USERS.map((u) => u.email);

/** Keeps a public demo from growing without bound. */
export const MAX_USERS = 500;
/** How many tester-created accounts the sign-in screen lists. */
export const RECENT_ACCOUNTS_SHOWN = 20;

export type DirectoryUser = { id: string; name: string; email: string; seeded: boolean };

export async function listUsers(): Promise<DirectoryUser[]> {
  const cols = { id: users.id, name: users.name, email: users.email };
  const seeded = await db.select(cols).from(users).where(inArray(users.email, SEED_EMAILS));
  const created = await db
    .select(cols)
    .from(users)
    .where(notInArray(users.email, SEED_EMAILS))
    .orderBy(desc(users.createdAt))
    .limit(RECENT_ACCOUNTS_SHOWN);
  return [
    ...seeded
      .sort((a, b) => SEED_EMAILS.indexOf(a.email) - SEED_EMAILS.indexOf(b.email))
      .map((u) => ({ ...u, seeded: true })),
    ...created.map((u) => ({ ...u, seeded: false })),
  ];
}

export function normalizeName(raw: string) {
  return raw.replace(/\s+/g, " ").trim();
}

export async function createUser(input: { name: string; email: string }) {
  const name = normalizeName(input.name);
  const email = input.email.trim().toLowerCase();
  if (!name) throw new HttpError(400, "Enter your name.");

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing) {
    throw new HttpError(409, "An account with that email already exists. Choose it from the list instead.", "email_taken");
  }
  const [{ total }] = await db.select({ total: count() }).from(users);
  if (total >= MAX_USERS) throw new HttpError(429, "This demo has reached its account limit. Use one of the demo accounts.");

  const [user] = await db
    .insert(users)
    .values({ name, email })
    .onConflictDoNothing({ target: users.email })
    .returning();
  // Two requests racing for the same email: the second loses here.
  if (!user) throw new HttpError(409, "An account with that email already exists. Choose it from the list instead.", "email_taken");
  return user;
}
