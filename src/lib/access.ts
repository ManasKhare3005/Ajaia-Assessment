/**
 * Access control for documents. Pure functions with no I/O, so every API route
 * goes through one place and the rules can be unit-tested directly.
 */
import type { ShareRole } from "@/db/schema";

export type Access = "owner" | ShareRole;
export type Action = "read" | "edit" | "rename" | "share" | "delete";

const PERMISSIONS: Record<Action, readonly Access[]> = {
  read: ["owner", "editor", "viewer"],
  edit: ["owner", "editor"],
  rename: ["owner", "editor"],
  share: ["owner"],
  delete: ["owner"],
};

export function resolveAccess(
  doc: { ownerId: string },
  shares: ReadonlyArray<{ userId: string; role: ShareRole }>,
  userId: string,
): Access | null {
  if (doc.ownerId === userId) return "owner";
  const share = shares.find((s) => s.userId === userId);
  return share ? share.role : null;
}

export function can(access: Access | null, action: Action): boolean {
  return access !== null && PERMISSIONS[action].includes(access);
}

/** Rules for granting access, kept here so the API and the tests share them. */
export function validateShareTarget(
  doc: { ownerId: string },
  targetUserId: string,
): { ok: true } | { ok: false; reason: string } {
  if (targetUserId === doc.ownerId) {
    return { ok: false, reason: "The owner already has full access." };
  }
  return { ok: true };
}
