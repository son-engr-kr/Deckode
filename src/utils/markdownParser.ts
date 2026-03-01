// ========================================================================
// Shared inline markdown parsing → runs
// Extracted from pdfNativeExport.ts for reuse by both PDF and PPTX exporters.
// ========================================================================

export interface TextRun {
  text: string;
  bold: boolean;
  italic: boolean;
  code: boolean;
  math: boolean; // inline math — will be rasterized
}

export function parseInlineMarkdown(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const re = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)|(\$(.+?)\$)/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      runs.push({
        text: text.slice(last, m.index),
        bold: false,
        italic: false,
        code: false,
        math: false,
      });
    }
    if (m[2] !== undefined) {
      runs.push({ text: m[2], bold: true, italic: false, code: false, math: false });
    } else if (m[4] !== undefined) {
      runs.push({ text: m[4], bold: false, italic: true, code: false, math: false });
    } else if (m[6] !== undefined) {
      runs.push({ text: m[6], bold: false, italic: false, code: true, math: false });
    } else if (m[8] !== undefined) {
      runs.push({ text: m[8], bold: false, italic: false, code: false, math: true });
    }
    last = m.index + m[0].length;
  }

  if (last < text.length) {
    runs.push({
      text: text.slice(last),
      bold: false,
      italic: false,
      code: false,
      math: false,
    });
  }

  if (runs.length === 0) {
    runs.push({ text, bold: false, italic: false, code: false, math: false });
  }

  return runs;
}

// ========================================================================
// Markdown text → parsed lines (headings, bullets, block math, paragraphs)
// ========================================================================

export interface ParsedLine {
  runs: TextRun[];
  indent: number; // pixels of indent (for list items)
  bullet: boolean;
  fontScale: number; // heading scale
  isBold: boolean; // heading forced bold
  blockMath: string | null; // block math expression ($$...$$)
}

export function parseMarkdownLines(source: string): ParsedLine[] {
  const lines = source.split("\n");
  const parsed: ParsedLine[] = [];
  let mathBuf: string[] | null = null;

  for (const line of lines) {
    const t = line.trim();

    // Block math delimiter $$
    if (t === "$$") {
      if (mathBuf === null) {
        mathBuf = [];
      } else {
        parsed.push({
          runs: [],
          indent: 0,
          bullet: false,
          fontScale: 1,
          isBold: false,
          blockMath: mathBuf.join("\n"),
        });
        mathBuf = null;
      }
      continue;
    }

    // Inside block math
    if (mathBuf !== null) {
      mathBuf.push(line);
      continue;
    }

    // Single-line block math $$...$$
    const slm = t.match(/^\$\$(.+)\$\$$/);
    if (slm) {
      parsed.push({
        runs: [],
        indent: 0,
        bullet: false,
        fontScale: 1,
        isBold: false,
        blockMath: slm[1]!,
      });
      continue;
    }

    if (t === "") continue;

    // Heading
    const hm = t.match(/^(#{1,3})\s+(.+)$/);
    if (hm) {
      const level = hm[1]!.length as 1 | 2 | 3;
      const scale = { 1: 1.8, 2: 1.4, 3: 1.1 }[level];
      // h1=bold, h2=semibold(→bold in jsPDF), h3=medium(→normal in jsPDF)
      const bold = level <= 2;
      parsed.push({
        runs: parseInlineMarkdown(hm[2]!),
        indent: 0,
        bullet: false,
        fontScale: scale,
        isBold: bold,
        blockMath: null,
      });
      continue;
    }

    // List item (indent is computed at layout time as 1.5em, matching CSS)
    if (t.startsWith("- ") || t.startsWith("* ")) {
      parsed.push({
        runs: parseInlineMarkdown(t.slice(2)),
        indent: -1, // sentinel: computed as 1.5 * fontSize at layout time
        bullet: true,
        fontScale: 1,
        isBold: false,
        blockMath: null,
      });
      continue;
    }

    // Normal paragraph
    parsed.push({
      runs: parseInlineMarkdown(t),
      indent: 0,
      bullet: false,
      fontScale: 1,
      isBold: false,
      blockMath: null,
    });
  }

  return parsed;
}
