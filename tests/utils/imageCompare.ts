export interface ComparisonResult {
  rmse: number; // root mean square error (0-255)
  diffPercent: number; // % of pixels that differ beyond threshold
}

/**
 * Compare two RGBA image buffers pixel-by-pixel.
 * @param buf1 - First image RGBA buffer (Uint8Array of length w*h*4)
 * @param buf2 - Second image RGBA buffer (Uint8Array of length w*h*4)
 * @param w - Image width
 * @param h - Image height
 * @param threshold - Per-channel threshold (0-255) below which a pixel diff is ignored. Default 16.
 * @returns ComparisonResult with RMSE and diffPercent
 */
export function compareImages(
  buf1: Uint8Array,
  buf2: Uint8Array,
  w: number,
  h: number,
  threshold = 16,
): ComparisonResult {
  const totalPixels = w * h;
  assert(
    buf1.length === totalPixels * 4,
    `buf1 length ${buf1.length} !== expected ${totalPixels * 4}`,
  );
  assert(
    buf2.length === totalPixels * 4,
    `buf2 length ${buf2.length} !== expected ${totalPixels * 4}`,
  );

  let sumSqError = 0;
  let diffPixels = 0;

  for (let i = 0; i < totalPixels; i++) {
    const offset = i * 4;
    const dr = buf1[offset]! - buf2[offset]!;
    const dg = buf1[offset + 1]! - buf2[offset + 1]!;
    const db = buf1[offset + 2]! - buf2[offset + 2]!;

    const pixelErr = (dr * dr + dg * dg + db * db) / 3;
    sumSqError += pixelErr;

    if (
      Math.abs(dr) > threshold ||
      Math.abs(dg) > threshold ||
      Math.abs(db) > threshold
    ) {
      diffPixels++;
    }
  }

  const rmse = Math.sqrt(sumSqError / totalPixels);
  const diffPercent = (diffPixels / totalPixels) * 100;

  return { rmse, diffPercent };
}

/**
 * Generate a diff heatmap RGBA buffer highlighting pixel differences.
 * Returns a buffer where different pixels are red and matching pixels are
 * a dimmed version of buf1.
 */
export function generateDiffHeatmap(
  buf1: Uint8Array,
  buf2: Uint8Array,
  w: number,
  h: number,
  threshold = 16,
): Uint8Array {
  const totalPixels = w * h;
  const out = new Uint8Array(totalPixels * 4);

  for (let i = 0; i < totalPixels; i++) {
    const offset = i * 4;
    const dr = Math.abs(buf1[offset]! - buf2[offset]!);
    const dg = Math.abs(buf1[offset + 1]! - buf2[offset + 1]!);
    const db = Math.abs(buf1[offset + 2]! - buf2[offset + 2]!);

    if (dr > threshold || dg > threshold || db > threshold) {
      // Highlight differences in red with intensity proportional to error
      const intensity = Math.min(255, Math.round((dr + dg + db) / 3 * 2));
      out[offset] = intensity; // R
      out[offset + 1] = 0; // G
      out[offset + 2] = 0; // B
      out[offset + 3] = 255; // A
    } else {
      // Dim version of original
      out[offset] = Math.round(buf1[offset]! * 0.3);
      out[offset + 1] = Math.round(buf1[offset + 1]! * 0.3);
      out[offset + 2] = Math.round(buf1[offset + 2]! * 0.3);
      out[offset + 3] = 255;
    }
  }

  return out;
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}
