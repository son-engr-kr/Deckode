import { useRef, useEffect } from "react";
import { useDeckStore } from "@/stores/deckStore";
import { SlideRenderer } from "@/components/renderer/SlideRenderer";
import { nextSlideId } from "@/utils/id";
import type { Slide } from "@/types/deck";

const THUMB_SCALE = 0.15;
const THUMB_W = Math.round(960 * THUMB_SCALE);
const THUMB_H = Math.round(540 * THUMB_SCALE);

function createBlankSlide(): Slide {
  return {
    id: nextSlideId(),
    background: { color: "#0f172a" },
    elements: [],
  };
}

export function SlideList() {
  const deck = useDeckStore((s) => s.deck);
  const currentSlideIndex = useDeckStore((s) => s.currentSlideIndex);
  const setCurrentSlide = useDeckStore((s) => s.setCurrentSlide);
  const addSlide = useDeckStore((s) => s.addSlide);
  const deleteSlide = useDeckStore((s) => s.deleteSlide);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to current slide
  useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    const child = container.children[currentSlideIndex] as HTMLElement | undefined;
    child?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentSlideIndex]);

  if (!deck) return null;

  const handleAddSlide = () => {
    const slide = createBlankSlide();
    const lastIndex = deck.slides.length - 1;
    addSlide(slide, lastIndex);
    setCurrentSlide(lastIndex + 1);
  };

  const handleDeleteSlide = (slideId: string, index: number) => {
    if (deck.slides.length <= 1) return;
    deleteSlide(slideId);
    if (index > 0) setCurrentSlide(index - 1);
  };

  return (
    <div ref={listRef} className="flex flex-col gap-1.5 p-2 overflow-y-auto">
      {deck.slides.map((slide, index) => (
        <div key={slide.id} className="relative group shrink-0">
          <button
            onClick={() => setCurrentSlide(index)}
            className={`rounded border-2 transition-colors p-0.5 ${
              index === currentSlideIndex
                ? "border-blue-500"
                : "border-zinc-700 hover:border-zinc-500"
            }`}
          >
            <div className="rounded-sm overflow-hidden pointer-events-none">
              <SlideRenderer slide={slide} scale={THUMB_SCALE} />
            </div>
            <span className="absolute bottom-0.5 right-1.5 text-[10px] text-zinc-500 font-mono">
              {index + 1}
            </span>
          </button>

          {deck.slides.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); handleDeleteSlide(slide.id, index); }}
              className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-600 text-white text-[9px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              title="Delete slide"
            >
              ×
            </button>
          )}
        </div>
      ))}

      <button
        onClick={handleAddSlide}
        className="rounded border-2 border-dashed border-zinc-700 hover:border-zinc-500 text-zinc-500 hover:text-zinc-300 transition-colors flex items-center justify-center text-lg shrink-0"
        style={{ width: THUMB_W + 6, height: THUMB_H + 6 }}
        title="Add slide"
      >
        +
      </button>
    </div>
  );
}
