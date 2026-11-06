import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { describe, expect, it } from "vitest";
import { plainText, validateContent } from "@/lib/content";
import { HttpError } from "@/lib/http";
import { fileToDocument } from "@/lib/import";

const json = (v: unknown) => JSON.stringify(v);

describe("fileToDocument", () => {
  it("converts markdown headings, marks and lists into editor nodes", async () => {
    const md = "# Plan\n\nShip **fast** and *carefully*.\n\n- one\n- two\n\n1. first\n";
    const { title, content } = await fileToDocument("Sprint plan.md", Buffer.from(md));

    expect(title).toBe("Sprint plan");
    const types = content.content!.map((n) => n.type);
    expect(types).toEqual(["heading", "paragraph", "bulletList", "orderedList"]);
    expect(content.content![0].attrs).toMatchObject({ level: 1 });
    expect(json(content)).toContain('"type":"bold"');
    expect(json(content)).toContain('"type":"italic"');
    // Whatever we import must be a valid document the editor can open and save.
    expect(validateContent(content).ok).toBe(true);
  });

  it("drops unsupported and unsafe markup from imports", async () => {
    const md = "Hello\n\n<script>alert('x')</script>\n\n<img src=x onerror=alert(1)>\n";
    const { content } = await fileToDocument("note.md", Buffer.from(md));
    expect(json(content)).not.toMatch(/script|onerror|img|alert/);
    expect(plainText(content)).toBe("Hello");
  });

  it("splits plain text into paragraphs and keeps line breaks", async () => {
    const { content } = await fileToDocument("notes.txt", Buffer.from("Line 1\nLine 2\r\n\r\nPara 2 <b>not bold</b>"));
    expect(content.content).toHaveLength(2);
    expect(json(content.content![0])).toContain("hardBreak");
    // Text files are text: angle brackets stay literal, not markup.
    expect(plainText(content)).toContain("<b>not bold</b>");
  });

  it("imports .docx files with headings and bold text", async () => {
    const file = new Document({
      sections: [
        {
          children: [
            new Paragraph({ text: "Quarterly review", heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ children: [new TextRun("Revenue is "), new TextRun({ text: "up", bold: true })] }),
          ],
        },
      ],
    });
    const buffer = await Packer.toBuffer(file);
    const { title, content } = await fileToDocument("review.docx", buffer);

    expect(title).toBe("review");
    expect(content.content![0]).toMatchObject({ type: "heading", attrs: { level: 1 } });
    expect(json(content)).toContain('"type":"bold"');
  });

  it.each([
    ["report.pdf", Buffer.from("x"), 415],
    ["empty.txt", Buffer.alloc(0), 422],
    ["blank.md", Buffer.from("   \n\n  "), 422],
    ["broken.docx", Buffer.from("not a zip"), 422],
    ["huge.txt", Buffer.alloc(5 * 1024 * 1024 + 1, "a"), 413],
  ])("rejects %s with HTTP %i", async (name, data, status) => {
    const err = await fileToDocument(name, data).catch((e) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(status);
  });
});

describe("validateContent", () => {
  it("accepts a valid document", () => {
    expect(validateContent({ type: "doc", content: [{ type: "paragraph" }] }).ok).toBe(true);
  });
  it.each([
    ["null", null],
    ["a string", "<p>hi</p>"],
    ["an unknown node", { type: "doc", content: [{ type: "script" }] }],
    ["an empty doc", { type: "doc", content: [] }],
    ["an unknown mark", { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "blink" }] }] }] }],
  ])("rejects %s", (_label, value) => {
    expect(validateContent(value).ok).toBe(false);
  });
});
