import type { JSONContent } from "@tiptap/core";
import { notFound, redirect } from "next/navigation";
import { DocEditor } from "@/components/DocEditor";
import { TopBar } from "@/components/TopBar";
import { getDocumentForUser } from "@/lib/documents";
import { HttpError } from "@/lib/http";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DocPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;

  let result;
  try {
    result = await getDocumentForUser(id, user);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }
  const { doc, access, ownerName } = result;

  return (
    <>
      <TopBar user={user} />
      <DocEditor
        doc={{
          id: doc.id,
          title: doc.title,
          content: doc.content as JSONContent,
          version: doc.version,
          access,
          ownerName,
        }}
      />
    </>
  );
}
