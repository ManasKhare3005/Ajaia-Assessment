import { NextResponse } from "next/server";
import { createDocument } from "@/lib/documents";
import { HttpError, route } from "@/lib/http";
import { fileToDocument } from "@/lib/import";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

export const POST = route(async (req) => {
  const user = await requireUser();
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new HttpError(400, "Upload a file using multipart/form-data.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "No file was uploaded.");

  const { title, content } = await fileToDocument(file.name, Buffer.from(await file.arrayBuffer()));
  const doc = await createDocument(user, title, content);
  return NextResponse.json(doc, { status: 201 });
});
