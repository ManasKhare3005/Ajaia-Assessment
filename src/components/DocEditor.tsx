"use client";

import type { JSONContent } from "@tiptap/core";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Access } from "@/lib/access";
import { ApiError, api } from "@/lib/api-client";
import { editorExtensions } from "@/lib/editor-extensions";
import { ShareDialog } from "./ShareDialog";
import { Toolbar } from "./Toolbar";

type Doc = {
  id: string;
  title: string;
  content: JSONContent;
  version: number;
  access: Access;
  ownerName: string;
};

type SaveState = "saved" | "unsaved" | "saving" | "error" | "conflict";

const SAVE_LABEL: Record<SaveState, string> = {
  saved: "Saved",
  unsaved: "Unsaved changes",
  saving: "Saving…",
  error: "Not saved",
  conflict: "Out of date",
};

const AUTOSAVE_MS = 800;

export function DocEditor({ doc }: { doc: Doc }) {
  const canEdit = doc.access !== "viewer";
  const isOwner = doc.access === "owner";

  const [title, setTitle] = useState(doc.title);
  const savedTitle = useRef(doc.title);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  // Autosave bookkeeping lives in refs so it isn't reset by re-renders.
  const version = useRef(doc.version);
  const inFlight = useRef(false);
  const dirty = useRef(false);
  const blocked = useRef(false); // set after a version conflict
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flushRef = useRef<() => void>(() => {});

  const editor = useEditor({
    extensions: [...editorExtensions, Placeholder.configure({ placeholder: "Start writing…" })],
    content: doc.content,
    editable: canEdit,
    immediatelyRender: false,
    editorProps: { attributes: { class: "prose", "aria-label": "Document body" } },
    onUpdate: () => {
      dirty.current = true;
      if (blocked.current) return;
      setSaveState("unsaved");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => flushRef.current(), AUTOSAVE_MS);
    },
  });

  const flush = useCallback(async () => {
    if (!editor || blocked.current || !dirty.current) return;
    if (inFlight.current) return; // the finally block below will pick up new edits
    clearTimeout(timer.current);
    inFlight.current = true;
    dirty.current = false;
    setSaveState("saving");
    let succeeded = false;
    try {
      const res = await api<{ version: number }>(`/api/documents/${doc.id}`, {
        method: "PATCH",
        body: JSON.stringify({ content: editor.getJSON(), baseVersion: version.current }),
      });
      version.current = res.version;
      succeeded = true;
      setError(null);
      setSaveState(dirty.current ? "unsaved" : "saved");
    } catch (e) {
      dirty.current = true;
      if (e instanceof ApiError && e.code === "version_conflict") {
        blocked.current = true;
        editor.setEditable(false); // further typing couldn't be saved anyway
        setSaveState("conflict");
      } else {
        setSaveState("error");
      }
      setError((e as Error).message);
    } finally {
      inFlight.current = false;
      // Edits made while this save was in flight: save them too. After a failure we
      // wait for the next edit or a manual retry instead of hammering the server.
      if (succeeded && dirty.current) {
        timer.current = setTimeout(() => flushRef.current(), AUTOSAVE_MS);
      }
    }
  }, [editor, doc.id]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  // Ctrl/Cmd+S saves immediately; warn before leaving with unsaved changes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        flushRef.current();
      }
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty.current || inFlight.current) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onBeforeUnload);
      clearTimeout(timer.current);
    };
  }, []);

  async function commitTitle() {
    const next = title.replace(/\s+/g, " ").trim();
    if (!next) {
      setTitle(savedTitle.current);
      setError("Title can't be empty.");
      return;
    }
    if (next === savedTitle.current) return;
    try {
      await api(`/api/documents/${doc.id}`, { method: "PATCH", body: JSON.stringify({ title: next }) });
      savedTitle.current = next;
      setTitle(next);
      document.title = `${next} — Ajaia Docs`;
    } catch (e) {
      setTitle(savedTitle.current);
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    document.title = `${doc.title} — Ajaia Docs`;
  }, [doc.title]);

  return (
    <>
      <div className="editor-chrome">
      <div className="editor-bar">
        <Link href="/" className="btn btn-ghost" aria-label="Back to documents">
          Documents
        </Link>
        <input
          className="title-input"
          value={title}
          readOnly={!canEdit}
          aria-label="Document title"
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              setTitle(savedTitle.current);
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
        {canEdit && (
          <span className="save-state" data-state={saveState} aria-live="polite">
            {SAVE_LABEL[saveState]}
          </span>
        )}
        {isOwner ? (
          <button className="btn btn-primary" onClick={() => setShareOpen(true)}>
            Share
          </button>
        ) : (
          <span className={canEdit ? "badge" : "badge badge-muted"}>
            {canEdit ? "Can edit" : "Can view"}
          </span>
        )}
      </div>

      {canEdit && (
        <div className="toolbar-row">
          {editor && <Toolbar editor={editor} disabled={saveState === "conflict"} />}
        </div>
      )}
      </div>

      <div className="page-wrap">
        {!isOwner && (
          <p className="page-notice alert alert-info">
            {doc.ownerName} shared this document with you.{" "}
            {canEdit ? "You can edit it." : "You have view-only access, so editing is turned off."}
          </p>
        )}
        {error && (
          <div className="page-notice alert" role="alert">
            {error}
            {saveState === "conflict" ? (
              <button className="btn" onClick={() => window.location.reload()}>
                Reload document
              </button>
            ) : saveState === "error" ? (
              <button
                className="btn"
                onClick={() => {
                  setError(null);
                  dirty.current = true;
                  setTimeout(() => flushRef.current(), 0);
                }}
              >
                Retry save
              </button>
            ) : (
              <button className="btn btn-ghost" onClick={() => setError(null)}>
                Dismiss
              </button>
            )}
          </div>
        )}
        <article className="page">
          <EditorContent editor={editor} />
        </article>
      </div>

      {shareOpen && <ShareDialog docId={doc.id} onClose={() => setShareOpen(false)} />}
    </>
  );
}
