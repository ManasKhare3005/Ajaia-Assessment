/**
 * Turns an uploaded file into a new editable document.
 * Supported: .txt, .md / .markdown, .docx (max 5 MB).
 * Everything is converted to HTML first, then parsed through the editor schema,
 * which drops anything the editor doesn't support (scripts, styles, images, tables).
 */
import type { JSONContent } from "@tiptap/core";
import { generateJSON } from "@tiptap/html/server";
import mammoth from "mammoth";
import { marked } from "marked";
import { normalizeTitle, plainText } from "./content";
import { editorExtensions } from "./editor-extensions";
import { HttpError } from "./http";
import { MAX_UPLOAD_BYTES, SUPPORTED_LABEL } from "./import-constants";

type Kind = "text" | "markdown" | "docx";

function kindOf(filename: string): Kind | null {
  const ext = filename.toLowerCase().match(/\.[a-z0-9]+$/)?.[0];
  if (ext === ".txt") return "text";
  if (ext === ".md" || ext === ".markdown") return "markdown";
  if (ext === ".docx") return "docx";
  return null;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function textToHtml(text: string) {
  // Blank lines separate paragraphs; single newlines become line breaks.
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

async function toHtml(kind: Kind, data: Buffer): Promise<string> {
  switch (kind) {
    case "text":
      return textToHtml(data.toString("utf8"));
    case "markdown":
      return marked.parse(data.toString("utf8"), { async: false, gfm: true });
    case "docx": {
      try {
        const { value } = await mammoth.convertToHtml({ buffer: data });
        return value;
      } catch {
        throw new HttpError(422, "That .docx file couldn't be read. Is it a valid Word document?");
      }
    }
  }
}

export async function fileToDocument(
  filename: string,
  data: Buffer,
): Promise<{ title: string; content: JSONContent }> {
  const kind = kindOf(filename);
  if (!kind) {
    throw new HttpError(415, `Unsupported file type. Supported: ${SUPPORTED_LABEL}.`);
  }
  if (data.byteLength === 0) throw new HttpError(422, "The file is empty.");
  if (data.byteLength > MAX_UPLOAD_BYTES) throw new HttpError(413, "File is larger than 5 MB.");

  const html = await toHtml(kind, data);
  const content = generateJSON(html, editorExtensions) as JSONContent;
  if (!plainText(content, 1)) throw new HttpError(422, "No readable text found in that file.");

  const base = filename.replace(/\.[^.]+$/, "");
  return { title: normalizeTitle(base) || "Imported document", content };
}
