import type { Animation } from "@/types/deck";

// ----- Types -----

export interface AnimationStep {
  trigger: "onClick" | "onKey";
  key?: string;
  animations: Animation[];
  /** Computed delays for afterPrevious animations within this step (ms). */
  delayOverrides: Map<Animation, number>;
}

// ----- computeSteps -----

/**
 * Builds an ordered list of interactive steps from a slide's animation array.
 *
 * - `onEnter` animations are excluded (they always auto-play on slide load).
 * - `onClick` / `onKey` → start a new step.
 * - `withPrevious` → merge into the current step (play simultaneously).
 * - `afterPrevious` → merge into the current step (auto-chain after previous finishes).
 *
 * Backward compat: consecutive `onClick` animations that share the same
 * numeric `order` value are grouped into a single step.
 */
export function computeSteps(animations: Animation[]): AnimationStep[] {
  const nonEnter = animations.filter((a) => a.trigger !== "onEnter");
  if (nonEnter.length === 0) return [];

  // Phase 1: group legacy onClick animations by `order` value.
  // onClick anims with the same numeric order are batched together
  // as a single "onClick" block in the resulting sequence.
  const sequence = buildSequence(nonEnter);

  // Phase 2: walk the sequence and form steps.
  const steps: AnimationStep[] = [];

  for (const item of sequence) {
    if (item.trigger === "onClick" || item.trigger === "onKey") {
      steps.push({
        trigger: item.trigger === "onKey" ? "onKey" : "onClick",
        key: item.trigger === "onKey" ? item.anim.key : undefined,
        animations: item.trigger === "onKey" ? [item.anim] : item.anims!,
        delayOverrides: new Map(),
      });
    } else if (item.trigger === "withPrevious" || item.trigger === "afterPrevious") {
      if (steps.length === 0) {
        // No previous step exists — create an implicit onClick step
        steps.push({
          trigger: "onClick",
          animations: [],
          delayOverrides: new Map(),
        });
      }
      const current = steps[steps.length - 1]!;
      current.animations.push(item.anim);
    }
  }

  // Phase 3: compute delay overrides for afterPrevious animations within each step.
  for (const step of steps) {
    computeDelaysForStep(step);
  }

  return steps;
}

/** A flattened sequence item before step formation. */
type SeqItem =
  | { trigger: "onClick"; anims: Animation[] }
  | { trigger: "onKey"; anim: Animation }
  | { trigger: "withPrevious"; anim: Animation }
  | { trigger: "afterPrevious"; anim: Animation };

/**
 * Flattens animations into a sequence, grouping legacy onClick by `order`.
 */
function buildSequence(animations: Animation[]): SeqItem[] {
  const items: SeqItem[] = [];

  // Collect onClick anims with a numeric `order` to group them.
  const orderGroups = new Map<number, Animation[]>();
  const orderGroupEmitted = new Set<number>();

  // Pre-scan to build order groups
  for (const anim of animations) {
    if (anim.trigger === "onClick" && anim.order !== undefined) {
      const group = orderGroups.get(anim.order);
      if (group) group.push(anim);
      else orderGroups.set(anim.order, [anim]);
    }
  }

  for (const anim of animations) {
    if (anim.trigger === "onClick") {
      if (anim.order !== undefined) {
        // Emit the entire order group on first encounter
        if (!orderGroupEmitted.has(anim.order)) {
          orderGroupEmitted.add(anim.order);
          items.push({ trigger: "onClick", anims: orderGroups.get(anim.order)! });
        }
        // else: already emitted, skip
      } else {
        // Unnumbered onClick: standalone step
        items.push({ trigger: "onClick", anims: [anim] });
      }
    } else if (anim.trigger === "onKey") {
      items.push({ trigger: "onKey", anim });
    } else if (anim.trigger === "withPrevious") {
      items.push({ trigger: "withPrevious", anim });
    } else if (anim.trigger === "afterPrevious") {
      items.push({ trigger: "afterPrevious", anim });
    }
  }

  return items;
}

/**
 * Computes delay overrides for `afterPrevious` animations within a step.
 *
 * `withPrevious` animations keep their original delay (no override).
 * `afterPrevious` animations get: previous animation's (computedDelay + duration).
 */
function computeDelaysForStep(step: AnimationStep): void {
  let prevEnd = 0; // end time of the previous animation (ms)

  for (const anim of step.animations) {
    if (anim.trigger === "afterPrevious") {
      const computedDelay = prevEnd + (anim.delay ?? 0);
      step.delayOverrides.set(anim, computedDelay);
      prevEnd = computedDelay + (anim.duration ?? 500);
    } else {
      // onClick, onKey, withPrevious — use their native delay
      const effectiveDelay = anim.delay ?? 0;
      prevEnd = effectiveDelay + (anim.duration ?? 500);
    }
  }
}

// ----- Legacy -----

/**
 * @deprecated Use `computeSteps()` instead.
 * Groups onClick animations into sequential steps.
 */
export function computeOnClickSteps(animations: Animation[]): Animation[][] {
  const onClicks = animations.filter((a) => a.trigger === "onClick");
  if (onClicks.length === 0) return [];

  const numbered = new Map<number, Animation[]>();
  const unnumbered: Animation[] = [];

  for (const anim of onClicks) {
    if (anim.order !== undefined) {
      const group = numbered.get(anim.order);
      if (group) {
        group.push(anim);
      } else {
        numbered.set(anim.order, [anim]);
      }
    } else {
      unnumbered.push(anim);
    }
  }

  const sortedKeys = [...numbered.keys()].sort((a, b) => a - b);
  const steps: Animation[][] = sortedKeys.map((key) => numbered.get(key)!);

  for (const anim of unnumbered) {
    steps.push([anim]);
  }

  return steps;
}
