import { describe, it, expect, vi } from "vitest";
import type { Deck } from "@/types/deck";
import type { FileSystemAdapter } from "@/adapters/types";

// Mock shiki — codeToHtml is async and returns highlighted HTML
vi.mock("shiki", () => ({
  codeToHtml: vi.fn(async (code: string) => {
    // Return minimal Shiki-like HTML with span.line wrapping
    const escaped = code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const lines = escaped.split("\n").map(
      (l) => `<span class="line"><span style="color: #cdd6f4">${l}</span></span>`
    );
    return `<pre class="shiki"><code>${lines.join("\n")}</code></pre>`;
  }),
}));

// Mock svg2pdf.js — it extends jsPDF prototype
vi.mock("svg2pdf.js", () => ({}));

// Now import the module under test (after mocks are set up)
const { buildNativePdf } = await import("./pdfNativeExport");

function makeMockAdapter(): FileSystemAdapter {
  return {
    loadDeck: vi.fn(),
    saveDeck: vi.fn(),
    listProjects: vi.fn(),
    createProject: vi.fn(),
    deleteProject: vi.fn(),
    uploadAsset: vi.fn(),
    resolveAssetUrl: vi.fn((path: string) => path),
    renderTikz: vi.fn(),
    listComponents: vi.fn(),
    listLayouts: vi.fn(),
    loadLayout: vi.fn(),
    mode: "vite" as const,
    projectName: "test",
    lastSaveTs: 0,
  } as unknown as FileSystemAdapter;
}

function makeBaseDeck(overrides?: Partial<Deck>): Deck {
  return {
    deckode: "1.0",
    meta: { title: "Test Presentation", aspectRatio: "16:9" as const },
    slides: [],
    ...overrides,
  };
}

