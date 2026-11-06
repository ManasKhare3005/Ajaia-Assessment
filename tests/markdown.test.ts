import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { validateContent } from "@/lib/content";
import { fileToDocument } from "@/lib/import";
import { toMarkdown } from "@/lib/markdown";

const text = (t: string, ...marks: string[]): JSONContent => ({
  type: "text",
  text: t,
  ...(marks.length ? { marks: marks.map((type) => ({ type })) } : {}),
});
const p = (...content: JSONContent[]): JSONContent => ({ type: "paragraph", content });

describe("toMarkdown", () => {
  it("writes headings, marks, lists, quotes and links", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [text("Goals")] },
        p(text("Ship "), text("fast", "bold"), text(" and "), text("well", "italic"), text(" with "), text("care", "underline")),
        { type: "bulletList", content: [{ type: "listItem", content: [p(text("one"))] }, { type: "listItem", content: [p(text("two"))] }] },
        { type: "orderedList", attrs: { start: 1 }, content: [{ type: "listItem", content: [p(text("first"))] }] },
        { type: "blockquote", content: [p(text("quoted"))] },
        p({ type: "text", text: "docs", marks: [{ type: "link", attrs: { href: "https://example.com/a b" } }] }),
      ],
    };
    expect(toMarkdown(doc)).toBe(
      [
        "## Goals",
        "",
        "Ship **fast** and *well* with <u>care</u>",
        "",
        "- one",
        "- two",
        "",
        "1. first",
        "",
        "> quoted",
        "",
        "[docs](https://example.com/a%20b)",
        "",
      ].join("\n"),
    );
  });

  it("adds the title as a heading only when the doc doesn't start with one", () => {
    expect(toMarkdown({ type: "doc", content: [p(text("body"))] }, "My doc")).toBe("# My doc\n\nbody\n");
    expect(toMarkdown({ type: "doc", content: [{ type: "heading", attrs: { level: 1 }, content: [text("H")] }] }, "My doc")).toBe("# H\n");
  });

  it("escapes text that would otherwise become Markdown syntax", () => {
    expect(toMarkdown({ type: "doc", content: [p(text("2. not a list *or* # heading"))] })).toBe(
      "2\\. not a list \\*or\\* \\# heading\n",
    );
  });

  it("keeps spaces outside of formatting markers", () => {
    expect(toMarkdown({ type: "doc", content: [p(text("a"), text(" bold ", "bold"), text("b"))] })).toBe("a **bold** b\n");
  });

  it("nests list content under the right item", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [p(text("parent")), { type: "bulletList", content: [{ type: "listItem", content: [p(text("child"))] }] }],
            },
          ],
        },
      ],
    };
    expect(toMarkdown(doc)).toBe("- parent\n\n  - child\n");
  });

  it("survives a round trip: import → export → import gives the same document", async () => {
    const md =
      "# Plan\n\nShip **fast**, *well* and ~~late~~.\n\n- one\n- two with [a link](https://example.com)\n\n1. first\n2. second\n\n> A quote\n";
    const first = await fileToDocument("plan.md", Buffer.from(md));
    const exported = toMarkdown(first.content);
    const second = await fileToDocument("plan.md", Buffer.from(exported));
    expect(second.content).toEqual(first.content);
    expect(validateContent(second.content).ok).toBe(true);
  });
});

describe("link safety", () => {
  const withLink = (href: string) => ({
    type: "doc",
    content: [p({ type: "text", text: "x", marks: [{ type: "link", attrs: { href } }] })],
  });

  it.each(["javascript:alert(1)", "data:text/html,hi", "vbscript:x", "not a url"])("rejects saving a %s link", (href) => {
    expect(validateContent(withLink(href)).ok).toBe(false);
  });

  it.each(["https://example.com", "http://example.com/x?y=1", "mailto:a@b.co"])("accepts %s", (href) => {
    expect(validateContent(withLink(href)).ok).toBe(true);
  });

  it("drops javascript: links from imported files", async () => {
    const { content } = await fileToDocument("x.md", Buffer.from("[click](javascript:alert(1)) and [ok](https://ok.dev)"));
    const json = JSON.stringify(content);
    expect(json).not.toContain("javascript");
    expect(json).toContain("https://ok.dev");
  });
});
