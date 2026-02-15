import { describe, it, expect } from "vitest";
import { resolve } from "path";
import { readFileSync } from "fs";

// ============================================================
// BUG REGRESSION: Auto-save writes deck.json → Vite file watcher
// detects the change → full page reload → loadDeck resets to slide 0.
// Fix: deck.json must be excluded from Vite's file watcher.
// ============================================================

describe("vite config - deck.json must not trigger HMR", () => {
  it("server.watch.ignored includes deck.json", () => {
    const configPath = resolve(__dirname, "../vite.config.ts");
    const configContent = readFileSync(configPath, "utf-8");

    // The config must contain a watch.ignored entry for deck.json
    expect(configContent).toContain("deck.json");
    expect(configContent).toMatch(/watch[\s\S]*?ignored[\s\S]*?deck\.json/);
  });
});
