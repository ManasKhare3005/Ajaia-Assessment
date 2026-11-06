import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { route } from "@/lib/http";

// Demo-only directory of seeded accounts (used by the sign-in screen and the
// share dialog). A real product would search users rather than list them all.
export const GET = route(async () => {
  const users = await db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
    .from(schema.users)
    .orderBy(schema.users.name);
  return NextResponse.json({ users });
});
