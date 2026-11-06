"use client";

import { type Editor, useEditorState } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import { isSafeHref } from "@/lib/editor-extensions";

// Small stroke icons keep the toolbar on one line; every button keeps an aria-label.
const Icon = ({ d }: { d: string }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);
const ICONS = {
  bullets: "M6 4h8M6 8h8M6 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01",
  numbers: "M7 4h7M7 8h7M7 12h7M2 3l1-.5V6M2 10.5c0-.8 2-.8 2 0 0 .7-2 1.5-2 2.5h2",
  quote: "M3 5h4v4H5l-1 3M9 5h4v4h-2l-1 3",
  left: "M2 3h12M2 6.5h8M2 10h12M2 13.5h8",
  center: "M2 3h12M4 6.5h8M2 10h12M4 13.5h8",
  right: "M2 3h12M6 6.5h8M2 10h12M6 13.5h8",
  link: "M6.5 9.5l3-3M7 4.5l1.2-1.2a2.6 2.6 0 0 1 3.6 3.6L10.6 8M9 11.5l-1.2 1.2a2.6 2.6 0 0 1-3.6-3.6L5.4 8",
  clear: "M4 3h9M8.5 3L6 13M3 9l7 6M10 9l-7 6",
  undo: "M5 3L2 6l3 3M2 6h7.5a4 4 0 0 1 0 8H7",
  redo: "M11 3l3 3-3 3M14 6H6.5a4 4 0 0 0 0 8H9",
};

type Btn = {
  label: React.ReactNode;
  title: string;
  active: (e: Editor) => boolean;
  run: (e: Editor) => void;
  style?: React.CSSProperties;
};

const inList = (e: Editor) => e.isActive("bulletList") || e.isActive("orderedList");

