/**
 * Serializes an editor document (TipTap JSON) to Markdown for export.
 * Covers everything our schema can hold. Markdown has no underline or alignment,
 * so underline is written as <u>…</u> (supported by most renderers) and alignment is dropped.
 */
import type { JSONContent } from "@tiptap/core";

type Mark = { type: string; attrs?: Record<string, unknown> };

const MARK_ORDER = ["link", "bold", "italic", "strike", "underline", "code"];

function escapeText(text: string) {
  // Escape characters that would otherwise start Markdown syntax.
  return text.replace(/([\\`*_[\]<>#|~])/g, "\\$1").replace(/^(\d+)\. /, "$1\\. ").replace(/^([-+]) /, "\\$1 ");
}

function wrap(mark: Mark, inner: string): string {
  switch (mark.type) {
    case "bold":
      return `**${inner}**`;
    case "italic":
      return `*${inner}*`;
    case "strike":
      return `~~${inner}~~`;
    case "underline":
      return `<u>${inner}</u>`;
    case "code":
      return `\`${inner}\``;
    case "link":
      return `[${inner}](${String(mark.attrs?.href ?? "").replace(/[()\s]/g, encodeURIComponent)})`;
    default:
      return inner;
  }
}

function inline(nodes: JSONContent[] = []): string {
  return nodes
    .map((n) => {
      if (n.type === "hardBreak") return "  \n";
      if (n.type !== "text" || !n.text) return "";
      const marks = [...((n.marks as Mark[]) ?? [])].sort(
        (a, b) => MARK_ORDER.indexOf(b.type) - MARK_ORDER.indexOf(a.type),
      );
      const isCode = marks.some((m) => m.type === "code");
      // Keep leading/trailing spaces outside the markers: "** bold**" isn't valid Markdown.
      const [, lead, core, trail] = n.text.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
      if (!core) return n.text;
      const body = marks.reduce((acc, m) => wrap(m, acc), isCode ? core : escapeText(core));
      return lead + body + trail;
    })
    .join("");
}

function indent(text: string, by: string) {
  return text
    .split("\n")
    .map((line, i) => (i === 0 || line === "" ? line : by + line))
    .join("\n");
}

function block(node: JSONContent): string {
  switch (node.type) {
    case "paragraph":
      return inline(node.content);
    case "heading":
      return `${"#".repeat(Number(node.attrs?.level ?? 1))} ${inline(node.content)}`;
    case "blockquote":
      return blocks(node.content)
        .split("\n")
        .map((l) => (l ? `> ${l}` : ">"))
        .join("\n");
    case "horizontalRule":
      return "---";
    case "bulletList":
      return (node.content ?? []).map((li) => `- ${indent(blocks(li.content), "  ")}`).join("\n");
    case "orderedList": {
      const start = Number(node.attrs?.start ?? 1);
      return (node.content ?? [])
        .map((li, i) => {
          const marker = `${start + i}. `;
          return marker + indent(blocks(li.content), " ".repeat(marker.length));
        })
        .join("\n");
    }
    default:
      return inline(node.content);
  }
}

function blocks(nodes: JSONContent[] = []): string {
  return nodes.map(block).join("\n\n");
}

export function toMarkdown(doc: JSONContent, title?: string): string {
  const body = blocks(doc.content).replace(/\n{3,}/g, "\n\n").trim();
  const firstIsHeading = doc.content?.[0]?.type === "heading";
  const heading = title && !firstIsHeading ? `# ${escapeText(title)}\n\n` : "";
  return `${heading}${body}\n`;
}
