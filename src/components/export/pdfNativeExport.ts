import { jsPDF } from "jspdf";
import "svg2pdf.js";
import { codeToHtml } from "shiki";
import type {
  Deck,
  SlideElement,
  TextElement,
  TextStyle,
  CodeElement,
  CodeStyle,
  ShapeElement,
  ShapeStyle,
  ImageElement,
  ImageStyle,
  TableElement,
  TableStyle,
  TikZElement,
  Slide,
} from "@/types/deck";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/types/deck";
import type { FileSystemAdapter } from "@/adapters/types";
import {
  resolveStyle,
  resolveAssetSrc,
  fetchImageAsBase64,
  hexToRgb,
  DEFAULT_BG,
  DEFAULT_TEXT_COLOR,
  DEFAULT_TEXT_SIZE,
  DEFAULT_TEXT_FONT,
  DEFAULT_LINE_HEIGHT,
  DEFAULT_CODE_SIZE,
  DEFAULT_CODE_BG,
  DEFAULT_CODE_FG,
  DEFAULT_CODE_RADIUS,
  DEFAULT_CODE_THEME,
  DEFAULT_TABLE_SIZE,
} from "@/utils/exportUtils";

// ---- Font mapping: custom fonts → jsPDF 14 standard fonts ----

function mapFont(fontFamily: string): string {
  const lower = fontFamily.toLowerCase();
  if (
    lower.includes("courier") ||
    lower.includes("mono") ||
    lower.includes("fira")
  )
    return "courier";
  if (lower.includes("times") || lower.includes("serif")) return "times";
  return "helvetica";
}

// ---- Color helpers ----

function setFillColor(doc: jsPDF, hex: string): void {
  const [r, g, b] = hexToRgb(hex);
  doc.setFillColor(r, g, b);
}

function setDrawColor(doc: jsPDF, hex: string): void {
  const [r, g, b] = hexToRgb(hex);
  doc.setDrawColor(r, g, b);
}

function setTextColor(doc: jsPDF, hex: string): void {
  const [r, g, b] = hexToRgb(hex);
  doc.setTextColor(r, g, b);
}

// ========================================================================
// Inline markdown parsing → runs
// ========================================================================

interface TextRun {
  text: string;
  bold: boolean;
  italic: boolean;
  code: boolean;
}

function parseInlineMarkdown(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const re = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      runs.push({
        text: text.slice(last, m.index),
        bold: false,
        italic: false,
        code: false,
      });
    }
    if (m[2] !== undefined) {
      runs.push({ text: m[2], bold: true, italic: false, code: false });
    } else if (m[4] !== undefined) {
      runs.push({ text: m[4], bold: false, italic: true, code: false });
    } else if (m[6] !== undefined) {
      runs.push({ text: m[6], bold: false, italic: false, code: true });
    }
    last = m.index + m[0].length;
  }

  if (last < text.length) {
    runs.push({
      text: text.slice(last),
      bold: false,
      italic: false,
      code: false,
    });
  }

  if (runs.length === 0) {
    runs.push({ text, bold: false, italic: false, code: false });
  }

  return runs;
}

// ========================================================================
// Markdown text → PDF (drawText)
// ========================================================================

interface ParsedLine {
  runs: TextRun[];
  indent: number; // pixels of indent (for list items)
  bullet: boolean;
  fontScale: number; // heading scale
  isBold: boolean; // heading forced bold
}

