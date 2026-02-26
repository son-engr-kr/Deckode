import type { FileSystemAdapter } from "@/adapters/types";

// ---- Defaults (matching React renderers exactly) ----

export const DEFAULT_BG = "#0f172a";
export const DEFAULT_TEXT_COLOR = "#ffffff";
export const DEFAULT_TEXT_SIZE = 24;
export const DEFAULT_TEXT_FONT = "Inter, system-ui, sans-serif";
export const DEFAULT_LINE_HEIGHT = 1.5;
export const DEFAULT_CODE_SIZE = 16;
export const DEFAULT_CODE_BG = "#1e1e2e";
export const DEFAULT_CODE_FG = "#cdd6f4";
export const DEFAULT_CODE_RADIUS = 8;
export const DEFAULT_CODE_THEME = "github-dark";
export const DEFAULT_TABLE_SIZE = 14;

// ---- Style resolution (mirrors ThemeContext.resolveStyle) ----

export function resolveStyle<T extends object>(
  theme: Partial<T> | undefined,
  element: Partial<T> | undefined,
): Partial<T> {
  if (!theme) return element ?? ({} as Partial<T>);
  if (!element) return theme;
  return { ...theme, ...element };
}

// ---- Asset URL resolution (delegates to the active adapter) ----

export async function resolveAssetSrc(
  src: string,
  adapter: FileSystemAdapter,
): Promise<string> {
  const result = adapter.resolveAssetUrl(src);
  return typeof result === "string" ? result : await result;
}

// ----

export function stripMarkdown(md: string): string {
  return md
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/#{1,6}\s*/g, "")
    .replace(/^\s*[-*]\s/gm, "")
    .replace(/\$\$([\s\S]*?)\$\$/g, "$1") // block math
    .replace(/\$(.*?)\$/g, "$1") // inline math
    .trim();
}

export function toHex(color: string | undefined): string | undefined {
  if (!color || color === "transparent") return undefined;
  return color.replace(/^#/, "");
}

export async function fetchImageAsBase64(src: string): Promise<string | null> {
  const urls = [
    src,
    src.startsWith("./") ? src.slice(2) : src,
  ];
  for (const url of urls) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const blob = await resp.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch {
      continue;
    }
  }
  return null;
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace(/^#/, "");
  const num = parseInt(clean, 16);
  return [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff];
}