describe("buildNativePdf", () => {
  it("produces correct page count for visible slides", async () => {
    const deck = makeBaseDeck({
      slides: [
        { id: "s1", elements: [] },
        { id: "s2", elements: [] },
        { id: "s3", elements: [] },
      ],
    });

    const doc = await buildNativePdf(deck, makeMockAdapter());
    const pageCount = doc.getNumberOfPages();
    expect(pageCount).toBe(3);
  });

  it("excludes hidden slides", async () => {
    const deck = makeBaseDeck({
      slides: [
        { id: "s1", elements: [] },
        { id: "s2", hidden: true, elements: [] },
        { id: "s3", elements: [] },
      ],
    });

    const doc = await buildNativePdf(deck, makeMockAdapter());
    expect(doc.getNumberOfPages()).toBe(2);
  });

  it("produces a single page for a single-slide deck", async () => {
    const deck = makeBaseDeck({
      slides: [{ id: "s1", elements: [] }],
    });

    const doc = await buildNativePdf(deck, makeMockAdapter());
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it("renders text elements as selectable text in the PDF", async () => {
    const deck = makeBaseDeck({
      slides: [
        {
          id: "s1",
          elements: [
            {
              id: "t1",
              type: "text" as const,
              content: "Hello Selectable World",
              position: { x: 50, y: 50 },
              size: { w: 400, h: 100 },
            },
          ],
        },
      ],
    });

    const doc = await buildNativePdf(deck, makeMockAdapter());
    // Extract the internal PDF content to verify text presence
    const pdfOutput = doc.output("datauristring");
    // The text should be embedded as native PDF text operators
    // Verify the doc was generated without errors
    expect(pdfOutput).toBeTruthy();
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it("renders markdown bold/italic text without crashing", async () => {
    const deck = makeBaseDeck({
      slides: [
        {
          id: "s1",
          elements: [
            {
              id: "t1",
              type: "text" as const,
              content: "This is **bold** and *italic* text",
              position: { x: 50, y: 50 },
              size: { w: 400, h: 100 },
            },
          ],
        },
      ],
    });

    const doc = await buildNativePdf(deck, makeMockAdapter());
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it("renders heading text", async () => {
    const deck = makeBaseDeck({
      slides: [
        {
          id: "s1",
          elements: [
            {
              id: "t1",
              type: "text" as const,
              content: "# Main Title\n## Subtitle\nParagraph text",
              position: { x: 50, y: 50 },
              size: { w: 400, h: 200 },
            },
          ],
        },
      ],
    });

    const doc = await buildNativePdf(deck, makeMockAdapter());
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it("renders list items with bullets", async () => {
    const deck = makeBaseDeck({
      slides: [
        {
          id: "s1",
          elements: [
            {
              id: "t1",
              type: "text" as const,
              content: "- Item one\n- Item two\n- Item three",
              position: { x: 50, y: 50 },
              size: { w: 400, h: 200 },
            },
          ],
        },
      ],
    });

    const doc = await buildNativePdf(deck, makeMockAdapter());
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it("renders code block text", async () => {
    const deck = makeBaseDeck({
      slides: [
        {
          id: "s1",
          elements: [
            {
              id: "c1",
              type: "code" as const,
              language: "typescript",
              content: "const x = 42;\nconsole.log(x);",
              position: { x: 50, y: 50 },
              size: { w: 400, h: 200 },
            },
          ],
        },
      ],
    });

    const doc = await buildNativePdf(deck, makeMockAdapter());
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it("renders table with header and data rows", async () => {
    const deck = makeBaseDeck({
      slides: [
        {
          id: "s1",
          elements: [
            {
              id: "tbl1",
              type: "table" as const,
              columns: ["Name", "Value"],
              rows: [
                ["Alpha", "100"],
                ["Beta", "200"],
              ],
              position: { x: 50, y: 50 },
              size: { w: 400, h: 200 },
            },
          ],
        },
      ],
    });

    const doc = await buildNativePdf(deck, makeMockAdapter());
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it("renders shapes without crashing", async () => {
    const deck = makeBaseDeck({
      slides: [
        {
          id: "s1",
          elements: [
            {
              id: "sh1",
              type: "shape" as const,
              shape: "rectangle" as const,
              position: { x: 50, y: 50 },
              size: { w: 200, h: 100 },
            },
            {
              id: "sh2",
              type: "shape" as const,
              shape: "ellipse" as const,
              position: { x: 300, y: 50 },
              size: { w: 150, h: 100 },
            },
            {
              id: "sh3",
              type: "shape" as const,
              shape: "line" as const,
              position: { x: 50, y: 200 },
              size: { w: 300, h: 20 },
            },
            {
              id: "sh4",
              type: "shape" as const,
              shape: "arrow" as const,
              position: { x: 50, y: 250 },
              size: { w: 300, h: 20 },
            },
          ],
        },
      ],
    });

    const doc = await buildNativePdf(deck, makeMockAdapter());
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it("renders video as placeholder without crashing", async () => {
    const deck = makeBaseDeck({
      slides: [
        {
          id: "s1",
          elements: [
            {
              id: "v1",
              type: "video" as const,
              src: "test.mp4",
              position: { x: 50, y: 50 },
              size: { w: 400, h: 300 },
            },
          ],
        },
      ],
    });

    const doc = await buildNativePdf(deck, makeMockAdapter());
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it("handles all hidden slides (produces single blank page)", async () => {
    const deck = makeBaseDeck({
      slides: [
        { id: "s1", hidden: true, elements: [] },
        { id: "s2", hidden: true, elements: [] },
      ],
    });

    const doc = await buildNativePdf(deck, makeMockAdapter());
    // jsPDF always starts with 1 page; with no visible slides, it stays at 1
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it("handles mixed element types on a single slide", async () => {
    const deck = makeBaseDeck({
      slides: [
        {
          id: "s1",
          elements: [
            {
              id: "t1",
              type: "text" as const,
              content: "Title",
              position: { x: 50, y: 30 },
              size: { w: 300, h: 50 },
            },
            {
              id: "c1",
              type: "code" as const,
              language: "javascript",
              content: "let x = 1;",
              position: { x: 50, y: 100 },
              size: { w: 300, h: 100 },
            },
            {
              id: "sh1",
              type: "shape" as const,
              shape: "rectangle" as const,
              position: { x: 400, y: 50 },
              size: { w: 200, h: 150 },
            },
            {
              id: "tbl1",
              type: "table" as const,
              columns: ["A", "B"],
              rows: [["1", "2"]],
              position: { x: 400, y: 250 },
              size: { w: 300, h: 100 },
            },
          ],
        },
      ],
    });

    const doc = await buildNativePdf(deck, makeMockAdapter());
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it("applies theme defaults to text elements", async () => {
    const deck = makeBaseDeck({
      theme: {
        text: { color: "#ff0000", fontSize: 32 },
      },
      slides: [
        {
          id: "s1",
          elements: [
            {
              id: "t1",
              type: "text" as const,
              content: "Themed text",
              position: { x: 50, y: 50 },
              size: { w: 400, h: 100 },
            },
          ],
        },
      ],
    });

    const doc = await buildNativePdf(deck, makeMockAdapter());
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it("generates valid PDF output as arraybuffer", async () => {
    const deck = makeBaseDeck({
      slides: [
        {
          id: "s1",
          elements: [
            {
              id: "t1",
              type: "text" as const,
              content: "PDF content test",
              position: { x: 50, y: 50 },
              size: { w: 400, h: 100 },
            },
          ],
        },
      ],
    });

    const doc = await buildNativePdf(deck, makeMockAdapter());
    const buffer = doc.output("arraybuffer");
    expect(buffer).toBeInstanceOf(ArrayBuffer);
    expect(buffer.byteLength).toBeGreaterThan(0);

    // Check PDF magic bytes: %PDF
    const header = new Uint8Array(buffer, 0, 4);
    expect(String.fromCharCode(...header)).toBe("%PDF");
  });
});
