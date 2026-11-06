import { describe, expect, it } from "vitest";
import { can, resolveAccess, validateShareTarget, type Access, type Action } from "@/lib/access";

const doc = { ownerId: "owner" };
const shares = [
  { userId: "ed", role: "editor" as const },
  { userId: "vi", role: "viewer" as const },
];

describe("resolveAccess", () => {
  it("gives the owner owner access even if they also appear in shares", () => {
    expect(resolveAccess(doc, [...shares, { userId: "owner", role: "viewer" }], "owner")).toBe("owner");
  });
  it("uses the share role for invited users", () => {
    expect(resolveAccess(doc, shares, "ed")).toBe("editor");
    expect(resolveAccess(doc, shares, "vi")).toBe("viewer");
  });
  it("gives no access to everyone else", () => {
    expect(resolveAccess(doc, shares, "stranger")).toBeNull();
  });
});

describe("can", () => {
  const matrix: Record<Action, Record<Access | "none", boolean>> = {
    read: { owner: true, editor: true, viewer: true, none: false },
    edit: { owner: true, editor: true, viewer: false, none: false },
    rename: { owner: true, editor: true, viewer: false, none: false },
    share: { owner: true, editor: false, viewer: false, none: false },
    delete: { owner: true, editor: false, viewer: false, none: false },
  };
  for (const [action, row] of Object.entries(matrix) as [Action, Record<string, boolean>][]) {
    for (const [who, allowed] of Object.entries(row)) {
      it(`${who} ${allowed ? "can" : "cannot"} ${action}`, () => {
        expect(can(who === "none" ? null : (who as Access), action)).toBe(allowed);
      });
    }
  }
});

describe("validateShareTarget", () => {
  it("rejects sharing with the owner", () => {
    expect(validateShareTarget(doc, "owner").ok).toBe(false);
  });
  it("allows sharing with anyone else", () => {
    expect(validateShareTarget(doc, "ed").ok).toBe(true);
  });
});
