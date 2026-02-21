import { describe, it, expect } from "vitest";
import { computeSteps, computeOnClickSteps } from "./animationSteps";
import type { Animation } from "@/types/deck";

function anim(overrides: Partial<Animation> = {}): Animation {
  return {
    target: "el1",
    trigger: "onClick",
    effect: "fadeIn",
    ...overrides,
  };
}

// ---- computeSteps ----

describe("computeSteps", () => {
  it("returns empty for no animations", () => {
    expect(computeSteps([])).toEqual([]);
  });

  it("returns empty when only onEnter animations exist", () => {
    const anims: Animation[] = [
      anim({ target: "a", trigger: "onEnter" }),
      anim({ target: "b", trigger: "onEnter" }),
    ];
    expect(computeSteps(anims)).toEqual([]);
  });

  it("creates one step per onClick animation (no order)", () => {
    const anims: Animation[] = [
      anim({ target: "a", trigger: "onClick" }),
      anim({ target: "b", trigger: "onClick" }),
    ];
    const steps = computeSteps(anims);
    expect(steps).toHaveLength(2);
    expect(steps[0]!.trigger).toBe("onClick");
    expect(steps[0]!.animations).toHaveLength(1);
    expect(steps[0]!.animations[0]!.target).toBe("a");
    expect(steps[1]!.animations[0]!.target).toBe("b");
  });

  it("groups onClick animations with same order into one step", () => {
    const anims: Animation[] = [
      anim({ target: "a", trigger: "onClick", order: 0 }),
      anim({ target: "b", trigger: "onClick", order: 0 }),
      anim({ target: "c", trigger: "onClick", order: 1 }),
    ];
    const steps = computeSteps(anims);
    expect(steps).toHaveLength(2);
    expect(steps[0]!.animations).toHaveLength(2);
    expect(steps[1]!.animations).toHaveLength(1);
    expect(steps[1]!.animations[0]!.target).toBe("c");
  });

  it("creates a step for onKey trigger with key property", () => {
    const anims: Animation[] = [
      anim({ target: "a", trigger: "onKey", key: "q" }),
    ];
    const steps = computeSteps(anims);
    expect(steps).toHaveLength(1);
    expect(steps[0]!.trigger).toBe("onKey");
    expect(steps[0]!.key).toBe("q");
    expect(steps[0]!.animations).toHaveLength(1);
  });

  it("merges withPrevious into the current step", () => {
    const anims: Animation[] = [
      anim({ target: "a", trigger: "onClick" }),
      anim({ target: "b", trigger: "withPrevious" }),
    ];
    const steps = computeSteps(anims);
    expect(steps).toHaveLength(1);
    expect(steps[0]!.animations).toHaveLength(2);
    expect(steps[0]!.animations[0]!.target).toBe("a");
    expect(steps[0]!.animations[1]!.target).toBe("b");
  });

  it("merges afterPrevious into the current step with computed delay", () => {
    const anims: Animation[] = [
      anim({ target: "a", trigger: "onClick", duration: 300 }),
      anim({ target: "b", trigger: "afterPrevious", duration: 400 }),
    ];
    const steps = computeSteps(anims);
    expect(steps).toHaveLength(1);
    expect(steps[0]!.animations).toHaveLength(2);

    // afterPrevious delay = previous anim end time (0 + 300) = 300ms
    const delayForB = steps[0]!.delayOverrides.get(steps[0]!.animations[1]!);
    expect(delayForB).toBe(300);
  });

  it("chains multiple afterPrevious animations", () => {
    const anims: Animation[] = [
      anim({ target: "a", trigger: "onClick", duration: 200, delay: 0 }),
      anim({ target: "b", trigger: "afterPrevious", duration: 300, delay: 0 }),
      anim({ target: "c", trigger: "afterPrevious", duration: 100, delay: 0 }),
    ];
    const steps = computeSteps(anims);
    expect(steps).toHaveLength(1);
    expect(steps[0]!.animations).toHaveLength(3);

    // b starts at 200 (a's end)
    expect(steps[0]!.delayOverrides.get(steps[0]!.animations[1]!)).toBe(200);
    // c starts at 200 + 300 = 500 (b's end)
    expect(steps[0]!.delayOverrides.get(steps[0]!.animations[2]!)).toBe(500);
  });

  it("afterPrevious respects its own delay as additional offset", () => {
    const anims: Animation[] = [
      anim({ target: "a", trigger: "onClick", duration: 200 }),
      anim({ target: "b", trigger: "afterPrevious", duration: 300, delay: 100 }),
    ];
    const steps = computeSteps(anims);
    // b starts at 200 (a end) + 100 (own delay) = 300
    expect(steps[0]!.delayOverrides.get(steps[0]!.animations[1]!)).toBe(300);
  });

  it("withPrevious does not get delay override", () => {
    const anims: Animation[] = [
      anim({ target: "a", trigger: "onClick" }),
      anim({ target: "b", trigger: "withPrevious", delay: 50 }),
    ];
    const steps = computeSteps(anims);
    expect(steps[0]!.delayOverrides.has(steps[0]!.animations[1]!)).toBe(false);
  });

  it("creates implicit step when withPrevious/afterPrevious comes first", () => {
    const anims: Animation[] = [
      anim({ target: "a", trigger: "withPrevious" }),
    ];
    const steps = computeSteps(anims);
    expect(steps).toHaveLength(1);
    expect(steps[0]!.trigger).toBe("onClick");
    expect(steps[0]!.animations).toHaveLength(1);
  });

  it("handles mixed scenario from plan example", () => {
    const anims: Animation[] = [
      anim({ target: "title", trigger: "onClick", duration: 500 }),
      anim({ target: "subtitle", trigger: "withPrevious", duration: 400 }),
      anim({ target: "chart", trigger: "afterPrevious", duration: 600 }),
      anim({ target: "logo", trigger: "onClick", duration: 300 }),
      anim({ target: "footer", trigger: "onKey", key: "q", duration: 200 }),
    ];
    const steps = computeSteps(anims);
    expect(steps).toHaveLength(3);

    // Step 0: onClick with title + subtitle (withPrevious) + chart (afterPrevious)
    expect(steps[0]!.trigger).toBe("onClick");
    expect(steps[0]!.animations).toHaveLength(3);

    // Step 1: onClick with logo
    expect(steps[1]!.trigger).toBe("onClick");
    expect(steps[1]!.animations).toHaveLength(1);

    // Step 2: onKey "q" with footer
    expect(steps[2]!.trigger).toBe("onKey");
    expect(steps[2]!.key).toBe("q");
    expect(steps[2]!.animations).toHaveLength(1);

    // Chart (afterPrevious) delay: subtitle ends at (0 + 400) = 400
    const chartDelay = steps[0]!.delayOverrides.get(steps[0]!.animations[2]!);
    expect(chartDelay).toBe(400);
  });

  it("ignores onEnter animations in step computation", () => {
    const anims: Animation[] = [
      anim({ target: "bg", trigger: "onEnter" }),
      anim({ target: "a", trigger: "onClick" }),
      anim({ target: "fg", trigger: "onEnter" }),
    ];
    const steps = computeSteps(anims);
    expect(steps).toHaveLength(1);
    expect(steps[0]!.animations[0]!.target).toBe("a");
  });
});

