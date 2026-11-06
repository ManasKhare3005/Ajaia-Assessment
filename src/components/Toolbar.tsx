"use client";

import { type Editor, useEditorState } from "@tiptap/react";

type Btn = {
  label: string;
  title: string;
  active: (e: Editor) => boolean;
  run: (e: Editor) => void;
  style?: React.CSSProperties;
};

const GROUPS: Btn[][] = [
  [
    { label: "Text", title: "Normal text", active: (e) => e.isActive("paragraph") && !e.isActive("bulletList") && !e.isActive("orderedList"), run: (e) => e.chain().focus().setParagraph().run() },
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
    { label: "• List", title: "Bulleted list", active: (e) => e.isActive("bulletList"), run: (e) => e.chain().focus().toggleBulletList().run() },
    { label: "1. List", title: "Numbered list", active: (e) => e.isActive("orderedList"), run: (e) => e.chain().focus().toggleOrderedList().run() },
  ],
];

export function Toolbar({ editor, disabled }: { editor: Editor; disabled: boolean }) {
  // Re-render only when the formatting state at the cursor changes.
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      active: GROUPS.flat().map((b) => b.active(e)),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  let i = 0;
  return (
    <div className="toolbar" role="toolbar" aria-label="Formatting">
      {GROUPS.map((group, gi) => (
        <span key={gi} style={{ display: "contents" }}>
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
      <span className="tool-sep" aria-hidden />
      <button type="button" className="tool" title="Undo (Ctrl+Z)" aria-label="Undo" disabled={disabled || !state.canUndo} onClick={() => editor.chain().focus().undo().run()}>
        Undo
      </button>
      <button type="button" className="tool" title="Redo (Ctrl+Shift+Z)" aria-label="Redo" disabled={disabled || !state.canRedo} onClick={() => editor.chain().focus().redo().run()}>
        Redo
      </button>
    </div>
  );
}
