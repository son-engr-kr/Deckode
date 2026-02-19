import { useMemo } from "react";
import type { Slide, Animation, DeckTheme } from "@/types/deck";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/types/deck";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ElementRenderer } from "./ElementRenderer";

interface Props {
  slide: Slide;
  scale: number;
  animate?: boolean;
  thumbnail?: boolean;
  /** Current onClick step (0 = no onClick steps triggered yet) */
  activeStep?: number;
  /** Grouped onClick steps from computeOnClickSteps */
  onClickSteps?: Animation[][];
  /** Called when clicking the slide area — parent uses this to advance step */
  onAdvance?: () => void;
  /** Deck-level theme for default styles */
  theme?: DeckTheme;
}

export function SlideRenderer({ slide, scale, animate, thumbnail, activeStep, onClickSteps, onAdvance, theme }: Props) {
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

  // Build the set of active animations: all onEnter + onClick steps whose index < activeStep
  const activeAnimations = useMemo(() => {
    if (!animate || activeStep === undefined || !onClickSteps) return undefined;
    const set = new Set<Animation>();
    for (let i = 0; i < activeStep && i < onClickSteps.length; i++) {
      for (const anim of onClickSteps[i]!) {
        set.add(anim);
      }
    }
    return set;
  }, [animate, activeStep, onClickSteps]);

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