// ---- computeOnClickSteps (legacy backward compat) ----

describe("computeOnClickSteps", () => {
  it("returns empty array when no animations", () => {
    expect(computeOnClickSteps([])).toEqual([]);
  });

  it("ignores onEnter animations", () => {
    const anims: Animation[] = [
      anim({ trigger: "onEnter" }),
      anim({ trigger: "onEnter", effect: "scaleIn" }),
    ];
    expect(computeOnClickSteps(anims)).toEqual([]);
  });

  it("each undefined-order animation becomes its own step", () => {
    const a1 = anim({ target: "a" });
    const a2 = anim({ target: "b" });
    const steps = computeOnClickSteps([a1, a2]);
    expect(steps).toEqual([[a1], [a2]]);
  });

  it("same order groups into one step", () => {
    const a1 = anim({ target: "a", order: 0 });
    const a2 = anim({ target: "b", order: 0 });
    const steps = computeOnClickSteps([a1, a2]);
    expect(steps).toEqual([[a1, a2]]);
  });

  it("different orders create separate steps sorted ascending", () => {
    const a1 = anim({ target: "a", order: 2 });
    const a2 = anim({ target: "b", order: 0 });
    const a3 = anim({ target: "c", order: 1 });
    const steps = computeOnClickSteps([a1, a2, a3]);
    expect(steps).toEqual([[a2], [a3], [a1]]);
  });

  it("numbered steps come before undefined-order steps", () => {
    const a1 = anim({ target: "a", order: 0 });
    const a2 = anim({ target: "b" }); // undefined order
    const a3 = anim({ target: "c", order: 1 });
    const steps = computeOnClickSteps([a1, a2, a3]);
    expect(steps).toEqual([[a1], [a3], [a2]]);
  });

  it("mixed onEnter and onClick — only onClick are grouped", () => {
    const enter = anim({ trigger: "onEnter", target: "x" });
    const click1 = anim({ target: "a", order: 0 });
    const click2 = anim({ target: "b", order: 0 });
    const click3 = anim({ target: "c" });
    const steps = computeOnClickSteps([enter, click1, click2, click3]);
    expect(steps).toEqual([[click1, click2], [click3]]);
  });

  it("preserves array order within same numbered group", () => {
    const a1 = anim({ target: "a", order: 0, effect: "fadeIn" });
    const a2 = anim({ target: "b", order: 0, effect: "scaleIn" });
    const a3 = anim({ target: "c", order: 0, effect: "slideInLeft" });
    const steps = computeOnClickSteps([a1, a2, a3]);
    expect(steps[0]).toEqual([a1, a2, a3]);
  });
});
