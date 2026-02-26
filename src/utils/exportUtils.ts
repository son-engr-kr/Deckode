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
