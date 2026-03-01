// ========================================================================
// Shared rasterization utilities for KaTeX math and SVG → PNG conversion.
// Used by both PDF native and PPTX exporters.
// ========================================================================

import katex from "katex";

const RASTER_SCALE = 2;

/**
 * Render a KaTeX expression to a base64 PNG data URL.
 * Returns null if the rendered image has zero dimensions.
 */
export async function rasterizeKatexToBase64(
  expr: string,
  displayMode: boolean,
  maxWidth: number,
  color: string,
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  const html = katex.renderToString(expr, {
    displayMode,
    throwOnError: false,
  });
  return rasterizeHtmlToBase64(html, maxWidth, color);
}

/**
 * Render arbitrary HTML snippet to a base64 PNG data URL.
 * Used internally for KaTeX and available for other inline HTML rasterization.
 */
export async function rasterizeHtmlToBase64(
  html: string,
  maxWidth: number,
  color: string,
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  const wrapper = document.createElement("div");
  wrapper.style.cssText =
    "position:fixed;left:0;top:0;z-index:-2147483647;pointer-events:none";

  const container = document.createElement("div");
  container.style.cssText = `display:inline-block;max-width:${maxWidth}px;color:${color};font-size:16px`;
  container.innerHTML = html;
  wrapper.appendChild(container);
  document.body.appendChild(wrapper);

  // Wait for KaTeX fonts to load
  await document.fonts.ready;
  await new Promise((r) => setTimeout(r, 50));

  const rect = container.getBoundingClientRect();
  const w = Math.ceil(rect.width);
  const h = Math.ceil(rect.height);

  if (w === 0 || h === 0) {
    wrapper.remove();
    return null;
  }

  const { toPng } = await import("html-to-image");
  const dataUrl = await toPng(container, {
    width: w,
    height: h,
    pixelRatio: RASTER_SCALE,
    skipFonts: false,
  });

  wrapper.remove();
  return { dataUrl, width: w, height: h };
}

/**
 * Rasterize an SVG (from URL) to a base64 PNG data URL.
 * Used for TikZ diagrams and SVG images.
 */
export async function rasterizeSvgToBase64(
  url: string,
  w: number,
  h: number,
): Promise<string | null> {
  const resp = await fetch(url);
  if (!resp.ok) return null;
  const svgText = await resp.text();
  const blob = new Blob([svgText], {
    type: "image/svg+xml;charset=utf-8",
  });
  const blobUrl = URL.createObjectURL(blob);
  const img = new Image();
  const loaded = await new Promise<boolean>((resolve) => {
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = blobUrl;
  });
  if (!loaded) {
    URL.revokeObjectURL(blobUrl);
    return null;
  }
  // Preserve aspect ratio
  const nw = img.naturalWidth || w;
  const nh = img.naturalHeight || h;
  let rw: number, rh: number;
  if (nw / nh > w / h) {
    rw = w;
    rh = w * (nh / nw);
  } else {
    rh = h;
    rw = h * (nw / nh);
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(rw * RASTER_SCALE);
  canvas.height = Math.round(rh * RASTER_SCALE);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(RASTER_SCALE, RASTER_SCALE);
  ctx.drawImage(img, 0, 0, rw, rh);
  URL.revokeObjectURL(blobUrl);
  return canvas.toDataURL("image/png");
}
