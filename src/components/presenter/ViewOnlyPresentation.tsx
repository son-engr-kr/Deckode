import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useDeckStore } from "@/stores/deckStore";
import { SlideRenderer } from "@/components/renderer/SlideRenderer";
import { computeSteps } from "@/utils/animationSteps";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/types/deck";
import type { SlideTransition } from "@/types/deck";
import { AnimatePresence, motion } from "framer-motion";

const transitionVariants = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slide: {
    initial: { opacity: 0, x: 80 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -80 },
  },
  none: { initial: {}, animate: {}, exit: {} },
};

interface ViewOnlyPresentationProps {
  onExit: () => void;
}

export function ViewOnlyPresentation({ onExit }: ViewOnlyPresentationProps) {
  const deck = useDeckStore((s) => s.deck);
  const currentSlideIndex = useDeckStore((s) => s.currentSlideIndex);
  const setCurrentSlide = useDeckStore((s) => s.setCurrentSlide);

  const [scale, setScale] = useState(1);
  const [activeStep, setActiveStep] = useState(0);

  const visibleSlides = useMemo(() => {
    if (!deck) return [];
    return deck.slides
      .map((slide, index) => ({ slide, originalIndex: index }))
      .filter(({ slide }) => !slide.hidden);
  }, [deck]);

  const visiblePosition = useMemo(
    () => visibleSlides.findIndex((v) => v.originalIndex === currentSlideIndex),
    [visibleSlides, currentSlideIndex],
  );

  const slide = deck?.slides[currentSlideIndex];
  const totalSlides = visibleSlides.length;

  const steps = useMemo(
    () => computeSteps(slide?.animations ?? []),
    [slide?.animations],
  );

  // Reset activeStep on slide change
  useEffect(() => {
    setActiveStep(0);
  }, [currentSlideIndex]);

  // Fit to viewport
  useEffect(() => {
    const update = () => {
      const scaleX = window.innerWidth / CANVAS_WIDTH;
      const scaleY = window.innerHeight / CANVAS_HEIGHT;
      setScale(Math.min(scaleX, scaleY));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // On entering, if current slide is hidden, jump to nearest visible
  const initialJumpDone = useRef(false);
  useEffect(() => {
    if (initialJumpDone.current || visibleSlides.length === 0) return;
    initialJumpDone.current = true;
    if (visiblePosition === -1) {
      setCurrentSlide(visibleSlides[0]!.originalIndex);
    }
  }, [visibleSlides, visiblePosition, setCurrentSlide]);

  // Stable refs for keyboard handler
  const activeStepRef = useRef(activeStep);
  activeStepRef.current = activeStep;
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const visibleSlidesRef = useRef(visibleSlides);
  visibleSlidesRef.current = visibleSlides;
  const visiblePositionRef = useRef(visiblePosition);
  visiblePositionRef.current = visiblePosition;

  const advance = useCallback(() => {
    if (activeStepRef.current < stepsRef.current.length) {
      setActiveStep((prev) => prev + 1);
    } else {
      const vs = visibleSlidesRef.current;
      const pos = visiblePositionRef.current;
      if (pos !== -1 && pos + 1 < vs.length) {
        setCurrentSlide(vs[pos + 1]!.originalIndex);
      }
    }
  }, [setCurrentSlide]);

  const goBack = useCallback(() => {
    if (activeStepRef.current > 0) {
      setActiveStep((prev) => prev - 1);
    } else {
      const vs = visibleSlidesRef.current;
      const pos = visiblePositionRef.current;
      if (pos > 0) {
        setCurrentSlide(vs[pos - 1]!.originalIndex);
      }
    }
  }, [setCurrentSlide]);

  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onExit();
      } else if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        advanceRef.current();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goBack();
      } else {
        const currentStep = stepsRef.current[activeStepRef.current];
        if (currentStep?.trigger === "onKey" && currentStep.key === e.key) {
          e.preventDefault();
          advanceRef.current();
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onExit, goBack]);

  if (!deck || !slide) return null;

  const transition: SlideTransition = slide.transition ?? {
    type: "fade",
    duration: 300,
  };
  const variant =
    transitionVariants[transition.type] ?? transitionVariants.fade;

  const displayPosition = visiblePosition !== -1 ? visiblePosition + 1 : 0;

  return (
    <div className="h-screen w-screen bg-black flex items-center justify-center cursor-default select-none">
      <div className="relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            initial={variant.initial}
            animate={variant.animate}
            exit={variant.exit}
            transition={{ duration: (transition.duration ?? 300) / 1000 }}
          >
            <SlideRenderer
              slide={slide}
              scale={scale}
              animate
              activeStep={activeStep}
              steps={steps}
              onAdvance={advance}
              theme={deck.theme}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Slide counter overlay */}
      <div className="fixed bottom-4 right-4 text-white/40 text-sm font-mono pointer-events-none">
        {displayPosition}/{totalSlides}
      </div>
    </div>
  );
}
