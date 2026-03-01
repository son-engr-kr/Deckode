import { describe, it, expect } from "vitest";
import { parseMarkdownLines } from "@/utils/markdownParser";

// The PPTX export itself requires DOM (PptxGenJS, Shiki, etc.), so we only
// test the logic that feeds into it — the markdown → TextProps conversion
// pipeline used by addText.

describe("PPTX text pipeline: parseMarkdownLines", () => {
  it("produces heading lines with correct fontScale for all levels", () => {
    const lines = parseMarkdownLines("# H1\n## H2\n### H3\nnormal");
    expect(lines).toHaveLength(4);
    expect(lines[0]!.fontScale).toBe(1.8);
    expect(lines[0]!.isBold).toBe(true);
    expect(lines[1]!.fontScale).toBe(1.4);
    expect(lines[2]!.fontScale).toBe(1.1);
    expect(lines[3]!.fontScale).toBe(1);
  });

  it("produces bullet lines with correct sentinel indent", () => {
    const lines = parseMarkdownLines("- a\n- b\n* c");
    expect(lines).toHaveLength(3);
    for (const line of lines) {
      expect(line.bullet).toBe(true);
      expect(line.indent).toBe(-1);
    }
  });

  it("detects block math", () => {
    const lines = parseMarkdownLines("text\n$$\nx^2\n$$\nmore");
    const mathLine = lines.find((l) => l.blockMath !== null);
    expect(mathLine).toBeTruthy();
    expect(mathLine!.blockMath).toBe("x^2");
  });

  it("detects inline formatting in runs", () => {
    const lines = parseMarkdownLines("**bold** and `code`");
    expect(lines).toHaveLength(1);
    const runs = lines[0]!.runs;
    expect(runs.some((r) => r.bold)).toBe(true);
    expect(runs.some((r) => r.code)).toBe(true);
  });

  it("handles empty input", () => {
    const lines = parseMarkdownLines("");
    expect(lines).toHaveLength(0);
  });

  it("handles only whitespace", () => {
    const lines = parseMarkdownLines("   \n  \n  ");
    expect(lines).toHaveLength(0);
  });
});

describe("PPTX export integration smoke check", () => {
  it("parseMarkdownLines produces valid ParsedLine array for comprehensive content", () => {
    const content = [
      "# Title",
      "",
      "Paragraph with **bold** and *italic*.",
      "",
      "- Item 1",
      "- Item 2 with `code`",
      "",
      "$$E = mc^2$$",
      "",
      "### Sub-heading",
      "",
      "Normal text $x^2$ inline math.",
    ].join("\n");

    const lines = parseMarkdownLines(content);

    // Should have: heading, paragraph, 2 bullets, block math, subheading, normal
    expect(lines.length).toBeGreaterThanOrEqual(7);

    // First line is heading
    expect(lines[0]!.fontScale).toBe(1.8);

    // Block math exists
    expect(lines.some((l) => l.blockMath !== null)).toBe(true);

    // Bullets exist
    expect(lines.filter((l) => l.bullet).length).toBe(2);

    // Inline math exists
    expect(lines.some((l) => l.runs.some((r) => r.math))).toBe(true);
  });
});
