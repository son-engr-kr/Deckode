import { describe, it, expect } from "vitest";
import { resolve } from "path";
import { readFileSync } from "fs";

// ============================================================
// BUG REGRESSION: Auto-save writes to project/ → Vite file watcher
// detects the change → full page reload → loadDeck resets to slide 0.
// Fix: project/** must be excluded from Vite's file watcher.
// ============================================================

describe("vite config - projects/ must not trigger HMR", () => {
  it("server.watch.ignored includes projects/**", () => {
    const configPath = resolve(__dirname, "../vite.config.ts");
    const configContent = readFileSync(configPath, "utf-8");

    // The config must contain a watch.ignored entry for projects/**
    expect(configContent).toContain("projects/**");
    expect(configContent).toMatch(/watch[\s\S]*?ignored[\s\S]*?projects/);
  });
});
