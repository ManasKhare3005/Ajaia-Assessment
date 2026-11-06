import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJson, route } from "@/lib/http";
import { withSession } from "@/lib/session";
import { createUser, listUsers } from "@/lib/users";

// Demo-only directory (sign-in screen and share-dialog suggestions): the seeded
// accounts plus the most recently created ones. A real product would search
// users rather than list them.
export const GET = route(async () => {
  return NextResponse.json({ users: await listUsers() });
});

const Body = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(60, "Name is too long (60 characters max)."),
  email: z.email({ message: "Enter a valid email address." }).max(254, "Email is too long."),
});

/** Creates a demo account and signs the new user in. No password, by design. */
export const POST = route(async (req) => {
  const input = await parseJson(req, Body);
  const user = await createUser(input);
  return withSession(
    NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } }, { status: 201 }),
    user.id,
  );
});
