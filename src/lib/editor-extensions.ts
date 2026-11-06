import type { Extensions } from "@tiptap/core";
import TextAlign from "@tiptap/extension-text-align";
import StarterKit from "@tiptap/starter-kit";

/** Only these link targets are allowed anywhere (editor, import, API). */
export function isSafeHref(href: unknown): href is string {
  if (typeof href !== "string" || href.length > 2048) return false;
  try {
    const url = new URL(href);
    return ["http:", "https:", "mailto:"].includes(url.protocol);
  } catch {
    return false;
  }
}

/**
 * The single editor schema, shared by the browser editor and the server
 * (file import, content validation, export), so they agree on what a document can hold.
 */
export const editorExtensions: Extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    codeBlock: false,
    link: {
      openOnClick: false,
      autolink: true,
      defaultProtocol: "https",
      isAllowedUri: (url) => isSafeHref(url),
      HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
    },
  }),
  TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["left", "center", "right"] }),
];
