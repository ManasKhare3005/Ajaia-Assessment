import { NextResponse } from "next/server";
import { unshareDocument } from "@/lib/documents";
import { route } from "@/lib/http";
import { requireUser } from "@/lib/session";

type Ctx = { params: Promise<{ id: string; userId: string }> };

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id, userId } = await params;
  await unshareDocument(id, user, userId);
  return new NextResponse(null, { status: 204 });
});
