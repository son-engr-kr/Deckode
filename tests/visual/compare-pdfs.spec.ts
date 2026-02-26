/**
 * PDF Side-by-Side Comparison Test
 *
 * Renders both PDF exports (image-based and native) page-by-page,
 * computes per-pixel RMSE between them, and saves comparison images.
 *
 * Usage:
 *   npx playwright test tests/visual/compare-pdfs.spec.ts
 *
 * Output:
 *   test-results/pdf-compare/
 *     image-page-1.png, native-page-1.png, diff-page-1.png
 *     comparison-report.json  (per-page RMSE scores)
 *
 * The diff images highlight pixel differences. Lower RMSE = more similar.
 * Use these outputs to iteratively improve native PDF fidelity.
 */
import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const COMPARE_DIR = path.resolve(
  __dirname,
  "../../test-results/pdf-compare",
);

test("render and compare both PDF exports side by side", async ({ page }) => {
  test.setTimeout(120_000);
  fs.mkdirSync(COMPARE_DIR, { recursive: true });

  // Navigate and wait for app
  await page.goto("/");
  await page.waitForSelector(".h-screen", { timeout: 15_000 });

  // Check if there's a project loaded (PDF button visible)
  const pdfButton = page.locator("button", { hasText: /PDF/ });
  const hasPdf = (await pdfButton.count()) > 0;
  if (!hasPdf) {
    console.log("No project loaded — open a project first, then run this test");
    test.skip();
    return;
  }

  // Collect downloaded PDFs
  const pdfFiles: Record<string, string> = {};
  page.on("download", async (download) => {
    const name = download.suggestedFilename();
    const savePath = path.join(COMPARE_DIR, name);
    await download.saveAs(savePath);
    const key = name.includes("native") ? "native" : "image";
    pdfFiles[key] = savePath;
  });

  // Export Image PDF
  await pdfButton.first().click();
  await page.waitForTimeout(300);
  const imageBtn = page.locator("button", { hasText: "PDF (Image)" });
  if (await imageBtn.isVisible({ timeout: 2000 })) {
    await imageBtn.click();
    // Wait for export to complete (image-based is slower)
    await page.waitForEvent("download", { timeout: 30_000 });
    await page.waitForTimeout(1000);
  }

  // Export Native PDF
  await pdfButton.first().click();
  await page.waitForTimeout(300);
  const nativeBtn = page.locator("button", { hasText: "PDF (Native)" });
  if (await nativeBtn.isVisible({ timeout: 2000 })) {
    await nativeBtn.click();
    await page.waitForEvent("download", { timeout: 30_000 });
    await page.waitForTimeout(1000);
  }

  expect(pdfFiles["image"]).toBeTruthy();
  expect(pdfFiles["native"]).toBeTruthy();

  // Render PDF pages to PNG arrays in the browser via pdfjs-dist
  async function renderPdfToImages(
    pdfPath: string,
  ): Promise<string[]> {
    const bytes = fs.readFileSync(pdfPath);
    const b64 = bytes.toString("base64");

    return page.evaluate(async (b64Data: string) => {
      const binary = atob(b64Data);
      const arr = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);

      // @ts-expect-error dynamic CDN import
      const pdfjsLib = await import(
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.min.mjs"
      );
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.worker.min.mjs";

      const pdf = await pdfjsLib.getDocument({ data: arr }).promise;
      const imgs: string[] = [];
      for (let p = 1; p <= pdf.numPages; p++) {
        const pg = await pdf.getPage(p);
        const vp = pg.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = vp.width;
        canvas.height = vp.height;
        const ctx = canvas.getContext("2d")!;
        await pg.render({ canvasContext: ctx, viewport: vp }).promise;
        imgs.push(canvas.toDataURL("image/png"));
      }
      return imgs;
    }, b64);
  }

  const imagePages = await renderPdfToImages(pdfFiles["image"]!);
  const nativePages = await renderPdfToImages(pdfFiles["native"]!);

  expect(imagePages.length).toBe(nativePages.length);

  // Save page images and compute diff
  const report: Array<{
    page: number;
    imageFile: string;
    nativeFile: string;
    diffFile: string;
    rmse: number;
  }> = [];

  for (let i = 0; i < imagePages.length; i++) {
    const imgData = imagePages[i]!.replace(/^data:image\/png;base64,/, "");
    const natData = nativePages[i]!.replace(/^data:image\/png;base64,/, "");

    const imgFile = `image-page-${i + 1}.png`;
    const natFile = `native-page-${i + 1}.png`;
    fs.writeFileSync(
      path.join(COMPARE_DIR, imgFile),
      Buffer.from(imgData, "base64"),
    );
    fs.writeFileSync(
      path.join(COMPARE_DIR, natFile),
      Buffer.from(natData, "base64"),
    );

    // Compute pixel-level RMSE diff in the browser
    const diffResult = await page.evaluate(
      async (args: { img1: string; img2: string }) => {
        const load = (src: string): Promise<HTMLImageElement> =>
          new Promise((res) => {
            const img = new Image();
            img.onload = () => res(img);
            img.src = src;
          });

        const [a, b] = await Promise.all([
          load(`data:image/png;base64,${args.img1}`),
          load(`data:image/png;base64,${args.img2}`),
        ]);

        const w = Math.max(a.width, b.width);
        const h = Math.max(a.height, b.height);

        const ca = document.createElement("canvas");
        ca.width = w;
        ca.height = h;
        const ctxA = ca.getContext("2d")!;
        ctxA.drawImage(a, 0, 0);
        const dataA = ctxA.getImageData(0, 0, w, h);

        const cb = document.createElement("canvas");
        cb.width = w;
        cb.height = h;
        const ctxB = cb.getContext("2d")!;
        ctxB.drawImage(b, 0, 0);
        const dataB = ctxB.getImageData(0, 0, w, h);

        // Compute RMSE and create diff image
        const diffCanvas = document.createElement("canvas");
        diffCanvas.width = w;
        diffCanvas.height = h;
        const ctxD = diffCanvas.getContext("2d")!;
        const diffData = ctxD.createImageData(w, h);

        let sumSq = 0;
        const n = w * h;
        for (let p = 0; p < n; p++) {
          const idx = p * 4;
          const dr = dataA.data[idx]! - dataB.data[idx]!;
          const dg = dataA.data[idx + 1]! - dataB.data[idx + 1]!;
          const db = dataA.data[idx + 2]! - dataB.data[idx + 2]!;
          const dist = Math.sqrt(dr * dr + dg * dg + db * db);
          sumSq += dist * dist;

          // Diff visualization: red = different, gray = same
          if (dist > 10) {
            const intensity = Math.min(255, dist * 2);
            diffData.data[idx] = intensity;
            diffData.data[idx + 1] = 0;
            diffData.data[idx + 2] = 0;
            diffData.data[idx + 3] = 255;
          } else {
            const avg = Math.round(
              (dataA.data[idx]! + dataB.data[idx]!) / 2 * 0.3,
            );
            diffData.data[idx] = avg;
            diffData.data[idx + 1] = avg;
            diffData.data[idx + 2] = avg;
            diffData.data[idx + 3] = 255;
          }
        }

        ctxD.putImageData(diffData, 0, 0);
        const rmse = Math.sqrt(sumSq / n);

        return {
          rmse: Math.round(rmse * 100) / 100,
          diffDataUrl: diffCanvas.toDataURL("image/png"),
        };
      },
      { img1: imgData, img2: natData },
    );

    const diffFile = `diff-page-${i + 1}.png`;
    const diffImgData = diffResult.diffDataUrl.replace(
      /^data:image\/png;base64,/,
      "",
    );
    fs.writeFileSync(
      path.join(COMPARE_DIR, diffFile),
      Buffer.from(diffImgData, "base64"),
    );

    report.push({
      page: i + 1,
      imageFile: imgFile,
      nativeFile: natFile,
      diffFile,
      rmse: diffResult.rmse,
    });

    console.log(`Page ${i + 1}: RMSE = ${diffResult.rmse}`);
  }

  // Save report
  fs.writeFileSync(
    path.join(COMPARE_DIR, "comparison-report.json"),
    JSON.stringify(report, null, 2),
  );

  console.log(`\nComparison results saved to: ${COMPARE_DIR}`);
  console.log("Files: image-page-N.png, native-page-N.png, diff-page-N.png");
  console.log("Red areas in diff images show visual differences");
});
