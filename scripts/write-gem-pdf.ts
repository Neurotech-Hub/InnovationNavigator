import PDFDocument from "pdfkit";
import { createWriteStream } from "node:fs";

function forPdfText(value: string): string {
  return value
    .replaceAll("\u2014", "-")
    .replaceAll("\u2013", "-")
    .replaceAll("\u2018", "'")
    .replaceAll("\u2019", "'")
    .replaceAll("\u201c", '"')
    .replaceAll("\u201d", '"')
    .replaceAll("\u2026", "...")
    .replaceAll("\u00a0", " ");
}

/**
 * Write a text-extractable PDF from the Gem markdown catalog.
 * Keeps plain Helvetica and labeled lines so Gemini can parse fields.
 */
export function writeGemPdfFromMarkdown(
  markdown: string,
  outPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 54,
      size: "LETTER",
      compress: false,
      info: {
        Title: "NextMove resource catalog (for Gemini Gem)",
        Author: "NextMove",
        Subject:
          "WashU innovation resource catalog structured for Gemini Gem knowledge",
      },
    });

    const stream = createWriteStream(outPath);
    doc.pipe(stream);
    stream.on("finish", () => resolve());
    stream.on("error", reject);
    doc.on("error", reject);

    const maxWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const lines = forPdfText(markdown).split("\n");

    for (const line of lines) {
      if (line.startsWith("# ")) {
        doc.moveDown(0.4);
        doc.font("Helvetica-Bold").fontSize(16).text(line.replace(/^#\s+/, ""), {
          width: maxWidth,
        });
        doc.moveDown(0.3);
        continue;
      }
      if (line.startsWith("## ")) {
        doc.moveDown(0.5);
        doc.font("Helvetica-Bold").fontSize(12).text(line.replace(/^##\s+/, ""), {
          width: maxWidth,
        });
        doc.moveDown(0.2);
        continue;
      }
      if (line.startsWith("### ")) {
        doc.moveDown(0.35);
        doc.font("Helvetica-Bold").fontSize(11).text(line.replace(/^###\s+/, ""), {
          width: maxWidth,
        });
        doc.moveDown(0.15);
        continue;
      }
      if (line.trim() === "---") {
        doc.moveDown(0.25);
        doc
          .strokeColor("#999999")
          .moveTo(doc.page.margins.left, doc.y)
          .lineTo(doc.page.margins.left + maxWidth, doc.y)
          .stroke();
        doc.moveDown(0.35);
        continue;
      }
      if (line.trim() === "") {
        doc.moveDown(0.2);
        continue;
      }

      const isLabel =
        /^[A-Z][A-Z0-9 /()_-]+:/.test(line) ||
        line.endsWith(":") ||
        line.startsWith("- ");
      doc
        .font(isLabel && !line.startsWith("- ") ? "Helvetica-Bold" : "Helvetica")
        .fontSize(9.5)
        .fillColor("#111111")
        .text(line, { width: maxWidth, align: "left" });
    }

    doc.end();
  });
}
