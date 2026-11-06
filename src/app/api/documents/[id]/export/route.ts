import { getDocumentForUser } from "@/lib/documents";
import { route } from "@/lib/http";
import { toMarkdown } from "@/lib/markdown";
import { requireUser } from "@/lib/session";
import type { JSONContent } from "@tiptap/core";

type Ctx = { params: Promise<{ id: string }> };

/** Downloads the document as Markdown. Anyone who can read the doc can export it. */
export const GET = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const { doc } = await getDocumentForUser(id, user, "read");

  const markdown = toMarkdown(doc.content as JSONContent, doc.title);
  const safeName = doc.title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 80) || "document";
  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}.md"; filename*=UTF-8''${encodeURIComponent(doc.title.slice(0, 80))}.md`,
      "Cache-Control": "no-store",
    },
  });
});