const GROUPS: Btn[][] = [
  [
    { label: "Text", title: "Normal text", active: (e) => e.isActive("paragraph") && !inList(e) && !e.isActive("blockquote"), run: (e) => e.chain().focus().setParagraph().run() },
    { label: "H1", title: "Heading 1", active: (e) => e.isActive("heading", { level: 1 }), run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
    { label: "H2", title: "Heading 2", active: (e) => e.isActive("heading", { level: 2 }), run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: "H3", title: "Heading 3", active: (e) => e.isActive("heading", { level: 3 }), run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  ],
  [
    { label: "B", title: "Bold (Ctrl+B)", style: { fontWeight: 700 }, active: (e) => e.isActive("bold"), run: (e) => e.chain().focus().toggleBold().run() },
    { label: "I", title: "Italic (Ctrl+I)", style: { fontStyle: "italic", fontFamily: "var(--serif)" }, active: (e) => e.isActive("italic"), run: (e) => e.chain().focus().toggleItalic().run() },
    { label: "U", title: "Underline (Ctrl+U)", style: { textDecoration: "underline" }, active: (e) => e.isActive("underline"), run: (e) => e.chain().focus().toggleUnderline().run() },
  ],
  [
    { label: <Icon d={ICONS.bullets} />, title: "Bulleted list", active: (e) => e.isActive("bulletList"), run: (e) => e.chain().focus().toggleBulletList().run() },
    { label: <Icon d={ICONS.numbers} />, title: "Numbered list", active: (e) => e.isActive("orderedList"), run: (e) => e.chain().focus().toggleOrderedList().run() },
    { label: <Icon d={ICONS.quote} />, title: "Quote", active: (e) => e.isActive("blockquote"), run: (e) => e.chain().focus().toggleBlockquote().run() },
  ],
  [
    { label: <Icon d={ICONS.left} />, title: "Align left", active: (e) => e.isActive({ textAlign: "left" }), run: (e) => e.chain().focus().setTextAlign("left").run() },
    { label: <Icon d={ICONS.center} />, title: "Align center", active: (e) => e.isActive({ textAlign: "center" }), run: (e) => e.chain().focus().setTextAlign("center").run() },
    { label: <Icon d={ICONS.right} />, title: "Align right", active: (e) => e.isActive({ textAlign: "right" }), run: (e) => e.chain().focus().setTextAlign("right").run() },
  ],
];

const ALL = GROUPS.flat();

function normalizeHref(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return v; // already has a scheme
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return `mailto:${v}`;
  return `https://${v}`;
}

export function Toolbar({ editor, disabled }: { editor: Editor; disabled: boolean }) {
  // Re-render only when the formatting state at the cursor changes.
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      active: ALL.map((b) => b.active(e)),
      link: e.isActive("link"),
      href: (e.getAttributes("link").href as string | undefined) ?? "",
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const [linkOpen, setLinkOpen] = useState(false);
  const [href, setHref] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const linkInput = useRef<HTMLInputElement>(null);

  function openLink() {
    setHref(state.href);
    setLinkError(null);
    setLinkOpen(true);
    setTimeout(() => linkInput.current?.focus(), 0);
  }

  // Ctrl/Cmd+K opens the link field, like most editors.
  const openLinkRef = useRef(openLink);
  openLinkRef.current = openLink;
  useEffect(() => {
    if (disabled) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && editor.isFocused) {
        e.preventDefault();
        openLinkRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editor, disabled]);

  function applyLink() {
    const url = normalizeHref(href);
    if (!isSafeHref(url)) {
      setLinkError("Use a web address (https://…) or an email address.");
      return;
    }
    const chain = editor.chain().extendMarkRange("link");
    if (editor.state.selection.empty && !state.link) {
      // Nothing selected: insert the address itself as linked text, then stop the
      // link there so whatever the user types next isn't part of it.
      chain
        .insertContent({ type: "text", text: href.trim(), marks: [{ type: "link", attrs: { href: url } }] })
        .unsetMark("link")
        .run();
    } else {
      chain.setLink({ href: url }).run();
    }
    closeLink();
  }

  function removeLink() {
    editor.chain().extendMarkRange("link").unsetLink().run();
    closeLink();
  }

  function closeLink() {
    setLinkOpen(false);
    // Focus synchronously (TipTap's focus() waits a frame) so the next keystroke
    // goes into the document, not the popover's button.
    editor.view.focus();
  }

  let i = 0;
  return (
    <div className="toolbar-wrap">
      <div className="toolbar" role="toolbar" aria-label="Formatting">
        {GROUPS.map((group, gi) => (
          <span key={gi} className="tool-group">
            {gi > 0 && <span className="tool-sep" aria-hidden />}
            {group.map((b) => {
              const active = state.active[i++];
              return (
                <button
                  key={b.title}
                  type="button"
                  className="tool"
                  title={b.title}
                  aria-label={b.title}
                  aria-pressed={active}
                  style={b.style}
                  disabled={disabled}
                  onMouseDown={(ev) => ev.preventDefault()}
                  onClick={() => b.run(editor)}
                >
                  {b.label}
                </button>
              );
            })}
          </span>
        ))}
        <span className="tool-group">
          <span className="tool-sep" aria-hidden />
          <button type="button" className="tool" title="Add or edit link (Ctrl+K)" aria-label="Link" aria-pressed={state.link} aria-expanded={linkOpen} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={openLink}>
            <Icon d={ICONS.link} />
          </button>
          <button type="button" className="tool" title="Clear formatting" aria-label="Clear formatting" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>
            <Icon d={ICONS.clear} />
          </button>
        </span>
        <span className="tool-group">
          <span className="tool-sep" aria-hidden />
          <button type="button" className="tool" title="Undo (Ctrl+Z)" aria-label="Undo" disabled={disabled || !state.canUndo} onClick={() => editor.chain().focus().undo().run()}>
            <Icon d={ICONS.undo} />
          </button>
          <button type="button" className="tool" title="Redo (Ctrl+Shift+Z)" aria-label="Redo" disabled={disabled || !state.canRedo} onClick={() => editor.chain().focus().redo().run()}>
            <Icon d={ICONS.redo} />
          </button>
        </span>
      </div>

      {linkOpen && (
        <form
          className="link-popover"
          onSubmit={(e) => {
            e.preventDefault();
            applyLink();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") closeLink();
          }}
        >
          <input
            ref={linkInput}
            className="input"
            aria-label="Link address"
            placeholder="Paste a link or email address"
            value={href}
            onChange={(e) => setHref(e.target.value)}
          />
          <button className="btn btn-primary" type="submit" disabled={!href.trim()}>
            Apply
          </button>
          {state.link && (
            <button className="btn" type="button" onClick={removeLink}>
              Remove link
            </button>
          )}
          <button className="btn btn-ghost" type="button" onClick={closeLink}>
            Cancel
          </button>
          {linkError && <p className="form-error" role="alert">{linkError}</p>}
        </form>
      )}
    </div>
  );
}
