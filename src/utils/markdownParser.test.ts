import { describe, it, expect } from "vitest";
import { parseInlineMarkdown, parseMarkdownLines } from "./markdownParser";

describe("parseInlineMarkdown", () => {
  it("returns plain text run for simple text", () => {
    const runs = parseInlineMarkdown("hello world");
    expect(runs).toEqual([
      { text: "hello world", bold: false, italic: false, code: false, math: false },
    ]);
  });

  it("parses bold text", () => {
    const runs = parseInlineMarkdown("before **bold** after");
    expect(runs).toHaveLength(3);
    expect(runs[1]).toEqual({ text: "bold", bold: true, italic: false, code: false, math: false });
  });

  it("parses italic text", () => {
    const runs = parseInlineMarkdown("before *italic* after");
    expect(runs).toHaveLength(3);
    expect(runs[1]).toEqual({ text: "italic", bold: false, italic: true, code: false, math: false });
  });

  it("parses inline code", () => {
    const runs = parseInlineMarkdown("use `console.log()` here");
    expect(runs).toHaveLength(3);
    expect(runs[1]).toEqual({ text: "console.log()", bold: false, italic: false, code: true, math: false });
  });

  it("parses inline math", () => {
    const runs = parseInlineMarkdown("energy $E = mc^2$ formula");
    expect(runs).toHaveLength(3);
    expect(runs[1]).toEqual({ text: "E = mc^2", bold: false, italic: false, code: false, math: true });
  });

  it("parses mixed formatting", () => {
    const runs = parseInlineMarkdown("**bold** and *italic* and `code`");
    expect(runs.length).toBeGreaterThanOrEqual(5);
    expect(runs[0]).toMatchObject({ text: "bold", bold: true });
    expect(runs[2]).toMatchObject({ text: "italic", italic: true });
    expect(runs[4]).toMatchObject({ text: "code", code: true });
  });

  it("returns single run for empty string", () => {
    const runs = parseInlineMarkdown("");
    expect(runs).toHaveLength(1);
    expect(runs[0]!.text).toBe("");
  });
});

describe("parseMarkdownLines", () => {
  it("parses heading levels", () => {
    const lines = parseMarkdownLines("# H1\n## H2\n### H3");
    expect(lines).toHaveLength(3);
    expect(lines[0]!.fontScale).toBe(1.8);
    expect(lines[0]!.isBold).toBe(true);
    expect(lines[1]!.fontScale).toBe(1.4);
    expect(lines[1]!.isBold).toBe(true);
    expect(lines[2]!.fontScale).toBe(1.1);
    expect(lines[2]!.isBold).toBe(false);
  });

  it("parses bullet lists (- prefix)", () => {
    const lines = parseMarkdownLines("- item one\n- item two");
    expect(lines).toHaveLength(2);
    expect(lines[0]!.bullet).toBe(true);
    expect(lines[0]!.indent).toBe(-1);
    expect(lines[0]!.runs[0]!.text).toBe("item one");
  });

  it("parses bullet lists (* prefix)", () => {
    const lines = parseMarkdownLines("* first\n* second");
    expect(lines).toHaveLength(2);
    expect(lines[0]!.bullet).toBe(true);
    expect(lines[1]!.bullet).toBe(true);
  });

  it("parses multi-line block math ($$...$$)", () => {
    const lines = parseMarkdownLines("before\n$$\nx^2 + y^2 = z^2\n$$\nafter");
    expect(lines).toHaveLength(3);
    expect(lines[0]!.runs[0]!.text).toBe("before");
    expect(lines[1]!.blockMath).toBe("x^2 + y^2 = z^2");
    expect(lines[2]!.runs[0]!.text).toBe("after");
  });

  it("parses single-line block math", () => {
    const lines = parseMarkdownLines("$$E = mc^2$$");
    expect(lines).toHaveLength(1);
    expect(lines[0]!.blockMath).toBe("E = mc^2");
  });

  it("skips empty lines", () => {
    const lines = parseMarkdownLines("line one\n\nline two");
    expect(lines).toHaveLength(2);
  });

  it("parses normal paragraphs with inline markdown", () => {
    const lines = parseMarkdownLines("This is **bold** text");
    expect(lines).toHaveLength(1);
    expect(lines[0]!.fontScale).toBe(1);
    expect(lines[0]!.isBold).toBe(false);
    expect(lines[0]!.bullet).toBe(false);
    expect(lines[0]!.runs.some((r) => r.bold)).toBe(true);
  });
});
