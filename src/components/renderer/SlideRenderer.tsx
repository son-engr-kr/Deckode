import { useMemo } from "react";
import type { Slide, Animation, DeckTheme } from "@/types/deck";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/types/deck";
import type { AnimationStep } from "@/utils/animationSteps";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ElementRenderer } from "./ElementRenderer";

interface Props {
  slide: Slide;
  scale: number;
  animate?: boolean;
  thumbnail?: boolean;
  /** Current step index (0 = no interactive steps triggered yet) */
  activeStep?: number;
  /** Grouped animation steps from computeSteps */
  steps?: AnimationStep[];
  /** Called when clicking the slide area — parent uses this to advance step */
  onAdvance?: () => void;
  /** Deck-level theme for default styles */
  theme?: DeckTheme;
}

export function SlideRenderer({ slide, scale, animate, thumbnail, activeStep, steps, onAdvance, theme }: Props) {
  const bg = slide.background;
  const themeBgColor = theme?.slide?.background?.color;

  // Build element→animations lookup only when animating
  const animationMap = useMemo(() => {
    if (!animate || !slide.animations || slide.animations.length === 0) return null;
    const map = new Map<string, Animation[]>();
    for (const anim of slide.animations) {
      const list = map.get(anim.target);
      if (list) {
        list.push(anim);
      } else {
        map.set(anim.target, [anim]);
      }
    }
    return map;
  }, [animate, slide.animations]);

  // Build the set of active animations + delay overrides from steps
  const { activeAnimations, delayOverrides } = useMemo(() => {
    if (!animate || activeStep === undefined || !steps) {
      return { activeAnimations: undefined, delayOverrides: undefined };
    }
    const set = new Set<Animation>();
    const delays = new Map<Animation, number>();
    for (let i = 0; i < activeStep && i < steps.length; i++) {
      const step = steps[i]!;
      for (const anim of step.animations) {
        set.add(anim);
        const override = step.delayOverrides.get(anim);
        if (override !== undefined) {
          delays.set(anim, override);
        }
      }
    }
    return { activeAnimations: set, delayOverrides: delays };
  }, [animate, activeStep, steps]);

  const content = (
    <div
      style={{
        width: CANVAS_WIDTH * scale,
        height: CANVAS_HEIGHT * scale,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        onClick={onAdvance}
        style={{
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          backgroundColor: bg?.color ?? themeBgColor ?? "#0f172a",
          backgroundImage: bg?.image ? `url(${bg.image})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          position: "absolute",
          top: 0,
          left: 0,
          cursor: onAdvance ? "default" : undefined,
        }}
      >
        {slide.elements.map((element) => (
          <ElementRenderer
            key={element.id}
            element={element}
            animations={animationMap?.get(element.id)}
            activeAnimations={activeAnimations}
            delayOverrides={delayOverrides}
            thumbnail={thumbnail}
          />
        ))}
      </div>
    </div>
  );

  if (theme) {
    return <ThemeProvider theme={theme}>{content}</ThemeProvider>;
  }
  return content;
}
