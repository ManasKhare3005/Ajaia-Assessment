import { NextResponse } from "next/server";
import { z } from "zod";
import { EMPTY_DOC, MAX_TITLE_LENGTH, normalizeTitle } from "@/lib/content";
import { createDocument, listDocuments } from "@/lib/documents";
import { parseJson, route } from "@/lib/http";
import { requireUser } from "@/lib/session";

export const GET = route(async () => {
  const user = await requireUser();
  return NextResponse.json(await listDocuments(user));
});

const Body = z.object({
  title: z.string().max(MAX_TITLE_LENGTH, "Title is too long.").optional(),
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const { title } = await parseJson(req, Body);
  const doc = await createDocument(user, normalizeTitle(title ?? "") || "Untitled document", EMPTY_DOC);
  return NextResponse.json(doc, { status: 201 });
});
