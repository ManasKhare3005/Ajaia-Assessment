/**
 * Renders the Markdown notes to PDF for the submission folder.
 *   node scripts/build-pdfs.mjs            (needs Google Chrome or Chromium installed)
 * Output: pdf/ARCHITECTURE.pdf, pdf/AI_WORKFLOW.pdf, pdf/README.pdf
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { marked } from "marked";

const root = path.resolve(import.meta.dirname, "..");
const files = ["ARCHITECTURE.md", "AI_WORKFLOW.md", "README.md"];
const chrome =
  process.env.CHROME_PATH ??
  ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find(existsSync);
if (!chrome) throw new Error("Chrome not found. Set CHROME_PATH.");

const font = (pkg, file) => pathToFileURL(path.join(root, "node_modules", pkg, "files", file)).href;
const css = `
@font-face { font-family: "Instrument Sans"; src: url("${font("@fontsource-variable/instrument-sans", "instrument-sans-latin-wght-normal.woff2")}") format("woff2"); font-weight: 400 700; }
@font-face { font-family: "Source Serif 4"; src: url("${font("@fontsource-variable/source-serif-4", "source-serif-4-latin-wght-normal.woff2")}") format("woff2"); font-weight: 200 900; }
@page { size: Letter; margin: 20mm 20mm 22mm; }
body { font-family: "Source Serif 4", Georgia, serif; font-size: 10.5pt; line-height: 1.55; color: #18202b; }
h1, h2, h3 { font-family: "Instrument Sans", system-ui, sans-serif; line-height: 1.2; letter-spacing: -0.01em; break-after: avoid; }
h1 { font-size: 22pt; margin: 0 0 6pt; padding-bottom: 8pt; border-bottom: 3px solid #f6d94a; }
h2 { font-size: 14pt; margin: 20pt 0 6pt; }
h3 { font-size: 11.5pt; margin: 14pt 0 4pt; }
p, li { orphans: 3; widows: 3; }
ul, ol { padding-left: 18pt; }
li + li { margin-top: 3pt; }
a { color: #2c5bc9; text-decoration: none; }
code { font-family: "SFMono-Regular", Menlo, Consolas, monospace; font-size: 8.8pt; background: #f1f3f6; padding: 1pt 3pt; border-radius: 3px; }
pre { background: #f5f7f9; border: 1px solid #d5dbe2; border-radius: 6px; padding: 8pt 10pt; font-size: 8.5pt; line-height: 1.45; white-space: pre-wrap; break-inside: avoid; }
pre code { background: none; padding: 0; }
table { width: 100%; border-collapse: collapse; margin: 8pt 0; font-size: 9pt; line-height: 1.4; break-inside: auto; }
th, td { border-bottom: 1px solid #d5dbe2; padding: 5pt 6pt; text-align: left; vertical-align: top; }
th { font-family: "Instrument Sans", system-ui, sans-serif; font-weight: 650; background: #f5f7f9; }
tr { break-inside: avoid; }
blockquote { margin: 8pt 0; padding: 6pt 10pt; background: #fffbe8; border-left: 3px solid #e3c94a; }
`;

const outDir = path.join(root, "pdf");
mkdirSync(outDir, { recursive: true });
const work = mkdtempSync(path.join(tmpdir(), "pdfs-"));

for (const file of files) {
  const md = readFileSync(path.join(root, file), "utf8");
  const title = md.match(/^#\s+(.+)$/m)?.[1] ?? file;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${css}</style></head><body>${marked.parse(md)}</body></html>`;
  const htmlPath = path.join(work, file.replace(/\.md$/, ".html"));
  writeFileSync(htmlPath, html);
  const pdfPath = path.join(outDir, file.replace(/\.md$/, ".pdf"));
  execFileSync(chrome, [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--no-pdf-header-footer",
    "--allow-file-access-from-files", `--print-to-pdf=${pdfPath}`, pathToFileURL(htmlPath).href,
  ], { stdio: "pipe" });
  console.log(`✓ ${path.relative(root, pdfPath)}`);
}