function parseMarkdownLines(source: string): ParsedLine[] {
  const lines = source.split("\n");
  const parsed: ParsedLine[] = [];

  for (const line of lines) {
    const t = line.trim();
    if (t === "") continue;

    // Skip math blocks ($$...$$) — those would need rasterization
    if (t.startsWith("$$")) continue;
    // Skip inline math markers
    if (t === "$$") continue;

    // Heading
    const hm = t.match(/^(#{1,3})\s+(.+)$/);
    if (hm) {
      const level = hm[1]!.length as 1 | 2 | 3;
      const scale = { 1: 1.8, 2: 1.4, 3: 1.1 }[level];
      parsed.push({
        runs: parseInlineMarkdown(hm[2]!),
        indent: 0,
        bullet: false,
        fontScale: scale,
        isBold: true,
      });
      continue;
    }

    // List item
    if (t.startsWith("- ") || t.startsWith("* ")) {
      parsed.push({
        runs: parseInlineMarkdown(t.slice(2)),
        indent: 20,
        bullet: true,
        fontScale: 1,
        isBold: false,
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
    });
  }

  return parsed;
}

function drawText(
  doc: jsPDF,
  el: TextElement,
  deck: Deck,
): void {
  const s = resolveStyle<TextStyle>(deck.theme?.text, el.style);
  const fontFamily = s.fontFamily ?? DEFAULT_TEXT_FONT;
  const baseFontSize = s.fontSize ?? DEFAULT_TEXT_SIZE;
  const color = s.color ?? DEFAULT_TEXT_COLOR;
  const align = s.textAlign ?? "left";
  const lineHeight = s.lineHeight ?? DEFAULT_LINE_HEIGHT;
  const verticalAlign = s.verticalAlign ?? "top";
  const pdfFont = mapFont(fontFamily);

  const { x, y } = el.position;
  const { w, h } = el.size;
  const padding = 4;
  const maxWidth = w - padding * 2;

  const parsedLines = parseMarkdownLines(el.content);

  // Word-wrap each parsed line into visual lines
  interface VisualLine {
    segments: Array<{
      text: string;
      font: string;
      style: string;
      size: number;
    }>;
    indent: number;
    bullet: boolean;
  }

  const visualLines: VisualLine[] = [];

  for (const pl of parsedLines) {
    const fontSize = baseFontSize * pl.fontScale;
    const availWidth = maxWidth - pl.indent;

    // Build word-level segments
    const words: Array<{
      text: string;
      font: string;
      style: string;
      size: number;
    }> = [];

    for (const run of pl.runs) {
      let style = "normal";
      let font = pdfFont;
      if (pl.isBold || run.bold) style = "bold";
      else if (run.italic) style = "italic";
      if (run.code) font = "courier";

      const runWords = run.text.split(/(\s+)/);
      for (const rw of runWords) {
        if (rw.length === 0) continue;
        words.push({ text: rw, font, style, size: fontSize });
      }
    }

    // Wrap words into visual lines
    let currentLine: VisualLine = {
      segments: [],
      indent: pl.indent,
      bullet: pl.bullet,
    };
    let currentWidth = 0;

    for (const w of words) {
      doc.setFont(w.font, w.style);
      doc.setFontSize(w.size);
      const ww = doc.getTextWidth(w.text);

      if (currentWidth + ww > availWidth && currentLine.segments.length > 0) {
        visualLines.push(currentLine);
        currentLine = {
          segments: [],
          indent: pl.indent,
          bullet: false,
        };
        currentWidth = 0;
        // Skip leading whitespace on wrapped lines
        if (w.text.trim().length === 0) continue;
      }

      currentLine.segments.push(w);
      currentWidth += ww;
    }

    if (currentLine.segments.length > 0) {
      visualLines.push(currentLine);
    }
  }

  // Compute total text height for vertical alignment
  const lineHeightPx = baseFontSize * lineHeight;
  const totalHeight = visualLines.length * lineHeightPx;
  let startY: number;
  if (verticalAlign === "middle") {
    startY = y + (h - totalHeight) / 2 + baseFontSize;
  } else if (verticalAlign === "bottom") {
    startY = y + h - totalHeight + baseFontSize - padding;
  } else {
    startY = y + padding + baseFontSize;
  }

  // Render each visual line
  for (let i = 0; i < visualLines.length; i++) {
    const vl = visualLines[i]!;
    const lineY = startY + i * lineHeightPx;

    if (lineY > y + h) break; // clip

    let lineX: number;
    if (align === "center") {
      // Compute total line width for centering
      let totalW = vl.indent;
      for (const seg of vl.segments) {
        doc.setFont(seg.font, seg.style);
        doc.setFontSize(seg.size);
        totalW += doc.getTextWidth(seg.text);
      }
      lineX = x + padding + (maxWidth - totalW) / 2 + vl.indent;
    } else if (align === "right") {
      let totalW = 0;
      for (const seg of vl.segments) {
        doc.setFont(seg.font, seg.style);
        doc.setFontSize(seg.size);
        totalW += doc.getTextWidth(seg.text);
      }
      lineX = x + w - padding - totalW;
    } else {
      lineX = x + padding + vl.indent;
    }

    // Draw bullet
    if (vl.bullet) {
      doc.setFont(pdfFont, "normal");
      doc.setFontSize(baseFontSize);
      setTextColor(doc, color);
      doc.text("\u2022", lineX - 12, lineY);
    }

    // Draw segments
    for (const seg of vl.segments) {
      doc.setFont(seg.font, seg.style);
      doc.setFontSize(seg.size);
      setTextColor(doc, color);
      doc.text(seg.text, lineX, lineY);
      lineX += doc.getTextWidth(seg.text);
    }
  }
}

// ========================================================================
// Shiki code → PDF (drawCode)
// ========================================================================

interface CodeToken {
  text: string;
  color: string;
}

function parseShikiHtml(html: string): CodeToken[][] {
  const lines: CodeToken[][] = [];
  // Split by <span class="line"> to get each line
  const lineRegex = /<span class="line">(.*?)<\/span>/gs;
  let lineMatch: RegExpExecArray | null;

  while ((lineMatch = lineRegex.exec(html)) !== null) {
    const lineContent = lineMatch[1]!;
    const tokens: CodeToken[] = [];

    // Extract spans with style="color:..."
    const tokenRegex =
      /<span style="color:\s*(#[0-9a-fA-F]{3,8})">(.*?)<\/span>/g;
    let tokenMatch: RegExpExecArray | null;
    let lastEnd = 0;

    while ((tokenMatch = tokenRegex.exec(lineContent)) !== null) {
      // Plain text between tokens
      if (tokenMatch.index > lastEnd) {
        const plain = lineContent
          .slice(lastEnd, tokenMatch.index)
          .replace(/<[^>]*>/g, "");
        if (plain.length > 0) {
          tokens.push({ text: unescapeHtml(plain), color: DEFAULT_CODE_FG });
        }
      }
      tokens.push({
        text: unescapeHtml(tokenMatch[2]!),
        color: tokenMatch[1]!,
      });
      lastEnd = tokenMatch.index + tokenMatch[0].length;
    }

    // Remaining text in the line
    if (lastEnd < lineContent.length) {
      const remaining = lineContent.slice(lastEnd).replace(/<[^>]*>/g, "");
      if (remaining.length > 0) {
        tokens.push({ text: unescapeHtml(remaining), color: DEFAULT_CODE_FG });
      }
    }

    lines.push(tokens);
  }

  return lines;
}

function unescapeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

async function drawCode(
  doc: jsPDF,
  el: CodeElement,
  deck: Deck,
): Promise<void> {
  const s = resolveStyle<CodeStyle>(deck.theme?.code, el.style);
  const fontSize = s.fontSize ?? DEFAULT_CODE_SIZE;
  const radius = s.borderRadius ?? DEFAULT_CODE_RADIUS;
  const theme = s.theme ?? DEFAULT_CODE_THEME;
  const bgColor = DEFAULT_CODE_BG;

  const { x, y } = el.position;
  const { w, h } = el.size;

  // Draw background
  setFillColor(doc, bgColor);
  doc.roundedRect(x, y, w, h, radius, radius, "F");

  if (!el.content) return;

  const html = await codeToHtml(el.content, { lang: el.language, theme });
  const tokenLines = parseShikiHtml(html);

  const padding = 16;
  const lineHeight = fontSize * 1.5;
  let drawY = y + padding + fontSize;

  doc.setFont("courier", "normal");
  doc.setFontSize(fontSize);

  for (const tokens of tokenLines) {
    if (drawY > y + h - padding) break;

    let drawX = x + padding;
    for (const token of tokens) {
      setTextColor(doc, token.color);
      doc.text(token.text, drawX, drawY);
      drawX += doc.getTextWidth(token.text);
    }
    drawY += lineHeight;
  }
}

// ========================================================================
// Shape → PDF (drawShape)
// ========================================================================

function drawShape(doc: jsPDF, el: ShapeElement, deck: Deck): void {
  const s = resolveStyle<ShapeStyle>(deck.theme?.shape, el.style);
  const fill = s.fill ?? "transparent";
  const stroke = s.stroke ?? "#ffffff";
  const strokeWidth = s.strokeWidth ?? 1;
  const { x, y } = el.position;
  const { w, h } = el.size;

  doc.setLineWidth(strokeWidth);
  setDrawColor(doc, stroke);

  if (el.shape === "rectangle") {
    const radius = s.borderRadius ?? 0;
    const hasFill = fill !== "transparent";
    if (hasFill) setFillColor(doc, fill);

    const drawMode = hasFill ? "FD" : "S";
    if (radius > 0) {
      doc.roundedRect(x, y, w, h, radius, radius, drawMode);
    } else {
      doc.rect(x, y, w, h, drawMode);
    }
  } else if (el.shape === "ellipse") {
    const hasFill = fill !== "transparent";
    if (hasFill) setFillColor(doc, fill);
    const drawMode = hasFill ? "FD" : "S";
    doc.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, drawMode);
  } else if (el.shape === "line") {
    doc.line(x, y + h / 2, x + w, y + h / 2);
  } else if (el.shape === "arrow") {
    doc.line(x, y + h / 2, x + w, y + h / 2);
    // Draw arrowhead as a filled triangle
    const headSize = 10;
    const tipX = x + w;
    const tipY = y + h / 2;
    setFillColor(doc, stroke);
    doc.triangle(
      tipX,
      tipY,
      tipX - headSize,
      tipY - headSize / 2,
      tipX - headSize,
      tipY + headSize / 2,
      "F",
    );
  }
}

// ========================================================================
// Image → PDF (drawImage)
// ========================================================================

async function drawImage(
  doc: jsPDF,
  el: ImageElement,
  deck: Deck,
  adapter: FileSystemAdapter,
): Promise<void> {
  resolveStyle<ImageStyle>(deck.theme?.image, el.style);

  const resolved = await resolveAssetSrc(el.src, adapter);
  const b64 = await fetchImageAsBase64(resolved);
  const imgData = b64 ?? resolved;

  const { x, y } = el.position;
  const { w, h } = el.size;

  doc.addImage(imgData, "PNG", x, y, w, h);
}

// ========================================================================
// Table → PDF (drawTable)
// ========================================================================

function drawTable(doc: jsPDF, el: TableElement, deck: Deck): void {
  const s = resolveStyle<TableStyle>(deck.theme?.table, el.style);
  const fontSize = s.fontSize ?? DEFAULT_TABLE_SIZE;
  const color = s.color ?? "#e2e8f0";
  const hBg = s.headerBackground ?? "#1e293b";
  const hColor = s.headerColor ?? "#f8fafc";
  const bColor = s.borderColor ?? "#334155";

  const { x, y } = el.position;
  const { w, h } = el.size;
  const colCount = el.columns.length;
  const rowCount = el.rows.length + 1; // +1 for header
  const colWidth = w / colCount;
  const rowHeight = h / rowCount;
  const cellPadding = 6;

  doc.setFontSize(fontSize);
  doc.setLineWidth(0.5);

  // Draw outer border
  setDrawColor(doc, bColor);
  doc.rect(x, y, w, h, "S");

  // Header row
  setFillColor(doc, hBg);
  doc.rect(x, y, w, rowHeight, "F");
  doc.setFont("helvetica", "bold");
  setTextColor(doc, hColor);

  for (let ci = 0; ci < colCount; ci++) {
    const cellX = x + ci * colWidth;
    doc.text(
      el.columns[ci] ?? "",
      cellX + cellPadding,
      y + rowHeight / 2 + fontSize / 3,
    );
    // Column separator
    if (ci > 0) {
      doc.line(cellX, y, cellX, y + h);
    }
  }

  // Header bottom border
  doc.line(x, y + rowHeight, x + w, y + rowHeight);

  // Data rows
  doc.setFont("helvetica", "normal");
  setTextColor(doc, color);

  for (let ri = 0; ri < el.rows.length; ri++) {
    const rowY = y + (ri + 1) * rowHeight;

    // Row bottom border
    if (ri < el.rows.length - 1) {
      setDrawColor(doc, bColor);
      doc.line(x, rowY + rowHeight, x + w, rowY + rowHeight);
    }

    for (let ci = 0; ci < colCount; ci++) {
      const cellX = x + ci * colWidth;
      const cellText = el.rows[ri]?.[ci] ?? "";
      doc.text(
        cellText,
        cellX + cellPadding,
        rowY + rowHeight / 2 + fontSize / 3,
      );
    }
  }
}

// ========================================================================
// TikZ → PDF via svg2pdf.js (vector quality)
// ========================================================================

async function drawTikZ(
  doc: jsPDF,
  el: TikZElement,
  _deck: Deck,
  adapter: FileSystemAdapter,
): Promise<void> {
  if (!el.svgUrl) return;

  const resolved = await resolveAssetSrc(el.svgUrl, adapter);
  const { x, y } = el.position;
  const { w, h } = el.size;

  // Fetch SVG text and parse into DOM element
  const resp = await fetch(resolved);
  if (!resp.ok) return;
  const svgText = await resp.text();

  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgText, "image/svg+xml");
  const svgElement = svgDoc.documentElement;

  // Use svg2pdf.js to render SVG as vector paths in the PDF
  await doc.svg(svgElement, { x, y, width: w, height: h });
}

// ========================================================================
// Video → PDF (placeholder)
// ========================================================================

function drawVideo(doc: jsPDF, el: SlideElement): void {
  const { x, y } = el.position;
  const { w, h } = el.size;

  setFillColor(doc, "#1e1e1e");
  doc.rect(x, y, w, h, "F");

  setDrawColor(doc, "#666666");
  doc.setLineWidth(1);
  doc.rect(x, y, w, h, "S");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  setTextColor(doc, "#999999");
  doc.text("[Video]", x + w / 2, y + h / 2, { align: "center" });
}

// ========================================================================
// Slide rendering
// ========================================================================

async function renderSlide(
  doc: jsPDF,
  slide: Slide,
  deck: Deck,
  adapter: FileSystemAdapter,
): Promise<void> {
  // Fill slide background
  const bg = slide.background ?? deck.theme?.slide?.background;
  const bgColor = bg?.color ?? DEFAULT_BG;
  setFillColor(doc, bgColor);
  doc.rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, "F");

  // Render each element
  for (const el of slide.elements) {
    switch (el.type) {
      case "text":
        drawText(doc, el, deck);
        break;
      case "code":
        await drawCode(doc, el, deck);
        break;
      case "shape":
        drawShape(doc, el, deck);
        break;
      case "image":
        await drawImage(doc, el, deck, adapter);
        break;
      case "table":
        drawTable(doc, el, deck);
        break;
      case "tikz":
        await drawTikZ(doc, el, deck, adapter);
        break;
      case "video":
        drawVideo(doc, el);
        break;
    }
  }
}

// ========================================================================
// Public API
// ========================================================================

export async function buildNativePdf(
  deck: Deck,
  adapter: FileSystemAdapter,
): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "px",
    format: [CANVAS_WIDTH, CANVAS_HEIGHT],
    hotfixes: ["px_scaling"],
  });

  const slides = deck.slides.filter((s) => !s.hidden);

  for (let i = 0; i < slides.length; i++) {
    if (i > 0) doc.addPage([CANVAS_WIDTH, CANVAS_HEIGHT], "landscape");
    await renderSlide(doc, slides[i]!, deck, adapter);
  }

  return doc;
}

export async function exportToNativePdf(
  deck: Deck,
  adapter: FileSystemAdapter,
): Promise<void> {
  const doc = await buildNativePdf(deck, adapter);
  const name = (deck.meta.title || "presentation").replace(
    /[^a-zA-Z0-9_-]/g,
    "_",
  );
  doc.save(`${name}_native.pdf`);
}
