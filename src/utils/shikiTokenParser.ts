// ========================================================================
// Shiki HTML → token parsing
// Extracted from pdfNativeExport.ts for reuse by both PDF and PPTX exporters.
// ========================================================================

import { DEFAULT_CODE_FG } from "@/utils/exportUtils";

export interface CodeToken {
  text: string;
  color: string;
}

export function parseShikiHtml(html: string): CodeToken[][] {
  const lines: CodeToken[][] = [];

  // Extract content inside <code>...</code>
  const codeMatch = html.match(/<code[^>]*>([\s\S]*?)<\/code>/);
  if (!codeMatch) return lines;

  // Split by <span class="line"> markers to get each line's content.
  const lineParts = codeMatch[1]!.split(/<span class="line">/);

  for (const part of lineParts) {
    if (part.trim().length === 0) continue;

    // Remove the trailing </span> that closes the line span itself.
    const lineContent = part.replace(/<\/span>\s*$/, "");
    const tokens: CodeToken[] = [];

    // Extract all colored spans within this line
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

    // Remaining text after last token
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

export function unescapeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}
