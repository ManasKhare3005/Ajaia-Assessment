/**
 * Data access for documents and shares. Every function takes the acting user
 * and enforces permissions through lib/access before touching data.
 */
import type { JSONContent } from "@tiptap/core";
import { and, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, schema } from "@/db";
import type { ShareRole, User } from "@/db/schema";
import { can, resolveAccess, validateShareTarget, type Access, type Action } from "./access";
import { HttpError } from "./http";

const { documents, shares, users } = schema;
const lastEditor = alias(users, "last_editor");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type DocumentSummary = {
  id: string;
  title: string;
  updatedAt: string;
  ownerName: string;
  /** null when the current user made the last edit (or nobody is recorded). */
  lastEditedByName: string | null;
  access: Access;
  sharedWithCount: number;
};

export async function listDocuments(user: User) {
  const owned = await db
    .select({
      id: documents.id,
      title: documents.title,
      updatedAt: documents.updatedAt,
      lastEditedById: documents.lastEditedById,
      lastEditedByName: lastEditor.name,
      sharedWithCount: sql<number>`(select count(*)::int from ${shares} where ${shares.documentId} = ${documents.id})`,
    })
    .from(documents)
    .leftJoin(lastEditor, eq(documents.lastEditedById, lastEditor.id))
    .where(eq(documents.ownerId, user.id))
    .orderBy(desc(documents.updatedAt));

  const shared = await db
    .select({
      id: documents.id,
      title: documents.title,
      updatedAt: documents.updatedAt,
      lastEditedById: documents.lastEditedById,
      lastEditedByName: lastEditor.name,
      ownerName: users.name,
      role: shares.role,
    })
    .from(shares)
    .innerJoin(documents, eq(shares.documentId, documents.id))
    .innerJoin(users, eq(documents.ownerId, users.id))
    .leftJoin(lastEditor, eq(documents.lastEditedById, lastEditor.id))
    .where(eq(shares.userId, user.id))
    .orderBy(desc(documents.updatedAt));

  const editorName = (d: { lastEditedById: string | null; lastEditedByName: string | null }) =>
    d.lastEditedById === user.id ? null : d.lastEditedByName;

  return {
    owned: owned.map<DocumentSummary>((d) => ({
      id: d.id,
      title: d.title,
      updatedAt: d.updatedAt.toISOString(),
      ownerName: user.name,
      lastEditedByName: editorName(d),
      access: "owner",
      sharedWithCount: d.sharedWithCount,
    })),
    shared: shared.map<DocumentSummary>((d) => ({
      id: d.id,
      title: d.title,
      updatedAt: d.updatedAt.toISOString(),
      ownerName: d.ownerName,
      lastEditedByName: editorName(d),
      access: d.role,
      sharedWithCount: 0,
    })),
  };
}

/** Loads a document the user can access, or 404s (we don't reveal that it exists). */
export async function getDocumentForUser(docId: string, user: User, action: Action = "read") {
  if (!UUID_RE.test(docId)) throw new HttpError(404, "Document not found.");
  const [row] = await db
    .select({
      doc: documents,
      ownerName: users.name,
      ownerEmail: users.email,
      lastEditedByName: lastEditor.name,
    })
    .from(documents)
    .innerJoin(users, eq(documents.ownerId, users.id))
    .leftJoin(lastEditor, eq(documents.lastEditedById, lastEditor.id))
    .where(eq(documents.id, docId));
  if (!row) throw new HttpError(404, "Document not found.");

  const docShares = await db
    .select({ userId: shares.userId, role: shares.role })
    .from(shares)
    .where(eq(shares.documentId, docId));
  const access = resolveAccess(row.doc, docShares, user.id);
  if (!can(access, "read")) throw new HttpError(404, "Document not found.");
  if (!can(access, action)) {
    throw new HttpError(403, `You have ${access} access and can't ${action} this document.`);
  }
  return { ...row, access: access! };
}

export async function createDocument(user: User, title: string, content: JSONContent) {
  const [doc] = await db
    .insert(documents)
    .values({ title, content, ownerId: user.id, lastEditedById: user.id })
    .returning({ id: documents.id });
  return doc;
}

export async function updateDocument(
  docId: string,
  user: User,
  patch: { title?: string; content?: JSONContent; baseVersion?: number },
) {
  const { doc, access } = await getDocumentForUser(docId, user, "read");
  if (patch.title !== undefined && !can(access, "rename")) {
    throw new HttpError(403, "You can't rename this document.");
  }
  if (patch.content === undefined) {
    // Rename only: doesn't bump the content version, so it never conflicts with edits.
    const [updated] = await db
      .update(documents)
      .set({ title: patch.title, updatedAt: new Date(), lastEditedById: user.id })
      .where(eq(documents.id, doc.id))
      .returning({ version: documents.version, updatedAt: documents.updatedAt });
    return updated;
  }

  if (!can(access, "edit")) throw new HttpError(403, "You have view-only access.");
  if (patch.baseVersion === undefined) throw new HttpError(400, "baseVersion is required when saving content.");

  // Optimistic concurrency: only write if nobody saved since this client loaded.
  const [updated] = await db
    .update(documents)
    .set({
      content: patch.content,
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      version: sql`${documents.version} + 1`,
      updatedAt: new Date(),
      lastEditedById: user.id,
    })
    .where(and(eq(documents.id, doc.id), eq(documents.version, patch.baseVersion)))
    .returning({ version: documents.version, updatedAt: documents.updatedAt });

  if (!updated) {
    // Tell the client who got there first, so the message is concrete.
    const [current] = await db
      .select({ version: documents.version, name: lastEditor.name, editorId: documents.lastEditedById })
      .from(documents)
      .leftJoin(lastEditor, eq(documents.lastEditedById, lastEditor.id))
      .where(eq(documents.id, doc.id));
    const who = current?.editorId === user.id ? "You (in another tab)" : (current?.name ?? "Someone else");
    throw new HttpError(
      409,
      `${who} saved a newer version while you were editing.`,
      "version_conflict",
      { latestVersion: current?.version, savedBy: who },
    );
  }
  return updated;
}

export async function deleteDocument(docId: string, user: User) {
  const { doc } = await getDocumentForUser(docId, user, "delete");
  await db.delete(documents).where(eq(documents.id, doc.id));
}

export async function listShares(docId: string, user: User) {
  await getDocumentForUser(docId, user, "read");
  return db
    .select({ userId: users.id, name: users.name, email: users.email, role: shares.role })
    .from(shares)
    .innerJoin(users, eq(shares.userId, users.id))
    .where(eq(shares.documentId, docId))
    .orderBy(users.name);
}

export async function shareDocument(docId: string, user: User, email: string, role: ShareRole) {
  const { doc } = await getDocumentForUser(docId, user, "share");
  const [target] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
  if (!target) throw new HttpError(404, `No user with the email ${email}.`);
  const check = validateShareTarget(doc, target.id);
  if (!check.ok) throw new HttpError(400, check.reason);

  await db
    .insert(shares)
    .values({ documentId: doc.id, userId: target.id, role })
    .onConflictDoUpdate({ target: [shares.documentId, shares.userId], set: { role } });
  return { userId: target.id, name: target.name, email: target.email, role };
}

export async function unshareDocument(docId: string, user: User, targetUserId: string) {
  const { doc } = await getDocumentForUser(docId, user, "share");
  if (!UUID_RE.test(targetUserId)) throw new HttpError(404, "Share not found.");
  await db
    .delete(shares)
    .where(and(eq(shares.documentId, doc.id), eq(shares.userId, targetUserId)));
}
