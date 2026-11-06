"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { DocumentSummary } from "@/lib/documents";
import { api, timeAgo } from "@/lib/api-client";
import { MAX_UPLOAD_BYTES, SUPPORTED_EXTENSIONS, SUPPORTED_LABEL } from "@/lib/import-constants";

type Props = { firstName: string; owned: DocumentSummary[]; shared: DocumentSummary[] };

export function Dashboard({ firstName, owned, shared }: Props) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"create" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createDoc() {
    setBusy("create");
    setError(null);
    try {
      const { id } = await api<{ id: string }>("/api/documents", { method: "POST", body: "{}" });
      router.push(`/docs/${id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  async function importFile(file: File) {
    setError(null);
    const ext = file.name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? "";
    if (!(SUPPORTED_EXTENSIONS as readonly string[]).includes(ext)) {
      setError(`“${file.name}” isn't supported. Upload a ${SUPPORTED_LABEL} file.`);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`“${file.name}” is larger than 5 MB.`);
      return;
    }
    setBusy("import");
    try {
      const form = new FormData();
      form.append("file", file);
      const { id } = await api<{ id: string }>("/api/documents/import", { method: "POST", body: form });
      router.push(`/docs/${id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  async function deleteDoc(doc: DocumentSummary) {
    if (!confirm(`Delete “${doc.title}”? People it's shared with will lose access too.`)) return;
    try {
      await api(`/api/documents/${doc.id}`, { method: "DELETE" });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <main className="dash">
      <div className="dash-head">
        <h1>{firstName}&rsquo;s documents</h1>
        <button className="btn" onClick={() => fileInput.current?.click()} disabled={busy !== null}>
          {busy === "import" ? "Importing…" : "Import file"}
        </button>
        <button className="btn btn-primary" onClick={createDoc} disabled={busy !== null}>
          {busy === "create" ? "Creating…" : "New document"}
        </button>
        <input
          ref={fileInput}
          type="file"
          className="visually-hidden"
          accept={SUPPORTED_EXTENSIONS.join(",")}
          aria-label="Import a file as a new document"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) importFile(f);
          }}
        />
      </div>
      <p className="dash-hint">Import a {SUPPORTED_LABEL} file to turn it into a new editable document.</p>
      {error && (
        <div className="alert" role="alert">
          {error}
          <button className="btn btn-ghost" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <section className="section" aria-labelledby="owned-h">
        <div className="section-head">
          <h2 id="owned-h">My documents</h2>
          <span className="count">{owned.length}</span>
        </div>
        {owned.length === 0 ? (
          <div className="empty">
            <p>You haven&rsquo;t created any documents yet.</p>
            <p className="sub">Start a new one or import a file.</p>
          </div>
        ) : (
          <ul className="doc-list">
            {owned.map((d) => (
              <li key={d.id} className="doc-row">
                <span className="doc-icon" aria-hidden />
                <div className="doc-main">
                  <Link href={`/docs/${d.id}`} className="doc-title">
                    {d.title}
                  </Link>
                  <span className="doc-meta">
                    <span className="when">
                      Edited {d.lastEditedByName ? `by ${d.lastEditedByName} ` : ""}
                      {timeAgo(d.updatedAt)}
                    </span>
                    {d.sharedWithCount > 0 &&
                      ` — shared with ${d.sharedWithCount} ${d.sharedWithCount === 1 ? "person" : "people"}`}
                  </span>
                </div>
                <span className="badge badge-owner">Owner</span>
                <span className="row-actions">
                  <button className="btn btn-ghost" onClick={() => deleteDoc(d)} aria-label={`Delete ${d.title}`}>
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section" aria-labelledby="shared-h">
        <div className="section-head">
          <h2 id="shared-h">Shared with me</h2>
          <span className="count">{shared.length}</span>
        </div>
        {shared.length === 0 ? (
          <div className="empty">
            <p>Nothing has been shared with you yet.</p>
            <p className="sub">Documents other people share with you will appear here.</p>
          </div>
        ) : (
          <ul className="doc-list">
            {shared.map((d) => (
              <li key={d.id} className="doc-row shared">
                <span className="doc-icon" aria-hidden />
                <div className="doc-main">
                  <Link href={`/docs/${d.id}`} className="doc-title">
                    {d.title}
                  </Link>
                  <span className="doc-meta">
                    From {d.ownerName}
                    <span className="when">
                      {" "}— edited {d.lastEditedByName ? `by ${d.lastEditedByName} ` : "by you "}
                      {timeAgo(d.updatedAt)}
                    </span>
                  </span>
                </div>
                <span className={d.access === "viewer" ? "badge badge-muted" : "badge"}>
                  {d.access === "viewer" ? "Can view" : "Can edit"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
