import StarterKit from "@tiptap/starter-kit";
import type { Extensions } from "@tiptap/core";

/**
 * The single editor schema, shared by the browser editor and the server
 * (file import + content validation), so both agree on what a document can hold.
 */
export const editorExtensions: Extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: { openOnClick: false, autolink: true },
  }),
];
