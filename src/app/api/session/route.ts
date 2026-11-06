import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { HttpError, parseJson, route } from "@/lib/http";
import { SESSION_COOKIE, withSession } from "@/lib/session";

const Body = z.object({ userId: z.uuid({ message: "Choose a user to sign in as." }) });

export const POST = route(async (req) => {
  const { userId } = await parseJson(req, Body);
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  if (!user) throw new HttpError(404, "That user doesn't exist.");
  return withSession(NextResponse.json({ user }), user.id);
});

export const DELETE = route(async () => {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
});
