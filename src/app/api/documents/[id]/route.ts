import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_TITLE_LENGTH, normalizeTitle, validateContent } from "@/lib/content";
import { deleteDocument, getDocumentForUser, updateDocument } from "@/lib/documents";
import { HttpError, parseJson, route } from "@/lib/http";
import { requireUser } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const { doc, access, ownerName } = await getDocumentForUser(id, user);
  return NextResponse.json({ ...doc, access, ownerName });
});

const Patch = z
  .object({
    title: z.string().max(MAX_TITLE_LENGTH, "Title is too long.").optional(),
    content: z.unknown().optional(),
    baseVersion: z.number().int().positive().optional(),
  })
  .refine((b) => b.title !== undefined || b.content !== undefined, "Nothing to update.");

export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const body = await parseJson(req, Patch);

  let title: string | undefined;
  if (body.title !== undefined) {
    title = normalizeTitle(body.title);
    if (!title) throw new HttpError(400, "Title can't be empty.");
  }
  let content;
  if (body.content !== undefined) {
    const result = validateContent(body.content);
    if (!result.ok) throw new HttpError(400, result.reason);
    content = result.content;
  }
  const updated = await updateDocument(id, user, { title, content, baseVersion: body.baseVersion });
  return NextResponse.json(updated);
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  await deleteDocument(id, user);
  return new NextResponse(null, { status: 204 });
});
