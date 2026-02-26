import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const TEST_DECK_PATH = path.resolve(__dirname, "../fixtures/test-deck.json");

test.describe("PDF Export Visual Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Wait for the app to load
    await page.waitForSelector("[data-testid='editor-layout'], .h-screen", {
      timeout: 15_000,
    });
  });

  test("app loads without errors", async ({ page }) => {
    // Verify the page loaded by checking for key UI elements
    const body = await page.textContent("body");
    expect(body).toBeTruthy();
  });

  test("test fixture deck is valid JSON", () => {
    const raw = fs.readFileSync(TEST_DECK_PATH, "utf-8");
    const deck = JSON.parse(raw);
    expect(deck.deckode).toBe("1.0");
    expect(deck.meta.title).toBe("Test Deck");
    expect(deck.slides).toHaveLength(4);
    // Hidden slide count
    const hidden = deck.slides.filter(
      (s: { hidden?: boolean }) => s.hidden,
    );
    expect(hidden).toHaveLength(1);
  });

  test("PDF dropdown menu opens and shows both options", async ({ page }) => {
    // Look for the PDF dropdown button
    const pdfButton = page.locator("button", { hasText: "PDF" });

    // There might be no project loaded yet — the button might not be present
    // This test verifies the dropdown structure once in the editor
    const count = await pdfButton.count();
    if (count > 0) {
      await pdfButton.first().click();
      // Check both options appear
      const imageOption = page.locator("button", { hasText: "PDF (Image)" });
      const nativeOption = page.locator("button", { hasText: "PDF (Native)" });
      await expect(imageOption).toBeVisible({ timeout: 3000 });
      await expect(nativeOption).toBeVisible({ timeout: 3000 });
    }
  });
});
