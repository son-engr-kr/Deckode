import { describe, it, expect } from "vitest";
import { parseShikiHtml, unescapeHtml } from "./shikiTokenParser";

describe("unescapeHtml", () => {
  it("unescapes &amp;", () => {
    expect(unescapeHtml("a &amp; b")).toBe("a & b");
  });

  it("unescapes &lt; and &gt;", () => {
    expect(unescapeHtml("&lt;div&gt;")).toBe("<div>");
  });

  it("unescapes &quot; and &#39; and &#x27;", () => {
    expect(unescapeHtml('&quot;hello&#39; world&#x27;')).toBe('"hello\' world\'');
  });

  it("handles strings with no entities", () => {
    expect(unescapeHtml("plain text")).toBe("plain text");
  });
});

describe("parseShikiHtml", () => {
  it("returns empty array for empty input", () => {
    expect(parseShikiHtml("")).toEqual([]);
  });

  it("returns empty array if no code tag found", () => {
    expect(parseShikiHtml("<div>no code</div>")).toEqual([]);
  });

  it("extracts tokens from colored spans", () => {
    const html = `<pre><code><span class="line"><span style="color: #FF0000">const</span> <span style="color: #00FF00">x</span></span></code></pre>`;
    const lines = parseShikiHtml(html);
    expect(lines).toHaveLength(1);
    // Parser extracts: "const" (colored), " " (plain between spans), "x" (colored)
    expect(lines[0]!.length).toBeGreaterThanOrEqual(2);
    expect(lines[0]![0]).toEqual({ text: "const", color: "#FF0000" });
    // The space between spans is a separate plain-text token
    const lastToken = lines[0]![lines[0]!.length - 1]!;
    expect(lastToken).toEqual({ text: "x", color: "#00FF00" });
  });

  it("handles multi-line code", () => {
    const html = `<pre><code><span class="line"><span style="color: #FF0000">line1</span></span>
<span class="line"><span style="color: #00FF00">line2</span></span></code></pre>`;
    const lines = parseShikiHtml(html);
    expect(lines).toHaveLength(2);
    expect(lines[0]![0]!.text).toBe("line1");
    expect(lines[1]![0]!.text).toBe("line2");
  });

  it("unescapes HTML entities in token text", () => {
    const html = `<pre><code><span class="line"><span style="color: #FF0000">&lt;div&gt;</span></span></code></pre>`;
    const lines = parseShikiHtml(html);
    expect(lines[0]![0]!.text).toBe("<div>");
  });

  it("handles plain text between spans with default color", () => {
    const html = `<pre><code><span class="line">plain <span style="color: #FF0000">colored</span> text</span></code></pre>`;
    const lines = parseShikiHtml(html);
    expect(lines[0]!.length).toBeGreaterThanOrEqual(2);
    // First token should be plain text with default color
    expect(lines[0]![0]!.text).toBe("plain ");
    expect(lines[0]![1]!.text).toBe("colored");
    expect(lines[0]![1]!.color).toBe("#FF0000");
  });
});
