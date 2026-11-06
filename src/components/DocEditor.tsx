"use client";

import type { JSONContent } from "@tiptap/core";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
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
  conflict: "Newer version available",
};

const AUTOSAVE_MS = 800;

/** Unsaved edits set aside after a conflict, so loading the latest version loses nothing. */
type Recovery = { savedBy: string; mine: JSONContent };

export function DocEditor({ doc }: { doc: Doc }) {
  const canEdit = doc.access !== "viewer";
  const isOwner = doc.access === "owner";

  const [title, setTitle] = useState(doc.title);
  const savedTitle = useRef(doc.title);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [conflict, setConflict] = useState<Recovery | null>(null); // detected, not yet resolved
  const [recovery, setRecovery] = useState<Recovery | null>(null); // latest loaded, mine kept aside
  const [showMine, setShowMine] = useState(true);
  const [loadingLatest, setLoadingLatest] = useState(false);

  // Autosave bookkeeping lives in refs so it isn't reset by re-renders.
  const version = useRef(doc.version);
  const inFlight = useRef(false);
  const dirty = useRef(false);
  const blocked = useRef(false); // true while a conflict is unresolved
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
        setConflict({ savedBy: String(e.data.savedBy ?? "Someone else"), mine: editor.getJSON() });
        setSaveState("conflict");
      } else {
        setSaveState("error");
        setError(e instanceof Error ? e.message : "Couldn't save.");
      }
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

  /** Loads the latest saved version in place, keeping this user's edits aside. */
  async function loadLatest() {
    if (!editor || !conflict) return;
    setLoadingLatest(true);
    try {
      const latest = await api<{ content: JSONContent; version: number; title: string }>(`/api/documents/${doc.id}`);
      editor.commands.setContent(latest.content, { emitUpdate: false });
      version.current = latest.version;
      savedTitle.current = latest.title;
      setTitle(latest.title);
      dirty.current = false;
      blocked.current = false;
      editor.setEditable(true);
      setRecovery(conflict);
      setShowMine(true);
      setConflict(null);
      setSaveState("saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the latest version.");
    } finally {
      setLoadingLatest(false);
    }
  }

  /** Explicit choice: replace the latest version with the edits that were set aside. */
  function keepMine() {
    if (!editor || !recovery) return;
    if (!confirm(`Replace ${recovery.savedBy === "Someone else" ? "the latest" : `${recovery.savedBy}'s`} version with yours?`)) return;
    editor.commands.setContent(recovery.mine, { emitUpdate: false });
    dirty.current = true;
    setRecovery(null);
    flushRef.current();
  }

  // Ctrl/Cmd+S saves immediately; warn before leaving with anything unsaved.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        flushRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty.current || inFlight.current || recovery) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [recovery]);

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
          <ExportMenu docId={doc.id} />
          {isOwner ? (
            <button className="btn btn-primary" onClick={() => setShareOpen(true)}>
              Share
            </button>
          ) : (
            <span className={canEdit ? "badge" : "badge badge-muted"}>{canEdit ? "Can edit" : "Can view"}</span>
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

        {conflict && (
          <div className="page-notice alert" role="alert">
            <span>
              <strong>{conflict.savedBy} saved a newer version while you were editing.</strong> Your changes
              are kept on this page. Load the latest version to continue; your edits will stay alongside it.
            </span>
            <button className="btn" onClick={loadLatest} disabled={loadingLatest}>
              {loadingLatest ? "Loading…" : "Load latest version"}
            </button>
          </div>
        )}

        {recovery && (
          <div className="page-notice recovery" role="region" aria-label="Your unsaved changes">
            <div className="recovery-head">
              <span>
                You&rsquo;re now editing the latest version. Your earlier changes are set aside below; copy what you
                need into the document, or replace the latest version with yours.
              </span>
              <span className="recovery-actions">
                <button className="btn btn-ghost" onClick={() => setShowMine((v) => !v)} aria-expanded={showMine}>
                  {showMine ? "Hide my changes" : "Show my changes"}
                </button>
                <button className="btn" onClick={keepMine}>
                  Use my version
                </button>
                <button className="btn btn-ghost" onClick={() => setRecovery(null)}>
                  Discard mine
                </button>
              </span>
            </div>
            {showMine && <ReadOnlyDoc content={recovery.mine} label="Your unsaved version" />}
          </div>
        )}

        {error && (
          <div className="page-notice alert" role="alert">
            {error}
            {saveState === "error" ? (
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
        {editor && <WordCount editor={editor} />}
      </div>

      {shareOpen && <ShareDialog docId={doc.id} onClose={() => setShareOpen(false)} />}
    </>
  );
}

function WordCount({ editor }: { editor: Editor }) {
  const { words, chars } = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const text = e.state.doc.textBetween(0, e.state.doc.content.size, " ", " ");
      return { words: text.trim() ? text.trim().split(/\s+/).length : 0, chars: text.replace(/\s/g, "").length };
    },
  });
  return (
    <p className="word-count" aria-live="off">
      {words.toLocaleString()} {words === 1 ? "word" : "words"}, {chars.toLocaleString()} characters
    </p>
  );
}

function ReadOnlyDoc({ content, label }: { content: JSONContent; label: string }) {
  const editor = useEditor({
    extensions: editorExtensions,
    content,
    editable: false,
    immediatelyRender: false,
    editorProps: { attributes: { class: "prose", "aria-label": label } },
  });
  return (
    <div className="recovery-doc">
      <EditorContent editor={editor} />
    </div>
  );
}

function ExportMenu({ docId }: { docId: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const close = () => ref.current?.removeAttribute("open");
  useEffect(() => {
    // Close when clicking anywhere outside the menu.
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);
  return (
    <details className="menu" ref={ref}>
      <summary className="btn" aria-label="Download or print">
        Download
      </summary>
      <div className="menu-list" role="menu">
        <a role="menuitem" className="menu-item" href={`/api/documents/${docId}/export?format=md`} onClick={close}>
          Markdown (.md)
        </a>
        <button
          role="menuitem"
          className="menu-item"
          onClick={() => {
            close();
            window.print();
          }}
        >
          PDF (print to PDF)
        </button>
      </div>
    </details>
  );
}
