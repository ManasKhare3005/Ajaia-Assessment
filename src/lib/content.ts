import { getSchema, type JSONContent } from "@tiptap/core";
import { Node } from "@tiptap/pm/model";
import { editorExtensions } from "./editor-extensions";

const schema = getSchema(editorExtensions);

export const MAX_CONTENT_BYTES = 1_000_000; // ~1 MB of JSON per document
export const MAX_TITLE_LENGTH = 200;

export const EMPTY_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

/**
 * Rejects anything that isn't a valid document for our editor schema, so a bad
 * client (or a hand-crafted request) can't store content the editor can't open.
 */
export function validateContent(
  value: unknown,
): { ok: true; content: JSONContent } | { ok: false; reason: string } {
  if (!value || typeof value !== "object" || (value as { type?: unknown }).type !== "doc") {
    return { ok: false, reason: "Content must be an editor document." };
  }
  if (JSON.stringify(value).length > MAX_CONTENT_BYTES) {
    return { ok: false, reason: "Document is too large (limit is about 1 MB)." };
  }
  try {
    const node = Node.fromJSON(schema, value);
    node.check();
    return { ok: true, content: node.toJSON() as JSONContent };
  } catch {
    return { ok: false, reason: "Content does not match the document format." };
  }
}

export function normalizeTitle(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_TITLE_LENGTH);
}

/** Plain text of a document, for list previews and empty-import checks. */
export function plainText(doc: JSONContent, limit = Infinity): string {
  const parts: string[] = [];
  let length = 0;
  const walk = (n: JSONContent) => {
    if (length >= limit) return;
    if (n.text) {
      parts.push(n.text);
      length += n.text.length;
    }
    n.content?.forEach(walk);
    if (n.type === "paragraph" || n.type === "heading") parts.push(" ");
  };
  walk(doc);
  return parts.join("").replace(/\s+/g, " ").trim().slice(0, limit);
}
