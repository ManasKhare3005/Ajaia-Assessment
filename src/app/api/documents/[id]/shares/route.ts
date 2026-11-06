import { NextResponse } from "next/server";
import { z } from "zod";
import { listShares, shareDocument } from "@/lib/documents";
import { parseJson, route } from "@/lib/http";
import { requireUser } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  return NextResponse.json({ shares: await listShares(id, user) });
});

const Body = z.object({
  email: z.email({ message: "Enter a valid email address." }),
  role: z.enum(["editor", "viewer"]).default("editor"),
});

export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const { email, role } = await parseJson(req, Body);
  return NextResponse.json(await shareDocument(id, user, email, role), { status: 201 });
});
